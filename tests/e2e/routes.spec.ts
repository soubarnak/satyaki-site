import { expect, test } from "@playwright/test";

// Placeholder pass over the ADR-0007 route skeleton.
const routes: Array<[string, string, boolean?]> = [
  ["/", "JavaQuest"],
  ["/levels/1", "Level 1"],
  ["/playground", "Playground"],
  ["/arena", "Robot arena"],
  ["/progress", "Progress", true],
];

for (const [path, heading, exact] of routes) {
  test(`${path} shows its placeholder heading`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact })).toBeVisible();
  });
}

test("POST /api/run rejects a request with no program text (DR-001)", async ({
  request,
}) => {
  const response = await request.post("/api/run", { data: {} });
  expect(response.status()).toBe(400);
});
