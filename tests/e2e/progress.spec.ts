import { expect, test, type Page } from "@playwright/test";
import { localDateString, serializeProgress } from "../../lib/progress";
import { PROGRESS_STORAGE_KEY } from "../../lib/progress-storage";

// Parent progress seams (WF-005, FR-012, FR-013, DR-007, DR-009):
// seeded records render the summary, reset needs a confirmation and
// leaves storage empty, and cancelling changes nothing. Seeds are
// written into real storage followed by a reload (no init script),
// so later navigations see exactly what the app left behind.

interface Seed {
  passedLevelIds: number[];
  badges?: string[];
  streakDates?: string[];
}

async function writeRecord(page: Page, seed: Seed): Promise<void> {
  const record = serializeProgress({
    passedLevelIds: seed.passedLevelIds,
    badges: seed.badges ?? [],
    streakDates: seed.streakDates ?? [],
  });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PROGRESS_STORAGE_KEY, record],
  );
}

async function storedRaw(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), PROGRESS_STORAGE_KEY);
}

test("summary shows levels, points, badges, dates, and warning (FR-012 AC-1)", async ({
  page,
}) => {
  const today = localDateString(new Date());
  await page.goto("/progress");
  await writeRecord(page, {
    passedLevelIds: [1, 2, 3, 4],
    badges: ["First Print"],
    streakDates: [today],
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await expect(page.getByText(/Levels passed: 4 of 10/)).toBeVisible();
  await expect(page.getByText(/Total points: 400/)).toBeVisible();
  await expect(page.getByText(/First Print/)).toBeVisible();
  await expect(page.getByText(new RegExp(today))).toBeVisible();
  await expect(page.getByText(/lives only in this browser/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset progress" })).toBeEnabled();
});

test("no saved progress: zeros show and reset is disabled (FR-012 AC-2)", async ({
  page,
}) => {
  await page.goto("/progress");
  await expect(page.getByText(/Levels passed: 0 of 10/)).toBeVisible();
  await expect(page.getByText(/Total points: 0/)).toBeVisible();
  await expect(page.getByText(/Badges: None yet/)).toBeVisible();
  await expect(page.getByText(/Streak days: None yet/)).toBeVisible();
  await expect(page.getByText(/lives only in this browser/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset progress" })).toBeDisabled();
});

test("confirming reset clears the whole record (FR-013 AC-1, DR-007)", async ({
  page,
}) => {
  const today = localDateString(new Date());
  await page.goto("/progress");
  await writeRecord(page, {
    passedLevelIds: [1, 2],
    badges: ["First Print"],
    streakDates: [today],
  });
  await page.reload();
  await expect(page.getByText(/Levels passed: 2 of 10/)).toBeVisible();

  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Yes, reset everything" }).click();

  expect(await storedRaw(page)).toBeNull();
  await expect(page.getByText(/Levels passed: 0 of 10/)).toBeVisible();
  await expect(page.getByText(/Total points: 0/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset progress" })).toBeDisabled();

  // The map reads the cleared record: 0 points with only level 1 open.
  await page.goto("/");
  await expect(page.getByText(/Total points: 0/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Level 1: Wake Bolt/ })).toContainText("Open");
  await expect(page.getByRole("button", { name: /Level 2:/ })).toContainText("Locked");
});

test("cancelling reset keeps every value (FR-013 AC-2)", async ({ page }) => {
  await page.goto("/progress");
  await writeRecord(page, { passedLevelIds: [1, 2] });
  await page.reload();
  const before = await storedRaw(page);
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Keep progress" }).click();
  expect(await storedRaw(page)).toBe(before);
  await expect(page.getByText(/Levels passed: 2 of 10/)).toBeVisible();
  await expect(page.getByText(/Total points: 200/)).toBeVisible();
});

test("cleared browser storage starts from zero with the warning (DR-009)", async ({
  page,
}) => {
  await page.goto("/progress");
  await writeRecord(page, { passedLevelIds: [1, 2, 3] });
  await page.reload();
  await expect(page.getByText(/Levels passed: 3 of 10/)).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText(/Levels passed: 0 of 10/)).toBeVisible();
  await expect(page.getByText(/Total points: 0/)).toBeVisible();
  await expect(page.getByText(/lives only in this browser/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset progress" })).toBeDisabled();
});
