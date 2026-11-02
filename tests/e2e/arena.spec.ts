import { expect, test, type Page } from "@playwright/test";
import { localDateString, serializeProgress } from "../../lib/progress";
import { PROGRESS_STORAGE_KEY } from "../../lib/progress-storage";

// WF-004 arena seams (FR-010, FR-011, ADR-0007 thin Playwright pass):
// the run API is stubbed in the browser; no test calls the live
// runner. The gate refuses 8-passed records, and the 24-command
// reference program replays to a shown win plus one progress write.

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

async function countStorageWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __setItemCalls: number }).__setItemCalls = 0;
    const original = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key: string, value: string) => {
      (window as unknown as { __setItemCalls: number }).__setItemCalls += 1;
      return original(key, value);
    };
  });
}

async function storageWrites(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __setItemCalls: number }).__setItemCalls ?? 0,
  );
}

// 4 moves walk Bolt next to the station, 20 attacks wake it (AS-002).
const referenceStdout = [
  ...Array<string>(4).fill("MOVE"),
  ...Array<string>(20).fill("ATTACK"),
].join("\n");

const referenceProgram = `public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 4; i++) System.out.println("MOVE");
        for (int i = 0; i < 20; i++) System.out.println("ATTACK");
    }
}`;

test("8 passed: arena locked, no editor, 1 level remains (FR-010 AC-2)", async ({ page }) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8]);
  await page.goto("/arena");
  await expect(page.getByRole("heading", { name: "Robot arena" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 level remains");
  await expect(page.getByRole("status")).toContainText("Level 9");
  await expect(page.getByLabel("Your Java program")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run" })).toHaveCount(0);
});

test("9 passed: editor, commands, and board show (FR-010 AC-1)", async ({ page }) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/arena");
  await expect(page.getByLabel("Your Java program")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.getByText("MOVE", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Battle board")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reference win: win shown, level 10 recorded once in one write (FR-011 AC-1)", async ({
  page,
}) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await countStorageWrites(page);
  await stubRun(page, { resultClass: "ok", stdout: `${referenceStdout}\n` });
  await page.goto("/arena");
  await page.getByLabel("Your Java program").fill(referenceProgram);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("Victory");
  await expect(page.getByText(/Station awake, Cadet/)).toBeVisible();
  expect(await storedPassed(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(await storageWrites(page)).toBe(1);
});

test("empty battle: loss shown, level 10 stays open (FR-011 AC-2)", async ({ page }) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await stubRun(page, { resultClass: "ok", stdout: "Hello, Bolt!\n" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("no commands");
  await expect(page.getByText(/Station awake, Cadet/)).toHaveCount(0);
  expect(await storedPassed(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("runner down reads as runner trouble with no pass (WF-004 alternate path)", async ({
  page,
}) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await stubRun(page, { resultClass: "runner-unavailable" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("code runner is not answering");
  expect(await storedPassed(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("streak day recorded on an arena run without a win (FR-015)", async ({ page }) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await stubRun(page, { resultClass: "ok", stdout: "Hello, Bolt!\n" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("status")).toContainText("no commands");
  const today = localDateString(new Date());
  const dates = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).streakDates as string[]) : [];
  }, PROGRESS_STORAGE_KEY);
  expect(dates).toEqual([today]);
});
