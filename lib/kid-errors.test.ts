// Kid-error translator tests (issue #65, spec §5 / ADR-0012 / ADR-0014).
// Seams: translateKidError, shareLinkBrokenLine, translateSaveCodeError.
// Every error class renders one kid sentence naming the line; raw
// exception text never reaches the UI. Glossary: Cadet, Ship, Ship API.
import { describe, expect, it } from "vitest";
import {
  shareLinkBrokenLine,
  translateKidError,
  translateSaveCodeError,
} from "./kid-errors";

const RAW = "Traceback (most recent call last): File \"x.py\", line 1, in <module> kaboom 'secret'";

describe("runtime errors name the line and hide raw text", () => {
  it("unknown Ship name names the line without leaking the message", () => {
    const line = translateKidError({ line: 7, excType: "UnknownShipName", message: "Unknown Ship name: fly." }, "python");
    expect(line).toContain("Line 7");
    expect(line).not.toContain("fly");
    expect(line).not.toContain("Unknown Ship name");
  });

  it("wrapped Python binding errors classify by marker, not raw text", () => {
    const line = translateKidError(
      { line: 3, excType: "JsException", message: `UnknownShipName: Unknown Ship name: zzz. ${RAW}` },
      "python",
    );
    expect(line).toContain("Line 3");
    expect(line).not.toContain("zzz");
    expect(line).not.toContain("Traceback");
  });

  it("wrong argument count names the line", () => {
    const line = translateKidError({ line: 4, excType: "ArgCount", message: "Wrong argument count for move." }, "java");
    expect(line).toContain("Line 4");
    expect(line).not.toContain("Wrong argument count");
  });

  it("Python arity TypeError from the Ship binding maps to arg count", () => {
    const line = translateKidError({ line: 5, excType: "TypeError", message: "move() takes no arguments (1 given)" }, "python");
    expect(line).toContain("Line 5");
  });

  it("Ship action inside an expression must move to its own line", () => {
    const line = translateKidError({ line: 6, excType: "ActionInExpression", message: "Ship action move() runs only as its own line." }, "java");
    expect(line).toContain("Line 6");
    expect(line).not.toContain("runs only as its own line");
  });

  it("syntax errors name the line in both languages", () => {
    expect(translateKidError({ line: 2, excType: "SyntaxError", message: "bad" }, "python")).toContain("Line 2");
    expect(translateKidError({ line: 9, excType: "SyntaxError", message: "bad" }, "java")).toContain("Line 9");
    expect(translateKidError({ line: 1, excType: "IndentationError", message: RAW }, "python")).not.toContain("Traceback");
  });

  it("unknown names and fields name the line", () => {
    expect(translateKidError({ line: 8, excType: "NameError", message: RAW }, "python")).toContain("Line 8");
    expect(translateKidError({ line: 8, excType: "UnknownName", message: "Ship has no field foo." }, "java")).toContain("Line 8");
  });

  it("code outside the Cadet Java subset names the line", () => {
    const line = translateKidError({ line: 11, excType: "UnsupportedJava", message: "That for shape is outside the Cadet subset." }, "java");
    expect(line).toContain("Line 11");
    expect(line).not.toContain("That for shape is");
  });

  it("list reach, divide by zero, and read-only writes name the line", () => {
    expect(translateKidError({ line: 12, excType: "IndexOutOfRange", message: "Index 5 is outside the list." }, "java")).toContain("Line 12");
    expect(translateKidError({ line: 13, excType: "ZeroDivisionError", message: RAW }, "python")).toContain("Line 13");
    expect(translateKidError({ line: 14, excType: "ReadOnly", message: "Ship field ship.x is read-only." }, "java")).toContain("Line 14");
  });

  it("missing entry points name no raw text", () => {
    const line = translateKidError({ line: 0, excType: "NoMain", message: "No main method found." }, "java");
    expect(line).not.toContain("No main method");
    expect(line).not.toContain("Line 0");
  });

  it("unknown classes fall back to a generic sentence with the line", () => {
    const line = translateKidError({ line: 15, excType: "WeirdExplosion", message: RAW }, "python");
    expect(line).toContain("Line 15");
    expect(line).not.toContain("kaboom");
    expect(line).not.toContain("Traceback");
    expect(line).not.toContain("WeirdExplosion");
  });
});

describe("caps name the line and the cap", () => {
  it("step cap", () => {
    const line = translateKidError({ line: 20, excType: "StepCap", message: "500 Ship-step budget exceeded." }, "python");
    expect(line).toContain("Line 20");
    expect(line).toContain("500");
  });

  it("event cap", () => {
    expect(translateKidError({ line: 21, excType: "EventCap", message: "x" }, "java")).toContain("500");
  });

  it("time cap", () => {
    const line = translateKidError({ line: 22, excType: "TimeCap", message: "3 s wall-clock budget exceeded" }, "python");
    expect(line).toContain("Line 22");
    expect(line).toContain("3");
  });
});

describe("builder errors name the call and the line", () => {
  it("builder call after the first Ship action", () => {
    const line = translateKidError(
      { line: 2, excType: "BuilderAfterStep", message: "builder after step", call: "spawn_crystal" },
      "python",
    );
    expect(line).toContain("Line 2");
    expect(line).toContain("spawn_crystal");
  });

  it("unknown colour lists the closed palette, never raw text", () => {
    const line = translateKidError({ line: 3, excType: "UnknownColour", message: `bad colour chartreuse ${RAW}` }, "python");
    expect(line).toContain("Line 3");
    expect(line).toContain("red");
    expect(line).not.toContain("chartreuse");
    expect(line).not.toContain("Traceback");
  });

  it("placement, limit, and builder arg errors name the line", () => {
    expect(translateKidError({ line: 4, excType: "BuilderPlacement", message: RAW }, "python")).toContain("Line 4");
    expect(translateKidError({ line: 5, excType: "BuilderLimit", message: RAW }, "java")).toContain("Line 5");
    expect(
      translateKidError({ line: 6, excType: "BuilderArgs", message: RAW, call: "setShipColour" }, "java"),
    ).toContain("Line 6");
  });

  it("untrusted call names are never echoed", () => {
    const line = translateKidError({ line: 2, excType: "BuilderAfterStep", message: RAW, call: "__import__('os')" }, "python");
    expect(line).toContain("Line 2");
    expect(line).not.toContain("__import__");
    expect(line).not.toContain("Traceback");
  });
});

describe("import failures show one banner", () => {
  it("share link failures show the broken-link banner", () => {
    const line = shareLinkBrokenLine();
    expect(line).toContain("fresh link");
    expect(line).not.toContain("Traceback");
  });

  it("save code failures never leak decode internals", () => {
    for (const reason of ["unknown-version", "too-large", "bad-checksum", "bad-format", "decompress-failed", "invalid-json"] as const) {
      const line = translateSaveCodeError(reason);
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain(reason);
    }
  });
});
