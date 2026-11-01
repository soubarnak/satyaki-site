import { expect, test, type Page } from "@playwright/test";
import { localDateString, serializeProgress } from "../../lib/progress";
import { PROGRESS_STORAGE_KEY } from "../../lib/progress-storage";

// WF-001 level map seams (ticket "Build level map view"): the map
// derives state from seeded progress records and a locked planet is
// not navigable. Records are seeded in real browser storage under the
// ADR-0006 key before each page load.

async function seedProgress(
  page: Page,
  passedLevelIds: number[],
  streakDates: string[] = [],
): Promise<void> {
  const record = serializeProgress({ passedLevelIds, badges: [], streakDates });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: PROGRESS_STORAGE_KEY, value: record },
  );
}

test("no saved progress: level 1 open, levels 2 to 10 locked, 0 points (FR-001 AC-2)", async ({
  page,
}) => {
  await page.goto("/");
  const level1 = page.getByRole("link", { name: /Level 1: Wake Bolt/ });
  await expect(level1).toBeVisible();
  await expect(level1).toHaveAttribute("href", "/levels/1");
  await expect(level1).toContainText("Open");
  await expect(page.getByRole("button", { name: /Level 2:/ })).toContainText("Locked");
  await expect(page.getByText(/Total points: 0/)).toBeVisible();
  await expect(page.getByText(/Day streak: 0/)).toBeVisible();
});

test("levels 1 to 3 passed: 4 open, 5 to 10 locked, 300 points (FR-001 AC-1)", async ({
  page,
}) => {
  await seedProgress(page, [1, 2, 3], [localDateString(new Date())]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Level 1:/ })).toContainText("Passed");
  const level4 = page.getByRole("link", { name: /Level 4: Signal Stars/ });
  await expect(level4).toContainText("Open");
  await expect(level4).toHaveAttribute("href", "/levels/4");
  await expect(page.getByRole("button", { name: /Level 5:/ })).toContainText("Locked");
  await expect(page.getByText(/Total points: 300/)).toBeVisible();
  await expect(page.getByText(/Day streak: 1/)).toBeVisible();
  await expect(page.getByText(/Levels passed: 3 of 10/)).toBeVisible();
});

test("selecting a locked level keeps the map shown and names level 4 (FR-002 AC-1)", async ({
  page,
}) => {
  await seedProgress(page, [1, 2, 3]);
  await page.goto("/");
  await page.getByRole("button", { name: /Level 6:/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status")).toContainText("Pass Level 4 first");
  // The locked planet offered no link away from the map.
  await expect(page.getByRole("link", { name: /Level 6:/ })).toHaveCount(0);
});

test("level 9 passed: selecting level 10 leads to the arena (FR-002 AC-2)", async ({
  page,
}) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await page.goto("/");
  const level10 = page.getByRole("link", { name: /Level 10: Rescue Signal/ });
  await expect(level10).toContainText("Open");
  await expect(level10).toHaveAttribute("href", "/arena");
});

test("full record: every level passed and 1100 points derived", async ({ page }) => {
  await seedProgress(page, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  await page.goto("/");
  await expect(page.getByText(/Total points: 1100/)).toBeVisible();
  await expect(page.getByText(/Levels passed: 10 of 10/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Level \d+:/ })).toHaveCount(0);
});
