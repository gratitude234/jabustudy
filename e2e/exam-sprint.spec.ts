import { expect, test, type BrowserContext } from "@playwright/test";

const attemptId = "exam-sprint-e2e";

async function mockAttemptApi(context: BrowserContext) {
  await context.route(`**/api/exam/attempts/${attemptId}`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + 40 * 60_000);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        attempt: {
          id: attemptId,
          setId: "gns-121-bank",
          setTitle: "GNS 121 Exam Sprint Mock",
          courseCode: "GNS 121",
          kind: "mock",
          startedAt: startedAt.toISOString(),
          deadlineAt: deadlineAt.toISOString(),
          questions: [
            {
              id: "question-1",
              position: 1,
              prompt: "Which area of Microsoft Word contains file commands?",
              options: [
                { id: "q1-a", text: "Status bar" },
                { id: "q1-b", text: "Backstage view" },
                { id: "q1-c", text: "Document margin" },
                { id: "q1-d", text: "Clipboard" },
              ],
            },
            {
              id: "question-2",
              position: 2,
              prompt: "Why is a file extension useful?",
              options: [
                { id: "q2-a", text: "It shows the physical location" },
                { id: "q2-b", text: "It displays the password" },
                { id: "q2-c", text: "It identifies the likely format" },
                { id: "q2-d", text: "It guarantees a virus-free file" },
              ],
            },
          ],
          responses: {},
        },
      }),
    });
  });

  await context.route(`**/api/exam/attempts/${attemptId}/responses`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, savedAt: new Date().toISOString() }),
    });
  });
}

test.beforeEach(async ({ context }) => {
  await mockAttemptApi(context);
});

test("answers save and an offline change is clearly marked until reconnection", async ({ page, context }) => {
  await page.goto(`/exam/attempt/${attemptId}`);
  await expect(page.getByRole("heading", { name: /Which area of Microsoft Word/ })).toBeVisible();

  await page.getByRole("radio", { name: /Backstage view/ }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Next question/ }).click();

  await context.setOffline(true);
  await page.getByRole("radio", { name: /It identifies the likely format/ }).click();
  await expect(page.getByText(/only on this phone/i)).toBeVisible();
  await expect(page.getByText(/Reconnect before the timer reaches 00:00/i)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByText(/only on this phone/i)).toHaveCount(0);
});

test("opening the same attempt twice requires an explicit tab takeover", async ({ page, context }) => {
  await page.goto(`/exam/attempt/${attemptId}`);
  await expect(page.getByRole("heading", { name: /Which area of Microsoft Word/ })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto(`/exam/attempt/${attemptId}`);
  await expect(secondPage.getByRole("heading", { name: "This attempt is open elsewhere" })).toBeVisible();

  await secondPage.getByRole("button", { name: "Use this tab instead" }).click();
  await expect(secondPage.getByRole("heading", { name: /Which area of Microsoft Word/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This attempt is open elsewhere" })).toBeVisible();
});
