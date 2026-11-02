import { expect, test, type Page } from "@playwright/test";
import { getLevel } from "../../lib/levels";
import { serializeProgress } from "../../lib/progress";
import { PROGRESS_STORAGE_KEY } from "../../lib/progress-storage";

// WF-002 lesson player seams (ADR-0007 thin Playwright pass): the run
// API is stubbed in the browser; no test calls the live runner. Open a
// level, run a starter-derived program, see the pass, map shows it.

const level1 = getLevel(1)!;
const solution = level1.starterCode.replace(
  "// YOUR CODE BELOW",
  '// YOUR CODE BELOW\n        System.out.println("Bolt is awake!");',
);

interface StubBody {
  resultClass: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
}

async function stubRun(page: Page, body: StubBody, status = 200): Promise<void> {
  await page.route("**/api/run", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        durationMs: 123,
        ...body,
      }),
    }),
  );
}

async function seedProgress(page: Page, passedLevelIds: number[]): Promise<void> {
  const record = serializeProgress({ passedLevelIds, badges: [], streakDates: [] });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: PROGRESS_STORAGE_KEY, value: record },
  );
}

async function storedPassed(page: Page): Promise<number[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).passedLevelIds as number[]) : [];
  }, PROGRESS_STORAGE_KEY);
}

test("level 1 at 1024 px: story, objective, starter, hint, Run, output all shown (FR-003 AC-1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/levels/1");
  await expect(page.getByRole("heading", { name: "Level 1: Wake Bolt" })).toBeVisible();
  await expect(page.getByText(/Bolt sleeps on the launch pad/)).toBeVisible();
  await expect(page.getByText(/Use print to show the wake words/)).toBeVisible();
  const editor = page.getByLabel("Your Java program");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(level1.starterCode);
  await expect(page.getByRole("button", { name: "Hint" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.getByLabel("Program output")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("run starter-derived solution: pass shown, then map shows it (WF-002, FR-005, FR-006, FR-008)", async ({
  page,
}) => {
  await stubRun(page, { resultClass: "ok", stdout: "Bolt is awake!\n" });
  await page.goto("/levels/1");
  await page.getByLabel("Your Java program").fill(solution);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByLabel("Program output")).toContainText("Bolt is awake!");
  await expect(page.getByText(/Run time/)).toBeVisible();
  await expect(page.locator(".lesson-pass")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("First Print");
  expect(await storedPassed(page)).toEqual([1]);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Level 1:/ })).toContainText("Passed");
  await expect(page.getByRole("link", { name: /Level 2:/ })).toContainText("Open");
  await expect(page.getByText(/Total points: 100/)).toBeVisible();
});

test("hint shows in Bolt's bubble and changes no progress (FR-016 AC-1)", async ({ page }) => {
  await page.goto("/levels/1");
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.getByRole("status")).toContainText(level1.hint);
  expect(await storedPassed(page)).toEqual([]);
  await expect(page.getByLabel("Your Java program")).toHaveValue(level1.starterCode);
});

test("compile error: child line first, raw text after, no pass (FR-007 AC-1)", async ({ page }) => {
  await stubRun(page, {
    resultClass: "compile",
    stderr: "Main.java:3: error: ';' expected",
  });
  await page.goto("/levels/1");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("Bolt cannot read this code yet");
  await expect(page.getByLabel("Program output")).toContainText("Main.java:3: error");
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
  expect(await storedPassed(page)).toEqual([]);
});

test("runner unavailable reads as runner trouble, not a code mistake, and awards no pass", async ({
  page,
}) => {
  await stubRun(page, { resultClass: "runner-unavailable" });
  await page.goto("/levels/1");
  await page.getByLabel("Your Java program").fill(solution);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("code runner is not answering");
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
  expect(await storedPassed(page)).toEqual([]);
});

test("busy (429) asks for a retry and awards no pass", async ({ page }) => {
  await stubRun(page, { resultClass: "busy" }, 429);
  await page.goto("/levels/1");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("try Run again");
  expect(await storedPassed(page)).toEqual([]);
});

test("program output renders as plain text, never markup (NFR-010)", async ({ page }) => {
  await stubRun(page, { resultClass: "ok", stdout: "<b>not bold</b>" });
  await page.goto("/levels/1");
  await page.getByRole("button", { name: "Run" }).click();
  const output = page.getByLabel("Program output");
  await expect(output).toContainText("<b>not bold</b>");
  await expect(output.locator("b")).toHaveCount(0);
});

test("locked level opened directly: locked message, no editor (WF-002 precondition)", async ({
  page,
}) => {
  await page.goto("/levels/2");
  await expect(page.getByText(/locked/)).toBeVisible();
  await expect(page.getByLabel("Your Java program")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run" })).toHaveCount(0);
});

test("passing an already-passed level again adds no points (FR-008 AC-2)", async ({ page }) => {
  await seedProgress(page, [1]);
  await stubRun(page, { resultClass: "ok", stdout: "Bolt is awake!\n" });
  await page.goto("/levels/1");
  await page.getByLabel("Your Java program").fill(solution);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.locator(".lesson-pass")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/Total points: 100/)).toBeVisible();
});

test("unknown level number: load-error message with retry, no editor (FR-003 AC-2)", async ({
  page,
}) => {
  await page.goto("/levels/99");
  await expect(page.getByText(/could not load/)).toBeVisible();
  await expect(page.getByRole("link", { name: /try again/i })).toBeVisible();
  await expect(page.getByLabel("Your Java program")).toHaveCount(0);
});
