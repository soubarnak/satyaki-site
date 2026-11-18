# Python harness for the Mission web worker (issue #63, spec §§3,5).
# Runs inside Pyodide 314.0.7 and under local CPython for tests.
# Stdlib only: no micropip, no learner-triggered downloads.
# Glossary: Ship, Ship API, World State, Seed.
#
# Contract: run_learner(code, ship) executes Cadet code with bare Ship
# names in scope and returns a JSON-safe dict:
#   {status, trace, stdout, error, stopReason, stepsUsed}
# trace holds one event per executed learner line:
#   {step, line, kind="line", locals, shipDelta, log?}
# `step` counts Ship actions only; `shipDelta` is null on non-Ship lines.
# error is {kind="error", line, excType, message} or null.

import contextlib
import io
import sys
import time
import traceback

FILENAME = "mission.py"
MAX_SHIP_STEPS = 500
MAX_TRACE_EVENTS = 500
MAX_WALL_SECONDS = 3.0

STEP_NAMES = frozenset(
    {
        "move",
        "turn_left",
        "turn_right",
        "ascend",
        "descend",
        "laser",
        "harvest",
        "shield",
    }
)

SENSOR_NAMES = frozenset(
    {
        "scan_ahead",
        "distance_ahead",
        "energy",
        "get_x",
        "get_y",
        "get_z",
        "heading",
        "crystals",
        "is_shield_on",
        "on_crystal",
    }
)

ALL_NAMES = STEP_NAMES | SENSOR_NAMES | frozenset({"log"})

_MAX_STR = 200
_MAX_ITEMS = 20


class _StepLimit(Exception):
    pass


class _EventLimit(Exception):
    pass


class _TimeLimit(Exception):
    pass


def _clean_value(value):
    if value is None or isinstance(value, (bool, int, float)):
        if isinstance(value, float) and not (value == value and abs(value) != float("inf")):
            return repr(value)
        return value
    if isinstance(value, str):
        return value[:_MAX_STR]
    if isinstance(value, (list, tuple)):
        return [_clean_value(v) for v in list(value)[:_MAX_ITEMS]]
    if isinstance(value, dict):
        out = {}
        for key in list(value.keys())[:_MAX_ITEMS]:
            if not isinstance(key, (str, int, float, bool)):
                continue
            cleaned = _clean_value(value[key])
            if cleaned is not None or value[key] is None:
                out[str(key)] = cleaned
        return out
    return repr(value)[:_MAX_STR]


def _clean_locals(frame_locals):
    out = {}
    for key, value in frame_locals.items():
        if key.startswith("__") or len(out) >= _MAX_ITEMS:
            continue
        if key in ALL_NAMES:
            continue
        try:
            cleaned = _clean_value(value)
        except Exception:
            continue
        out[str(key)] = cleaned
    return out


def _learner_line(tb):
    line = 0
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == FILENAME:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def run_learner(code, ship):
    """Execute Cadet code and emit the spec trace. `ship` exposes Ship API methods."""
    started = time.monotonic()
    trace = []
    stdout_buf = io.StringIO()
    state = {
        "ship_steps": 0,
        "events": 0,
        "pending_line": None,
        "pending_locals": {},
        "pending_delta": None,
        "pending_log": None,
    }

    def flush(prev_line, prev_locals):
        if state["pending_line"] is None:
            return
        if state["events"] >= MAX_TRACE_EVENTS:
            raise _EventLimit("too many trace events")
        event = {
            "step": state["ship_steps"],
            "line": state["pending_line"],
            "kind": "line",
            "locals": prev_locals,
            "shipDelta": state["pending_delta"],
        }
        if state["pending_log"] is not None:
            event["log"] = state["pending_log"]
        trace.append(event)
        state["events"] += 1
        state["pending_line"] = None
        state["pending_delta"] = None
        state["pending_log"] = None
        _check_clock(started)

    def _check_clock(start):
        if time.monotonic() - start > MAX_WALL_SECONDS:
            raise _TimeLimit("3 s wall-clock budget exceeded")

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event == "call":
            return tracer
        if event != "line":
            return tracer
        _check_clock(started)
        if state["pending_line"] is not None:
            flush(state["pending_line"], state["pending_locals"])
        state["pending_line"] = frame.f_lineno
        try:
            state["pending_locals"] = _clean_locals(frame.f_locals)
        except Exception:
            state["pending_locals"] = {}
        if state["events"] >= MAX_TRACE_EVENTS:
            raise _EventLimit("too many trace events")
        return tracer

    def make_step(name):
        def fn(*args):
            if len(args) != 0:
                raise TypeError(f"{name}() takes no arguments ({len(args)} given)")
            if state["ship_steps"] >= MAX_SHIP_STEPS:
                raise _StepLimit("500 Ship-step budget exceeded")
            delta = getattr(ship, name)()
            if isinstance(delta, dict):
                plain = {}
                for key, value in delta.items():
                    try:
                        plain[str(key)] = _clean_value(value)
                    except Exception:
                        continue
                delta = plain
            state["ship_steps"] += 1
            state["pending_delta"] = delta
            return _clean_value(delta.get("ship")) if isinstance(delta, dict) else None

        return fn

    def make_sensor(name):
        def fn(*args):
            if len(args) != 0:
                raise TypeError(f"{name}() takes no arguments ({len(args)} given)")
            return _clean_value(getattr(ship, name)())

        return fn

    def log_fn(value=None, *args):
        if args:
            raise TypeError(f"log() takes exactly one argument ({1 + len(args)} given)")
        text = value if isinstance(value, str) else repr(value)
        text = text[:_MAX_STR]
        if state["pending_line"] is None:
            state["pending_line"] = 0
            state["pending_locals"] = {}
        state["pending_log"] = text if state["pending_log"] is None else state["pending_log"] + "\n" + text
        result = getattr(ship, "log")(value) if hasattr(ship, "log") else value
        return _clean_value(result)

    learner_globals = {"__name__": "__mission__", "__builtins__": __builtins__}
    for name in STEP_NAMES:
        learner_globals[name] = make_step(name)
    for name in SENSOR_NAMES:
        learner_globals[name] = make_sensor(name)
    learner_globals["log"] = log_fn

    try:
        compiled = compile(code, FILENAME, "exec")
    except SyntaxError as exc:
        line = exc.lineno or 0
        return {
            "status": "error",
            "trace": [],
            "stdout": "",
            "error": {"kind": "error", "line": line, "excType": type(exc).__name__, "message": str(exc)},
            "stopReason": "error",
            "stepsUsed": 0,
        }

    error = None
    status = "ok"
    stop = "none"
    try:
        with contextlib.redirect_stdout(stdout_buf):
            sys.settrace(tracer)
            try:
                exec(compiled, learner_globals)
            finally:
                sys.settrace(None)
        if state["pending_line"] is not None:
            flush(state["pending_line"], state["pending_locals"])
    except (_StepLimit, KeyboardInterrupt) as exc:
        sys.settrace(None)
        if state["pending_line"] is not None and len(trace) < MAX_TRACE_EVENTS:
            try:
                flush(state["pending_line"], state["pending_locals"])
            except _EventLimit:
                pass
        if isinstance(exc, KeyboardInterrupt):
            status, stop = "time-cap", "time-cap"
            error = {"kind": "error", "line": state["pending_line"] or 0, "excType": "TimeCap", "message": "3 s wall-clock budget exceeded"}
        else:
            status, stop = "step-cap", "step-cap"
            error = {"kind": "error", "line": state["pending_line"] or 0, "excType": "StepCap", "message": str(exc)}
    except _EventLimit as exc:
        sys.settrace(None)
        status, stop = "event-cap", "event-cap"
        error = {"kind": "error", "line": state["pending_line"] or 0, "excType": "EventCap", "message": str(exc)}
    except _TimeLimit as exc:
        sys.settrace(None)
        if state["pending_line"] is not None and len(trace) < MAX_TRACE_EVENTS:
            try:
                flush(state["pending_line"], state["pending_locals"])
            except _EventLimit:
                pass
        status, stop = "time-cap", "time-cap"
        error = {"kind": "error", "line": state["pending_line"] or 0, "excType": "TimeCap", "message": str(exc)}
    except Exception as exc:
        sys.settrace(None)
        if state["pending_line"] is not None and len(trace) < MAX_TRACE_EVENTS:
            try:
                flush(state["pending_line"], state["pending_locals"])
            except _EventLimit:
                pass
        status, stop = "error", "error"
        tb_line = _learner_line(exc.__traceback__)
        error = {"kind": "error", "line": tb_line, "excType": type(exc).__name__, "message": str(exc)}
    # SyntaxError inside exec cannot happen (compiled above); IndentationError
    # arrives through the same except path with its traceback line.

    return {
        "status": status,
        "trace": trace,
        "stdout": stdout_buf.getvalue(),
        "error": error,
        "stopReason": stop,
        "stepsUsed": state["ship_steps"],
    }
