import { expect, test, type Page } from "@playwright/test";
import {
  emptyProgressV2,
  recordMissionPassV2,
  serializeProgressV2,
} from "../../lib/progress";
import { PROGRESS_V2_STORAGE_KEY } from "../../lib/progress-v2-storage";

// Orbit home map seams (issue #68): the prerendered SVG map paints with no
// loading gate; progress states overlay as text. Records are seeded in real
// browser storage under the v2 key before each page load.

async function seedProgress(page: Page, record: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: PROGRESS_V2_STORAGE_KEY, value: record },
  );
}

test("fresh Cadet: map paints with no loading gate, Volta open, Cometa locked", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Satyaki Space Coder" })).toBeVisible();
  await expect(page.getByLabel("Orbit map")).toBeVisible();
  await expect(page.getByText(/Loading your quest map/)).toHaveCount(0);
  const p1m1 = page.getByRole("link", { name: /Wake the Ship/ });
  await expect(p1m1).toBeVisible();
  await expect(p1m1).toHaveAttribute("href", "/missions/p1-m1");
  await expect(p1m1).toContainText("Open");
  await expect(page.getByText(/Total Stars: 0 of 75/)).toBeVisible();
  await expect(page.getByText(/Missions passed: 0 of 25/)).toBeVisible();
  await expect(page.getByLabel("Skill Radar summary")).toContainText("Volta");
  await expect(page.getByLabel("Daily Recall Drill")).toContainText("Wake the Ship");
});

test("one Pass: mission shows Passed with Stars, next opens, drill replays it", async ({
  page,
}) => {
  const record = serializeProgressV2(
    recordMissionPassV2(emptyProgressV2(), {
      slug: "p1-m1",
      language: "python",
      stars: 2,
      code: "move()",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    }),
  );
  await seedProgress(page, record);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Wake the Ship/ })).toContainText("Passed");
  await expect(page.getByRole("link", { name: /Wake the Ship/ })).toContainText("2 of 3 Stars");
  await expect(page.getByRole("link", { name: /Count the Power Cells/ })).toContainText("Open");
  await expect(page.getByText(/Total Stars: 2 of 75/)).toBeVisible();
  await expect(page.getByLabel("Daily Recall Drill")).toContainText("Wake the Ship");
});

test("locked Missions offer no link away from the map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Count the Power Cells/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});
