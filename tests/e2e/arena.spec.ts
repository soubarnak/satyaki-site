import { expect, test, type Page } from "@playwright/test";

// Arena seams (ADR-0014, spec §9): the Account gate and the tick battle.
// The run API is never touched: Java ticks run in-page, and /api/auth/me
// is stubbed. No test calls a live runner or writes a guest battle.

async function stubSession(page: Page, loggedIn: boolean): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: loggedIn ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        loggedIn ? { username: "Cadet_1", emailVerified: true } : { error: "Not signed in." },
      ),
    }),
  );
}

test("logged-out: sign-in prompt, never a guest battle", async ({ page }) => {
  await stubSession(page, false);
  await page.goto("/arena");
  await expect(page.getByRole("status")).toContainText("Account");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel(/Your .* program/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fly" })).toHaveCount(0);
});

test("logged-in: editor, tick actions, and Fly show", async ({ page }) => {
  await stubSession(page, true);
  await page.goto("/arena");
  await expect(page.getByLabel("Your Python program")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fly" })).toBeVisible();
  await expect(page.getByText("turn_left", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Java" })).toBeVisible();
});

test("java wait battle: cap shown, record written once, replay scrubs", async ({ page }) => {
  await stubSession(page, true);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Java" }).click();
  await page.getByRole("button", { name: "Fly" }).click();
  await expect(page.getByRole("status")).toContainText("200-tick cap", { timeout: 30000 });
  await expect(page.getByLabel("Arena record")).toContainText("Battles 1");
  await expect(page.getByLabel("Tick scrubber")).toBeVisible();
  await expect(page.getByRole("button", { name: "Step back" })).toBeVisible();
});
