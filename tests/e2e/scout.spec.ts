import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const recommendationFixture = {
  latitude: 23.5791,
  longitude: 58.4026,
  intent: "romantic coastal portraits",
  shot_type: "portrait",
  generated_at: new Date().toISOString(),
  recommendations: [
    {
      rank: 1,
      location_name: "Azaiba Beach Park",
      latitude: 23.6019,
      longitude: 58.3912,
      distance_miles: 3.7,
      terrain_type: "urban park",
      best_window: {
        start_utc: new Date(Date.now() + 3600_000).toISOString(),
        end_utc: new Date(Date.now() + 5400_000).toISOString(),
      },
      light_phase: "golden_hour",
      score: 96,
      score_breakdown: {
        light: 100,
        weather: 92,
        crowd: 100,
        access: 88,
      },
      confidence: "medium",
      reason_tags: [
        "Golden-hour timing",
        "Low wind",
        "Close to origin",
        "No permit flag",
      ],
      caveats: [
        "Crowd and access signals are inferred from public map tags; verify locally.",
      ],
      conditions_summary:
        "Soft coastal light, 6 mph wind, and clear visibility.",
      advice:
        "Azaiba Beach Park: falls within golden hour; soft weather suits portrait work.",
      permit_required: false,
      permit_notes: null,
      image_url: null,
      image_attribution: null,
    },
    {
      rank: 2,
      location_name: "Qurum Natural Park",
      latitude: 23.6146,
      longitude: 58.4892,
      distance_miles: 5.9,
      terrain_type: "urban park",
      best_window: {
        start_utc: new Date(Date.now() + 3600_000).toISOString(),
        end_utc: new Date(Date.now() + 5400_000).toISOString(),
      },
      light_phase: "golden_hour",
      score: 89,
      score_breakdown: {
        light: 100,
        weather: 86,
        crowd: 60,
        access: 88,
      },
      confidence: "medium",
      reason_tags: [
        "Golden-hour timing",
        "Clear visibility",
        "Low access friction",
      ],
      caveats: [
        "Crowd and access signals are inferred from public map tags; verify locally.",
      ],
      conditions_summary:
        "Warm light, accessible terrain, and moderate crowd risk.",
      advice: "Qurum Natural Park: a strong backup if the coast is busy.",
      permit_required: false,
      permit_notes: null,
      image_url: null,
      image_attribution: null,
    },
  ],
};

test("does not create duplicate untouched sessions from repeated New Scout clicks", async ({
  page,
}) => {
  await page.goto("/");

  const sessionRows = page.locator(".session-button");
  const newScoutButton = page.locator("#new-session");
  await expect(sessionRows).toHaveCount(2);

  await page.getByPlaceholder("Search scouts").fill("Muscat");
  await expect(sessionRows).toHaveCount(1);
  await expect(page.getByText("Try Muscat sunset scout")).toBeVisible();
  await page.getByPlaceholder("Search scouts").fill("no matching scout");
  await expect(sessionRows).toHaveCount(0);
  await expect(page.getByText("No sessions match this search.")).toBeVisible();
  await page.getByPlaceholder("Search scouts").fill("");
  await expect(sessionRows).toHaveCount(2);

  await newScoutButton.click();
  await newScoutButton.click();
  await newScoutButton.click();

  await expect(sessionRows).toHaveCount(2);
  await expect(
    page.getByText("Location pending / No activity yet"),
  ).toBeVisible();
});

test("selects destination anchors for city, country, and place scouting", async ({
  page,
}) => {
  await page.route("**/api/recommendation", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      latitude?: unknown;
      longitude?: unknown;
      radius_miles?: unknown;
    };
    expect(requestBody.latitude).toBeCloseTo(25.2048, 4);
    expect(requestBody.longitude).toBeCloseTo(55.2708, 4);
    expect(requestBody.radius_miles).toBe(15);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationFixture),
    });
  });

  await page.goto("/");
  const destinationSearch = page.getByPlaceholder(
    "Search cities, countries, places",
  );

  await destinationSearch.fill("Japan");
  await expect(page.getByRole("button", { name: "Scout Japan" })).toBeVisible();

  await destinationSearch.fill("Yosemite");
  await expect(
    page.getByRole("button", { name: "Scout Yosemite Valley" }),
  ).toBeVisible();

  await destinationSearch.fill("Dubai");
  await page
    .getByRole("button", { name: "Dubai, United Arab Emirates" })
    .click();
  await expect(
    page.getByText("Dubai, United Arab Emirates / 25.2048, 55.2708"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scout Dubai" }).click();

  await expect(page.locator("#active-session-title")).toHaveText(
    "Dubai, United Arab Emirates",
  );
  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Your nearby shortlist" }),
  ).toBeVisible();
});

test("sets a manual location and renders map-first recommendations", async ({
  page,
}) => {
  await page.route("**/api/recommendation", async (route) => {
    expect(route.request().method()).toBe("POST");
    const requestBody = route.request().postDataJSON() as {
      intent?: unknown;
      shot_type?: unknown;
    };
    expect(requestBody.intent).toBe(
      "quiet portrait location with soft light shade and easy access",
    );
    expect(requestBody.shot_type).toBe("portrait");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationFixture),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("37.7749").fill("23.5791");
  await page.getByPlaceholder("-122.4194").fill("58.4026");
  await page.getByRole("button", { name: "Use coordinates" }).click();

  await expect(
    page.getByRole("heading", { name: "What are you planning?" }),
  ).toBeVisible();
  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Your nearby shortlist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Azaiba Beach Park, rank 1" }),
  ).toBeVisible();
  await expect(
    page
      .locator("#recommendation-1")
      .getByRole("heading", { name: "Azaiba Beach Park" }),
  ).toBeVisible();
  await expect(
    page.locator("#recommendation-1").getByText("Golden-hour timing"),
  ).toBeVisible();
  await expect(
    page.locator("#recommendation-1").getByText("Live weather"),
  ).toBeVisible();
  await expect(
    page.locator("#recommendation-1 img[src^='data:image']"),
  ).toHaveCount(0);
  await expect(
    page
      .locator("#recommendation-1")
      .getByRole("button", { name: "Copy report" }),
  ).toBeVisible();
  await expect(
    page.locator("#recommendation-1").getByText("What to verify"),
  ).toBeVisible();

  const resultScreenshot = await page.locator("#recommendation-1").screenshot();
  expect(resultScreenshot.byteLength).toBeGreaterThan(1000);

  const shareLink = page.getByRole("link", { name: "Open share link" });
  await expect(
    page.getByRole("button", { name: "Copy share link" }),
  ).toBeVisible();
  const shareHref = await shareLink.getAttribute("href");
  expect(shareHref).toContain("?share=");

  await page.goto(shareHref ?? "/", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/share=/);
  await expect(page.locator("#active-session-title")).toHaveText(
    "Shared: romantic coastal portraits",
  );
  await expect(
    page
      .locator("#recommendation-1")
      .getByRole("heading", { name: "Azaiba Beach Park" }),
  ).toBeVisible();
});

test("shows recovery actions when live scout fails", async ({ page }) => {
  await page.route("**/api/recommendation", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Location search is temporarily unavailable. Try a more specific activity or smaller search radius.",
        code: "upstream_unavailable",
        retryable: true,
        recovery_hint:
          "Retry once, or use the bundled Muscat demo scout for a guaranteed product walkthrough.",
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("37.7749").fill("23.5791");
  await page.getByPlaceholder("-122.4194").fill("58.4026");
  await page.getByRole("button", { name: "Use coordinates" }).click();

  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Scout could not complete the live search.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry live scout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Muscat demo" }).click();

  await expect(
    page.getByRole("heading", { name: "Your nearby shortlist" }),
  ).toBeVisible();
  await expect(
    page
      .locator("#recommendation-1")
      .getByRole("heading", { name: "Azaiba Beach Park" }),
  ).toBeVisible();
  await expect(
    page.locator(".source-notice").getByText("Demo fallback", { exact: true }),
  ).toBeVisible();
});

test("persists settings changes and applies them to recommendation units and time format", async ({
  page,
}) => {
  await page.route("**/api/recommendation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationFixture),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  const settingsPanel = page.locator("#settings-panel");
  await expect(
    settingsPanel.getByRole("heading", { name: "Settings" }),
  ).toBeVisible();
  await expect(
    settingsPanel.getByRole("button", { name: "Close settings" }),
  ).toBeFocused();

  await settingsPanel.getByRole("button", { name: "metric" }).click();
  await settingsPanel.getByRole("button", { name: "24h" }).click();
  await settingsPanel.getByRole("button", { name: "dark" }).click();
  await settingsPanel.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("button", { name: "Open settings" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Preferences" }).click();
  await expect(
    page
      .locator(".insight-card")
      .filter({ hasText: "Units" })
      .getByText("metric"),
  ).toBeVisible();
  await expect(
    page.locator(".insight-card").filter({ hasText: "Time" }).getByText("24h"),
  ).toBeVisible();
  await expect(
    page
      .locator(".insight-card")
      .filter({ hasText: "Theme" })
      .getByText("dark"),
  ).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByPlaceholder("37.7749").fill("23.5791");
  await page.getByPlaceholder("-122.4194").fill("58.4026");
  await page.getByRole("button", { name: "Use coordinates" }).click();

  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(page.locator(".route-list").getByText("6.0 km")).toBeVisible();
  await expect(page.locator("#recommendation-1")).toContainText(
    /\d{2}:\d{2} - \d{2}:\d{2}/,
  );
  await expect(page.locator("#recommendation-1")).not.toContainText(/AM|PM/);
});

test("renders a useful empty state when the API returns no recommendations", async ({
  page,
}) => {
  await page.route("**/api/recommendation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...recommendationFixture,
        recommendations: [],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("37.7749").fill("23.5791");
  await page.getByPlaceholder("-122.4194").fill("58.4026");
  await page.getByRole("button", { name: "Use coordinates" }).click();

  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "No recommendations found" }),
  ).toBeVisible();
  await expect(
    page.getByText("Try a wider radius or a different activity."),
  ).toBeVisible();
});

test("keeps the main scouting flow usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/recommendation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationFixture),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("37.7749").fill("23.5791");
  await page.getByPlaceholder("-122.4194").fill("58.4026");
  await page.getByRole("button", { name: "Use coordinates" }).click();

  await page.getByPlaceholder("Search activities").fill("portrait");
  await page
    .locator(".composer")
    .getByRole("button", { name: /Quiet portrait/ })
    .click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Your nearby shortlist" }),
  ).toBeVisible();
  await expect(
    page
      .locator("#recommendation-1")
      .getByRole("button", { name: "Copy report" }),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function openFixtureScout(
  page: import("@playwright/test").Page,
  response = recommendationFixture,
): Promise<void> {
  await page.route("**/api/recommendation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Scout Muscat", exact: true }).click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compare your shortlist" }),
  ).toBeVisible();
}

test("turns a choice into a persistent field plan and usable exports", async ({
  page,
}) => {
  await openFixtureScout(page);
  await page
    .getByRole("button", { name: "Plan Azaiba Beach Park", exact: true })
    .click();
  await expect(page.locator("#field-plan h2")).toBeFocused();
  await page
    .getByLabel("Shoot notes")
    .fill("Bring 35mm lens; check water, light.");
  await page
    .getByLabel("Confirm access, opening hours and any permits")
    .check();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Shoot notes")).toHaveValue(
    "Bring 35mm lens; check water, light.",
  );
  await expect(
    page.getByLabel("Confirm access, opening hours and any permits"),
  ).toBeChecked();
  const calendarPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Add light window to calendar" })
    .click();
  const calendar = await calendarPromise;
  const calendarText = await readFile((await calendar.path())!, "utf8");
  expect(calendarText).toContain("BEGIN:VCALENDAR");
  expect(calendarText).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  expect(calendarText).toContain("GEO:23.6019;58.3912");
  const unfolded = calendarText
    .split(String.fromCharCode(13, 10) + " ")
    .join("");
  for (const line of calendarText.split(String.fromCharCode(13, 10)))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  expect(unfolded).toContain("Bring 35mm lens\\; check water\\, light.");
  expect(calendarText.endsWith(String.fromCharCode(13, 10))).toBe(true);
  const briefPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download field brief" }).click();
  const brief = await briefPromise;
  const text = await readFile((await brief.path())!, "utf8");
  expect(text).toContain("- [x] Confirm access");
  expect(text).toContain("Bring 35mm lens");
  const href = await page
    .getByRole("link", { name: "Open share link" })
    .getAttribute("href");
  const shared = Buffer.from(
    new URL(href!).searchParams.get("share")!,
    "base64url",
  ).toString("utf8");
  expect(shared).not.toContain("35mm");
  expect(JSON.parse(shared)).not.toHaveProperty("fieldPlan");
});

test("changing a planned place resets location checks and keeps shoot notes", async ({
  page,
}) => {
  const first = recommendationFixture.recommendations[0]!;
  await openFixtureScout(page, {
    ...recommendationFixture,
    recommendations: [
      first,
      { ...first, rank: 2, location_name: "Backup park", latitude: 23.62 },
    ],
  });
  await page
    .getByRole("button", { name: "Choose Azaiba Beach Park", exact: true })
    .click();
  await page.getByLabel("Shoot notes").fill("Portrait series");
  await page
    .getByLabel("Check the actual route, parking and travel time")
    .check();
  await page
    .getByRole("button", { name: "Choose Backup park", exact: true })
    .click();
  await expect(page.locator("#field-plan h3")).toHaveText("Backup park");
  await expect(
    page.getByLabel("Check the actual route, parking and travel time"),
  ).not.toBeChecked();
  await expect(page.getByLabel("Shoot notes")).toHaveValue("Portrait series");
});

test("live destination lookup supports origins beyond the built-in list", async ({
  page,
}) => {
  await page.route("**/api/destinations?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          name: "Tampa",
          region: "Florida, United States",
          latitude: 27.95,
          longitude: -82.46,
          kind: "City",
          description: "OpenStreetMap search result",
          tags: [],
          featured: false,
        },
      ]),
    }),
  );
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Destination" }).fill("Tampa");
  await page
    .getByRole("button", { name: "Tampa, Florida, United States City" })
    .click();
  await page.getByRole("button", { name: "Scout Tampa" }).click();
  await expect(page.locator("#active-session-title")).toHaveText(
    "Tampa, Florida, United States",
  );
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue(
    "Tampa, Florida, United States",
  );
});

test("mobile navigation and settings trap focus and close with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open sessions" }).click();
  await expect(
    page.getByRole("dialog", { name: "Scout sessions" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open sessions" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open sessions" }).click();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close settings" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("#settings-panel") !== null,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Settings" }),
  ).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("old result warnings prevent exporting a passed light window", async ({
  page,
}) => {
  const old = {
    ...recommendationFixture,
    generated_at: "2020-01-01T00:00:00Z",
    recommendations: recommendationFixture.recommendations.map((item) => ({
      ...item,
      best_window: {
        start_utc: "2020-01-01T01:00:00Z",
        end_utc: "2020-01-01T02:00:00Z",
      },
    })),
  };
  await openFixtureScout(page, old);
  await expect(
    page.getByText("This is a saved result.", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .locator("#recommendation-1")
      .getByText("Saved weather", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plan Azaiba Beach Park", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add light window to calendar" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Refresh live recommendations" }),
  ).toBeVisible();
});

test("editing priorities refreshes the search without losing shoot notes", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/recommendation", async (route) => {
    const body = route.request().postDataJSON();
    count++;
    if (count === 2) {
      expect(body.radius_miles).toBe(5);
      expect(body.travel_style).toBe("family");
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recommendationFixture),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scout Muscat", exact: true }).click();
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plan Azaiba Beach Park", exact: true })
    .click();
  await page.getByLabel("Shoot notes").fill("Keep this composition idea");
  await page.getByLabel("Recheck weather before leaving").check();
  await page.locator(".edit-search > summary").click();
  await page.getByLabel("Search radius (mi)").fill("5");
  await page.getByLabel("Prioritize").selectOption("family");
  await page
    .locator(".composer")
    .getByRole("button", { name: "Scout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose a place to make it yours." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plan Azaiba Beach Park", exact: true })
    .click();
  await expect(page.getByLabel("Shoot notes")).toHaveValue(
    "Keep this composition idea",
  );
  await expect(
    page.getByLabel("Recheck weather before leaving"),
  ).not.toBeChecked();
  expect(count).toBe(2);
});
