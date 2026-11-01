import { expect, test } from "@playwright/test";

// Placeholder pass over the ADR-0007 route skeleton.
const routes: Array<[string, string]> = [
  ["/", "JavaQuest"],
  ["/levels/1", "Level 1"],
  ["/playground", "Playground"],
  ["/arena", "Robot arena"],
  ["/progress", "Progress"],
];

for (const [path, heading] of routes) {
  test(`${path} shows its placeholder heading`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}

test("POST /api/run answers 501 until the run route ticket lands", async ({
  request,
}) => {
  const response = await request.post("/api/run", { data: {} });
  expect(response.status()).toBe(501);
});
