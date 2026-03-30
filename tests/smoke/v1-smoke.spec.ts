import { expect, test, type Page } from "@playwright/test";

type MockState = {
  lightPatchStatus?: number;
  lightPatchMessage?: string;
  automationPatchName?: string;
  lightPatchCalls?: number;
  automationPatchCalls?: number;
};

async function installApiMocks(page: Page, state: MockState = {}) {
  const now = "2026-03-30T12:00:00.000Z";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/health" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: now,
          bridge: { status: "ok", connected: true, lastSeenAt: now },
          sync: { status: "ok", lastRunAt: now, pendingJobs: 0 },
        }),
      });
    }

    if (path === "/api/lights" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: now,
          lights: [
            {
              id: "light-1",
              name: "Kitchen Lamp",
              type: "lamp",
              room: { id: "room-kitchen", name: "Kitchen" },
              zone: null,
              isOn: true,
              brightness: 80,
              lastUpdatedAt: now,
            },
          ],
        }),
      });
    }

    if (path === "/api/lights/light-1" && method === "PATCH") {
      state.lightPatchCalls = (state.lightPatchCalls ?? 0) + 1;
      if (state.lightPatchStatus && state.lightPatchStatus >= 400) {
        return route.fulfill({
          status: state.lightPatchStatus,
          contentType: "application/json",
          body: JSON.stringify({
            message: state.lightPatchMessage ?? `Light patch failed (${state.lightPatchStatus})`,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          light: {
            id: "light-1",
            name: "Kitchen Lamp",
            type: "lamp",
            room: { id: "room-kitchen", name: "Kitchen" },
            zone: null,
            isOn: false,
            brightness: 0,
            lastUpdatedAt: now,
          },
        }),
      });
    }

    if (path === "/api/automations" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: now,
          automations: [
            {
              id: "automation-1",
              name: "Evening routine",
              status: "enabled",
              isEnabled: true,
              owner: "rest-api",
              lastTriggeredAt: null,
              conditions: [{ address: "/sensors/1/state/status", operator: "eq", value: "1" }],
              actions: [{ address: "/groups/0/action", method: "PUT", body: { on: true } }],
            },
          ],
        }),
      });
    }

    if (path === "/api/automations/automation-1" && method === "PATCH") {
      state.automationPatchCalls = (state.automationPatchCalls ?? 0) + 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          automation: {
            id: "automation-1",
            name: state.automationPatchName ?? "Evening routine",
            status: "enabled",
            isEnabled: true,
            owner: "rest-api",
            lastTriggeredAt: null,
            conditions: [{ address: "/sensors/1/state/status", operator: "eq", value: "1" }],
            actions: [{ address: "/groups/0/action", method: "PUT", body: { on: true } }],
          },
        }),
      });
    }

    if (path === "/api/backups" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, backups: [] }),
      });
    }

    if (path === "/api/groups" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, groups: [], availableLights: [] }),
      });
    }

    if (path === "/api/scenes" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, scenes: [] }),
      });
    }

    if (path === "/api/audit/events" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, retentionDays: 30, events: [] }),
      });
    }

    if (path === "/api/audit/export" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, retentionDays: 30, events: [] }),
      });
    }

    if (path === "/api/audit/retention" && method === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, retentionDays: 30, events: [] }),
      });
    }

    if (path === "/api/audit/events" && method === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ generatedAt: now, retentionDays: 30, events: [] }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: `Unhandled API route: ${method} ${path}` }),
    });
  });
}

test("dashboard smoke: shell loads with core cards", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hue Manager Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lights" })).toBeVisible();
});

test("dashboard smoke: guided automation edit saves", async ({ page }) => {
  const state: MockState = { automationPatchName: "Evening routine v2" };
  await installApiMocks(page, state);
  await page.goto("/");

  const automationEditor = page.locator("form").filter({ hasText: "Edit automation (guided)" });
  await page.getByRole("button", { name: "Edit guided" }).click();
  await automationEditor.getByRole("textbox").first().fill("Evening routine v2");
  await page.getByRole("button", { name: "Save automation" }).click();

  await expect(page.getByText('Updated automation "Evening routine v2".')).toBeVisible();
  await expect(page.getByText("Evening routine v2", { exact: true })).toBeVisible();
  expect(state.automationPatchCalls).toBe(1);
});

test("dashboard smoke: destructive confirm requires repeat and recovers on failure", async ({
  page,
}) => {
  const state: MockState = {
    lightPatchStatus: 502,
    lightPatchMessage: "Simulated bridge failure",
  };
  await installApiMocks(page, state);
  await page.goto("/");

  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(
    page.getByText("Repeat this action to confirm the destructive mutation."),
  ).toBeVisible();
  expect(state.lightPatchCalls ?? 0).toBe(0);

  await page.getByRole("button", { name: "Dismiss" }).first().click();
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText("Update failed: Simulated bridge failure")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn off" })).toBeVisible();
  expect(state.lightPatchCalls).toBe(1);
});
