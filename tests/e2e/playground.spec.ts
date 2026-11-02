import { expect, test, type Page } from "@playwright/test";
import { PLAYGROUND_EXAMPLE } from "../../lib/playground";
import { serializeProgress } from "../../lib/progress";
import { PROGRESS_STORAGE_KEY } from "../../lib/progress-storage";

// WF-003 playground seams (FR-009, ADR-0007 thin Playwright pass): the
// run API is stubbed in the browser; no test calls the live runner. Runs
// show output only and leave the progress record byte-identical.

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

async function storedRaw(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), PROGRESS_STORAGE_KEY);
}

test("playground shows the example program, Run, and output with no judge (WF-003)", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: "Playground" })).toBeVisible();
  await expect(page.getByText(/Free practise/)).toBeVisible();
  const editor = page.getByLabel("Your Java program");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(PLAYGROUND_EXAMPLE);
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.getByLabel("Program output")).toBeVisible();
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
});

test("run shows output and leaves storage byte-identical (FR-009 AC-1)", async ({ page }) => {
  await seedProgress(page, [1]);
  await stubRun(page, { resultClass: "ok", stdout: "Hello, Bolt!\n" });
  await page.goto("/playground");
  const before = await storedRaw(page);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByLabel("Program output")).toContainText("Hello, Bolt!");
  await expect(page.getByRole("status")).toContainText("Nice run");
  await expect(page.getByText(/Run time/)).toBeVisible();
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
  expect(await storedRaw(page)).toBe(before);
});

test("compile error shows the mapped error and leaves storage byte-identical (FR-009 AC-2)", async ({
  page,
}) => {
  await seedProgress(page, [1]);
  await stubRun(page, {
    resultClass: "compile",
    stderr: "Main.java:3: error: ';' expected",
  });
  await page.goto("/playground");
  const before = await storedRaw(page);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("Bolt cannot read this code yet");
  await expect(page.getByLabel("Program output")).toContainText("Main.java:3: error");
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
  expect(await storedRaw(page)).toBe(before);
});

test("runner down reads as runner trouble with no storage change", async ({ page }) => {
  await seedProgress(page, []);
  await stubRun(page, { resultClass: "runner-unavailable" });
  await page.goto("/playground");
  const before = await storedRaw(page);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("code runner is not answering");
  await expect(page.getByText(/Level passed/)).toHaveCount(0);
  expect(await storedRaw(page)).toBe(before);
});

test("program output renders as plain text, never markup (NFR-010)", async ({ page }) => {
  await stubRun(page, { resultClass: "ok", stdout: "<b>not bold</b>" });
  await page.goto("/playground");
  await page.getByRole("button", { name: "Run" }).click();
  const output = page.getByLabel("Program output");
  await expect(output).toContainText("<b>not bold</b>");
  await expect(output.locator("b")).toHaveCount(0);
});
