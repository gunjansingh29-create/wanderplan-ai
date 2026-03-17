import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  accountCacheKey,
  availabilityWindowMatchesTripDays,
  buildCurrentVoteActor,
  buildDurationPlanSignature,
  buildFallbackItinerary,
  buildFlightRoutePlan,
  buildItinerarySavePayload,
  buildTripShareLink,
  buildTripShareSummary,
  buildTripWhatsAppText,
  buildWhatsAppShareUrl,
  canEditVoteForMember,
  canonicalDestinationVoteKeyFromStoredKey,
  canonicalMealVoteKey,
  canonicalPoiVoteKeyFromStoredKey,
  canonicalStayVoteKey,
  companionCheckinMeta,
  dedupeVoteVoters,
  emptyUserState,
  findDuplicatePoiKeys,
  fillMissingDurationPerDestination,
  formatMoney,
  inclusiveIsoDays,
  isCurrentVoteVoter,
  makeVoteUserId,
  mergeAvailabilityDraft,
  mergeProfileIntoUser,
  mergeSharedFlightDates,
  mergeVoteRows,
  moveFlightRouteStop,
  normalizeDestinationVoteState,
  normalizeDiningPlan,
  normalizePoiStateMap,
  normalizePersonalBucketItems,
  readDestinationVoteRow,
  readMealVoteRow,
  readPoiVoteRow,
  readStayVoteRow,
  voteKeyAliasesFor,
  readVoteForVoter,
  receiptItemsTotal,
  resolveAvailabilityDraftWindow,
  resolveBudgetTier,
  resolveTripBudgetTier,
  resolveWizardTripId,
  roundTripFlightRoutePlan,
  sanitizeAvailabilityOverlapData,
  sanitizeAvailabilityWindow,
  sanitizeFlightDatesForTrip,
  shouldResetTravelPlanForDurationChange,
  summarizeDestinationVotes,
  summarizeInterestConsensus,
  summarizeMealVotes,
  summarizePoiVotes,
  summarizeStayVotes,
  stayPreviewLink,
  wizardSyncIntervalMs,
} from "./WanderPlanLLMFlow";
import WanderPlan from "./WanderPlanLLMFlow";

describe("WanderPlanLLMFlow account persistence helpers", () => {
  test("accountCacheKey scopes cached data by token user id or email", () => {
    expect(accountCacheKey("wp-u", "test-token:user-123", "")).toBe(
      "wp-u:uid:user-123"
    );
    expect(accountCacheKey("wp-b", "", "crew@test.com")).toBe(
      "wp-b:email:crew@test.com"
    );
    expect(accountCacheKey("wp-t", "", "")).toBe("wp-t");
  });

  test("mergeProfileIntoUser replaces stale local profile fields with backend profile", () => {
    const merged = mergeProfileIntoUser(
      {
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["family"],
        interests: { hiking: false },
        budget: "luxury",
        dietary: ["Vegan"],
      },
      {
        display_name: "Crew Member",
        travel_styles: ["friends"],
        interests: { hiking: true, food: true },
        budget_tier: "budget",
        dietary: ["Halal"],
      },
      "crew@test.com",
      "Crew Member"
    );

    expect(merged).toEqual({
      name: "Crew Member",
      email: "crew@test.com",
      styles: ["friends"],
      interests: { hiking: true, food: true },
      budget: "budget",
      dietary: ["Halal"],
    });
  });

  test("normalizePersonalBucketItems keeps backend ids on personal bucket entries", () => {
    expect(
      normalizePersonalBucketItems([
        { id: "bucket-1", destination: "Kyoto", name: "Kyoto" },
      ])
    ).toEqual([{ id: "bucket-1", destination: "Kyoto", name: "Kyoto" }]);
  });

  test("wizardSyncIntervalMs uses fast polling for collaborative steps", () => {
    expect(wizardSyncIntervalMs(1)).toBe(1200);
    expect(wizardSyncIntervalMs(2)).toBe(1200);
    expect(wizardSyncIntervalMs(3)).toBe(1200);
    expect(wizardSyncIntervalMs(5)).toBe(1200);
    expect(wizardSyncIntervalMs(6)).toBe(1200);
    expect(wizardSyncIntervalMs(9)).toBe(1200);
    expect(wizardSyncIntervalMs(11)).toBe(1200);
    expect(wizardSyncIntervalMs(12)).toBe(1200);
    expect(wizardSyncIntervalMs(10)).toBe(3000);
    expect(wizardSyncIntervalMs(4)).toBe(3000);
  });

  test("availability helpers require exact trip-length windows", () => {
    expect(inclusiveIsoDays("2026-06-01", "2026-06-10")).toBe(10);
    expect(availabilityWindowMatchesTripDays({ start: "2026-06-01", end: "2026-06-10" }, 10)).toBe(true);
    expect(availabilityWindowMatchesTripDays({ start: "2026-06-01", end: "2026-06-09" }, 10)).toBe(false);
  });

  test("availability sanitizers clear stale locked and flight windows after duration changes", () => {
    expect(
      sanitizeAvailabilityWindow({ start: "2026-03-22", end: "2026-03-30" }, 11)
    ).toBeNull();
    expect(
      sanitizeAvailabilityOverlapData(
        { locked_window: { start: "2026-03-22", end: "2026-03-30" }, is_locked: true },
        11
      )
    ).toEqual({
      locked_window: null,
      is_locked: false,
    });
    expect(
      sanitizeFlightDatesForTrip(
        { origin: "Detroit", arrive: "Auckland", depart: "2026-03-22", ret: "2026-03-30" },
        11
      )
    ).toEqual({
      origin: "Detroit",
      arrive: "Auckland",
      depart: "",
      ret: "",
    });
  });

  test("resolveAvailabilityDraftWindow ignores stale member and flight windows", () => {
    expect(
      resolveAvailabilityDraftWindow(
        {
          locked_window: { start: "2026-03-22", end: "2026-03-30" },
          member_windows: [
            {
              user_id: "crew-1",
              windows: [{ start: "2026-03-22", end: "2026-03-30" }],
            },
          ],
        },
        "crew-1",
        { depart: "2026-03-22", ret: "2026-03-30" },
        11
      )
    ).toEqual({ start: "", end: "" });
  });

  test("mergeAvailabilityDraft preserves in-progress manual date edits during polling", () => {
    expect(
      mergeAvailabilityDraft(
        { start: "2026-04-01", end: "" },
        { start: "", end: "" },
        11,
        false
      )
    ).toEqual({ start: "2026-04-01", end: "" });
    expect(
      mergeAvailabilityDraft(
        { start: "2026-04-01", end: "2026-04-11" },
        { start: "2026-05-01", end: "2026-05-11" },
        11,
        true
      )
    ).toEqual({ start: "2026-05-01", end: "2026-05-11" });
  });

  test("mergeSharedFlightDates keeps typed city names while syncing locked dates", () => {
    expect(
      mergeSharedFlightDates(
        { origin: "Detroit", arrive: "Auckland", final_airport: "Detroit", depart: "2026-06-01", ret: "2026-06-10" },
        { origin: "DTW", arrive: "AKL", final_airport: "LAX", depart: "2026-06-03", ret: "2026-06-12" },
        true
      )
    ).toEqual({
      origin: "Detroit",
      arrive: "Auckland",
      final_airport: "Detroit",
      depart: "2026-06-03",
      ret: "2026-06-12",
    });
  });

  test("buildFlightRoutePlan autofills destination dates from locked start and per-destination durations", () => {
    expect(
      buildFlightRoutePlan(
        [{ name: "Auckland" }, { name: "Melbourne" }, { name: "Queenstown" }, { name: "Sydney" }],
        { Auckland: 4, Melbourne: 3, Queenstown: 2, Sydney: 2 },
        { start: "2026-03-22", end: "2026-04-01" },
        []
      )
    ).toEqual([
      { destination: "Auckland", airport: "Auckland", travel_date: "2026-03-22" },
      { destination: "Melbourne", airport: "Melbourne", travel_date: "2026-03-26" },
      { destination: "Queenstown", airport: "Queenstown", travel_date: "2026-03-29" },
      { destination: "Sydney", airport: "Sydney", travel_date: "2026-03-31" },
    ]);
  });

  test("moveFlightRouteStop reorders destinations and recalculates autofilled dates", () => {
    const moved = moveFlightRouteStop(
      [
        { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
        { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-26" },
        { destination: "Queenstown", airport: "ZQN", travel_date: "2026-03-29" },
      ],
      2,
      -1,
      { Auckland: 4, Queenstown: 2, Melbourne: 3 },
      { start: "2026-03-22", end: "2026-04-01" }
    );
    expect(moved).toEqual([
      { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
      { destination: "Queenstown", airport: "ZQN", travel_date: "2026-03-26" },
      { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-28" },
    ]);
  });

  test("buildFlightRoutePlan preserves a manual destination date override and shifts later stops", () => {
    expect(
      buildFlightRoutePlan(
        [{ name: "Auckland" }, { name: "Melbourne" }, { name: "Queenstown" }],
        { Auckland: 4, Melbourne: 3, Queenstown: 2 },
        { start: "2026-03-22", end: "2026-04-01" },
        [
          { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
          { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-27", manual_date: true },
          { destination: "Queenstown", airport: "ZQN", travel_date: "2026-03-29" },
        ]
      )
    ).toEqual([
      { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
      { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-27", manual_date: true },
      { destination: "Queenstown", airport: "ZQN", travel_date: "2026-03-30" },
    ]);
  });

  test("roundTripFlightRoutePlan appends the first destination as the return-through stop", () => {
    expect(
      roundTripFlightRoutePlan(
        [
          { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
          { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-26" },
          { destination: "Sydney", airport: "SYD", travel_date: "2026-03-31" },
        ],
        "2026-04-01"
      )
    ).toEqual([
      { destination: "Auckland", airport: "AKL", travel_date: "2026-03-22" },
      { destination: "Melbourne", airport: "MEL", travel_date: "2026-03-26" },
      { destination: "Sydney", airport: "SYD", travel_date: "2026-03-31" },
      { destination: "Auckland", airport: "AKL", travel_date: "2026-04-01", is_return_stop: true },
    ]);
  });

  test("fillMissingDurationPerDestination recovers a full duration map from total trip days", () => {
    expect(
      fillMissingDurationPerDestination(
        ["Auckland", "Melbourne", "Queenstown", "Sydney"],
        {},
        11
      )
    ).toEqual({
      Auckland: 2,
      Melbourne: 2,
      Queenstown: 2,
      Sydney: 1,
    });
  });

  test("buildFallbackItinerary creates a non-empty itinerary when LLM output is unavailable", () => {
    const rows = buildFallbackItinerary(
      [{ name: "Auckland" }, { name: "Melbourne" }],
      [{ name: "Sky Tower", destination: "Auckland", cost: 35 }],
      [{ name: "Harbour Hotel", destination: "Auckland" }],
      [{ name: "Depot", destination: "Auckland", type: "Dinner", cost: 42 }],
      6,
      "2026-03-22",
      { Auckland: 2, Melbourne: 2 }
    );
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      day: 1,
      date: "2026-03-22",
      destination: "Auckland",
    });
    expect(rows.some((day) => day.destination === "Melbourne")).toBe(true);
    expect(rows.every((day) => Array.isArray(day.items) && day.items.length > 0)).toBe(true);
  });

  test("buildItinerarySavePayload maps itinerary rows into backend save shape", () => {
    const payload = buildItinerarySavePayload([
      {
        day: 1,
        date: "2026-06-01",
        destination: "Tokyo",
        theme: "Arrival day",
        items: [
          { time: "09:00", type: "flight", title: "Land in Tokyo", cost: 0 },
          { time: "13:00", type: "checkin", title: "Check in at hotel", cost: 0 },
        ],
      },
    ]);
    expect(payload).toEqual({
      days: [
        {
          day: 1,
          date: "2026-06-01",
          destination: "Tokyo",
          theme: "Arrival day",
          items: [
            { time: "09:00", type: "flight", title: "Land in Tokyo", cost: 0 },
            { time: "13:00", type: "checkin", title: "Check in at hotel", cost: 0 },
          ],
        },
      ],
    });
  });

  test("trip share helpers build summary, link, and WhatsApp URL", () => {
    const originalWindow = global.window;
    Object.defineProperty(global, "window", {
      value: {
        location: { origin: "https://wanderplan.example" },
      },
      configurable: true,
    });
    try {
      const trip = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Spring 2026",
        destNames: "Auckland + Queenstown",
        dates: "Mar 22 - Apr 1",
        days: 11,
        members: [{ id: "m1" }],
        status: "active",
      };
      expect(buildTripShareLink(trip, "accept")).toContain("join_trip_id=11111111-1111-4111-8111-111111111111");
      expect(buildTripShareSummary(trip)).toContain("WanderPlan trip: Spring 2026");
      expect(buildTripWhatsAppText(trip)).toContain("Join trip:");
      expect(buildWhatsAppShareUrl("hello world")).toBe("https://wa.me/?text=hello%20world");
    } finally {
      Object.defineProperty(global, "window", { value: originalWindow, configurable: true });
    }
  });

  test("stayPreviewLink prefers exact booking URL and falls back to property search", () => {
    expect(
      stayPreviewLink({
        name: "Harbor House",
        destination: "Auckland",
        bookingUrl: "https://booking.example/harbor-house",
      })
    ).toBe("https://booking.example/harbor-house");

    expect(
      stayPreviewLink({
        name: "Harbor House",
        destination: "Auckland",
        bookingSource: "Booking.com",
      })
    ).toContain("google.com/search?q=");
  });

  test("normalizeDiningPlan expands meal options and keeps ratings", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Auckland",
        meals: [
          {
            type: "Breakfast",
            name: "Harbor Brunch",
            cuisine: "Cafe",
            cost: 24,
            rating: 4.7,
          },
        ],
      },
    ]);
    expect(out[0].meals[0].options.length).toBeGreaterThanOrEqual(3);
    expect(out[0].meals[0].rating).toBe(4.7);
    expect(out[0].meals[0].options[0]).toEqual(
      expect.objectContaining({ name: "Harbor Brunch", rating: 4.7 })
    );
  });

  test("receipt helpers total parsed items and format budget values", () => {
    expect(
      receiptItemsTotal([
        { amount: 18.5 },
        { amount: "21.25" },
        { amount: 0 },
      ])
    ).toBeCloseTo(39.75);
    expect(formatMoney(39.75, "USD")).toContain("39.75");
    expect(companionCheckinMeta("done").label).toBe("Done");
  });

  test("resolveBudgetTier prefers trip member profile budget tier", () => {
    expect(
      resolveBudgetTier(
        { profile: { budget_tier: "premium" }, budget: "budget" },
        "moderate"
      )
    ).toBe("premium");
    expect(resolveBudgetTier({}, "luxury")).toBe("luxury");
  });

  test("resolveTripBudgetTier prefers organizer-selected shared budget tier", () => {
    expect(resolveTripBudgetTier("premium", "budget")).toBe("premium");
    expect(resolveTripBudgetTier("", "luxury")).toBe("luxury");
  });

  test("duration plan signature changes when destinations or total days change", () => {
    expect(buildDurationPlanSignature(["Tokyo", "Kyoto"], 10)).toBe("tokyo|kyoto::10");
    expect(buildDurationPlanSignature(["Tokyo", "Osaka", "Kyoto"], 12)).toBe("tokyo|osaka|kyoto::12");
  });

  test("shouldResetTravelPlanForDurationChange resets stale availability and flights", () => {
    expect(shouldResetTravelPlanForDurationChange("tokyo|kyoto::10", "tokyo|osaka|kyoto::12", 10, 12)).toBe(true);
    expect(shouldResetTravelPlanForDurationChange("", "", 10, 12)).toBe(true);
    expect(shouldResetTravelPlanForDurationChange("tokyo|kyoto::10", "tokyo|kyoto::10", 10, 10)).toBe(false);
  });

  test("resolveWizardTripId falls back to newTrip id when currentTripId is missing", () => {
    expect(
      resolveWizardTripId("", { id: "trip-from-new-trip" })
    ).toBe("trip-from-new-trip");
    expect(
      resolveWizardTripId("", { id: "trip-from-new-trip" }, { id: "trip-from-view" })
    ).toBe("trip-from-view");
    expect(
      resolveWizardTripId("trip-from-current", { id: "trip-from-new-trip" }, { id: "trip-from-view" })
    ).toBe("trip-from-current");
  });
});

describe("WanderPlanLLMFlow vote identity helpers", () => {
  test("makeVoteUserId prefers user id, then email fallback", () => {
    expect(makeVoteUserId("u-123", "a@test.com", "member-1")).toBe("u-123");
    expect(makeVoteUserId("", "a@test.com", "member-1")).toBe("email:a@test.com");
    expect(makeVoteUserId("", "", "member-1")).toBe("member-1");
  });

  test("voteKeyAliasesFor returns unique aliases for id/userId/email", () => {
    expect(
      voteKeyAliasesFor({
        id: "email:bob@test.com",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      })
    ).toEqual([
      "email:bob@test.com",
      "00000000-0000-0000-0000-000000000002",
    ]);
  });

  test("readVoteForVoter resolves vote by any alias key", () => {
    const voter = {
      id: "email:bob@test.com",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };

    expect(
      readVoteForVoter(
        { "00000000-0000-0000-0000-000000000002": "up" },
        voter
      )
    ).toBe("up");
    expect(readVoteForVoter({ "email:bob@test.com": "down" }, voter)).toBe(
      "down"
    );
  });

  test("readVoteForVoter normalizes yes/no to up/down", () => {
    const voter = { id: "u-1" };
    expect(readVoteForVoter({ "u-1": "yes" }, voter)).toBe("up");
    expect(readVoteForVoter({ "u-1": "no" }, voter)).toBe("down");
  });

  test("isCurrentVoteVoter matches on any shared alias", () => {
    const current = {
      id: "email:bob@test.com",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    const voter = {
      id: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    expect(isCurrentVoteVoter(voter, current)).toBe(true);
  });

  test("canEditVoteForMember always allows organizer veto access", () => {
    const current = {
      id: "email:organizer@test.com",
      userId: "00000000-0000-0000-0000-000000000001",
      email: "organizer@test.com",
    };
    const crew = {
      id: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    expect(canEditVoteForMember(crew, current, true)).toBe(true);
    expect(canEditVoteForMember(crew, current, false)).toBe(false);
  });

  test("dedupeVoteVoters merges the same member represented by uuid and email aliases", () => {
    expect(
      dedupeVoteVoters([
        {
          id: "email:bob@test.com",
          email: "bob@test.com",
          name: "Bob Email",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          userId: "00000000-0000-0000-0000-000000000002",
          email: "bob@test.com",
          name: "Bob UUID",
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: "email:bob@test.com",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      }),
    ]);
  });

  test("buildCurrentVoteActor avoids transient me id for synced trips", () => {
    expect(
      buildCurrentVoteActor(
        "test-token:user-123",
        { email: "" },
        "00000000-0000-0000-0000-000000000111"
      )
    ).toEqual({
      id: "user-123",
      userId: "user-123",
      email: "",
    });
    expect(
      buildCurrentVoteActor(
        "",
        { email: "crew@test.com" },
        "00000000-0000-0000-0000-000000000111"
      )
    ).toEqual({
      id: "email:crew@test.com",
      userId: "",
      email: "crew@test.com",
    });
    expect(
      buildCurrentVoteActor("", { email: "" }, "")
    ).toEqual({
      id: "me",
      userId: "",
      email: "",
    });
  });

  test("mergeVoteRows combines votes stored under multiple destination aliases", () => {
    expect(
      mergeVoteRows(
        {
          "dest:auckland": { "user-a": "up" },
          "trip-dest-0-auckland": { "user-b": "down" },
        },
        ["dest:auckland", "trip-dest-0-auckland"]
      )
    ).toEqual({
      "user-a": "up",
      "user-b": "down",
    });
  });

  test("canonicalDestinationVoteKeyFromStoredKey maps legacy trip destination ids to canonical keys", () => {
    expect(canonicalDestinationVoteKeyFromStoredKey("trip-dest-0-auckland")).toBe(
      "dest:auckland"
    );
    expect(canonicalDestinationVoteKeyFromStoredKey("dest:sydney")).toBe(
      "dest:sydney"
    );
    expect(canonicalDestinationVoteKeyFromStoredKey("custom-row")).toBe(
      "custom-row"
    );
  });

  test("normalizeDestinationVoteState collapses legacy and canonical destination rows", () => {
    expect(
      normalizeDestinationVoteState({
        "trip-dest-0-auckland": {
          "user-a": "up",
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "email:crew@test.com": "up",
          "user-b": "up",
        },
      })
    ).toEqual({
      "dest:auckland": {
        "user-a": "up",
        "email:crew@test.com": "up",
        "user-b": "up",
      },
    });
  });

  test("readDestinationVoteRow merges canonical and legacy destination keys", () => {
    const row = readDestinationVoteRow(
      {
        "dest:auckland": { "user-a": "up" },
        "trip-dest-0-auckland": { "user-b": "up" },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" }
    );
    expect(row["user-a"]).toBe("up");
    expect(row["user-b"]).toBe("up");
  });

  test("readDestinationVoteRow lets canonical destination votes override stale legacy rows", () => {
    const row = readDestinationVoteRow(
      {
        "trip-dest-0-auckland": {
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "email:crew@test.com": "up",
        },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" }
    );
    expect(row["email:crew@test.com"]).toBe("up");
  });

  test("summarizeDestinationVotes counts 2 of 2 yes votes as complete majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:auckland": { "user-a": "up", "user-b": "up" },
      },
      { name: "Auckland", vote_key: "dest:auckland" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes treats split votes as complete but not majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:sydney": { "user-a": "up", "user-b": "down" },
      },
      { name: "Sydney", vote_key: "dest:sydney" },
      voters,
      2
    );
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(false);
  });

  test("summarizeDestinationVotes keeps incomplete voting out of majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:melbourne": { "user-a": "up" },
      },
      { name: "Melbourne", vote_key: "dest:melbourne" },
      voters,
      2
    );
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(1);
    expect(summary.allVoted).toBe(false);
    expect(summary.majorityWin).toBe(false);
  });

  test("summarizeDestinationVotes handles alias-mixed rows for 3 voters", () => {
    const voters = [
      { id: "email:organizer@test.com", email: "organizer@test.com" },
      { id: "00000000-0000-0000-0000-000000000002", userId: "00000000-0000-0000-0000-000000000002", email: "bob@test.com" },
      { id: "user-c" },
    ];
    const summary = summarizeDestinationVotes(
      {
        "dest:queenstown": {
          "email:organizer@test.com": "up",
        },
        "trip-dest-0-queenstown": {
          "00000000-0000-0000-0000-000000000002": "up",
          "user-c": "down",
        },
      },
      { name: "Queenstown", vote_key: "dest:queenstown", id: "trip-dest-0-queenstown" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(3);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes dedupes overlapping voter aliases before counting", () => {
    const voters = [
      { id: "user-a" },
      { id: "email:bob@test.com", email: "bob@test.com" },
      {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      },
    ];
    const summary = summarizeDestinationVotes(
      {
        "dest:kyoto": {
          "user-a": "up",
          "00000000-0000-0000-0000-000000000002": "up",
        },
      },
      { name: "Kyoto", vote_key: "dest:kyoto" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes reflects organizer veto when canonical row flips destination to in", () => {
    const voters = [
      { id: "organizer-1" },
      {
        id: "email:crew@test.com",
        email: "crew@test.com",
      },
    ];
    const summary = summarizeDestinationVotes(
      {
        "trip-dest-0-auckland": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "organizer-1": "up",
          "email:crew@test.com": "up",
        },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes keeps total up/down tally in sync after organizer veto", () => {
    const voters = [
      { id: "organizer-1" },
      { id: "email:crew@test.com", email: "crew@test.com" },
    ];
    const beforeVeto = summarizeDestinationVotes(
      {
        "dest:sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
      },
      { name: "Sydney", vote_key: "dest:sydney", id: "trip-dest-0-sydney" },
      voters,
      2
    );
    const afterVeto = summarizeDestinationVotes(
      {
        "trip-dest-0-sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
        "dest:sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "up",
        },
      },
      { name: "Sydney", vote_key: "dest:sydney", id: "trip-dest-0-sydney" },
      voters,
      2
    );

    expect(beforeVeto.up).toBe(1);
    expect(beforeVeto.down).toBe(1);
    expect(afterVeto.up).toBe(2);
    expect(afterVeto.down).toBe(0);
    expect(afterVeto.votedCount).toBe(2);
    expect(afterVeto.allVoted).toBe(true);
    expect(afterVeto.majorityWin).toBe(true);
  });

  test("findDuplicatePoiKeys flags repeated canonical POIs in the shortlist", () => {
    expect(
      findDuplicatePoiKeys([
        { poi_id: "poi-1", name: "Sky Tower", destination: "Auckland", category: "Culture" },
        { poi_id: "poi-2", name: "Sky Tower", destination: "Auckland", category: "Culture" },
        { name: "Laneway Food Tour", destination: "Melbourne", category: "Food" },
      ])
    ).toEqual([
      expect.objectContaining({
        key: "poi:sky-tower-auckland-culture",
        indexes: [0, 1],
      }),
    ]);
  });

  test("canonicalPoiVoteKeyFromStoredKey maps legacy index keys via known poi lookup", () => {
    expect(
      canonicalPoiVoteKeyFromStoredKey("0", {
        0: { name: "Sky Tower", destination: "Auckland", category: "Culture" },
      })
    ).toBe("poi:sky-tower-auckland-culture");
    expect(
      canonicalPoiVoteKeyFromStoredKey("poi:legacy-id", {
        "poi:legacy-id": { poi_id: "legacy-id", name: "Sky Tower", destination: "Auckland", category: "Culture" },
      })
    ).toBe("poi:sky-tower-auckland-culture");
    expect(canonicalPoiVoteKeyFromStoredKey("poi:abc", {})).toBe("poi:abc");
    expect(canonicalPoiVoteKeyFromStoredKey("missing", {})).toBe("");
  });

  test("normalizePoiStateMap collapses legacy index rows into canonical POI keys", () => {
    expect(
      normalizePoiStateMap(
        {
          0: { "user-a": "up" },
          "poi:legacy-id": { "user-b": "down" },
        },
        [{ poi_id: "legacy-id", name: "Sky Tower", destination: "Auckland", category: "Culture" }],
        {}
      )
    ).toEqual({
      "poi:sky-tower-auckland-culture": {
        "user-a": "up",
        "user-b": "down",
      },
    });
  });

  test("readPoiVoteRow prefers canonical key over legacy index rows", () => {
    const meta = readPoiVoteRow(
      {
        0: { "user-a": "down" },
        "poi:legacy-id": { "user-a": "down" },
        "poi:sky-tower-auckland-culture": { "user-a": "up", "user-b": "up" },
      },
      { poi_id: "legacy-id", name: "Sky Tower", destination: "Auckland", category: "Culture" },
      0
    );
    expect(meta.key).toBe("poi:sky-tower-auckland-culture");
    expect(meta.row).toEqual({ "user-a": "up", "user-b": "up" });
  });

  test("summarizePoiVotes dedupes member aliases and counts synced votes correctly", () => {
    const voters = [
      { id: "organizer-1" },
      { id: "email:crew@test.com", email: "crew@test.com" },
      {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "crew@test.com",
      },
    ];
    const summary = summarizePoiVotes(
      {
        "poi:sky-tower-auckland-culture": {
          "organizer-1": "up",
          "00000000-0000-0000-0000-000000000002": "down",
        },
      },
      { name: "Sky Tower", destination: "Auckland", category: "Culture" },
      0,
      voters
    );
    expect(summary.key).toBe("poi:sky-tower-auckland-culture");
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(2);
    expect(summary.totalVoters).toBe(2);
  });

  test("canonicalStayVoteKey uses stay identity across screens", () => {
    expect(
      canonicalStayVoteKey(
        { name: "Grand Kyoto Palace", destination: "Kyoto", type: "Hotel" },
        0
      )
    ).toBe("stay:grand-kyoto-palace-kyoto-hotel");
  });

  test("readStayVoteRow falls back to legacy index rows", () => {
    const meta = readStayVoteRow(
      {
        0: { "user-a": "up" },
      },
      { name: "Grand Kyoto Palace", destination: "Kyoto", type: "Hotel" },
      0
    );
    expect(meta.key).toBe("stay:grand-kyoto-palace-kyoto-hotel");
    expect(meta.row).toEqual({ "user-a": "up" });
  });

  test("summarizeStayVotes counts shared stay picks correctly", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeStayVotes(
      {
        "stay:grand-kyoto-palace-kyoto-hotel": {
          "user-a": "up",
          "user-b": "down",
        },
      },
      { name: "Grand Kyoto Palace", destination: "Kyoto", type: "Hotel" },
      0,
      voters
    );
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(2);
  });

  test("canonicalMealVoteKey uses stable meal slot identity", () => {
    expect(
      canonicalMealVoteKey(
        { day: 1, destination: "Kyoto" },
        { type: "Dinner", time: "19:00" },
        0,
        0
      )
    ).toBe("meal:1-kyoto-dinner-19-00");
  });

  test("readMealVoteRow falls back to legacy day-meal index rows", () => {
    const meta = readMealVoteRow(
      {
        "0-0": { "user-a": "up" },
      },
      { day: 1, destination: "Kyoto" },
      { type: "Dinner", time: "19:00" },
      0,
      0
    );
    expect(meta.key).toBe("meal:1-kyoto-dinner-19-00");
    expect(meta.row).toEqual({ "user-a": "up" });
  });

  test("summarizeMealVotes counts shared meal votes correctly", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeMealVotes(
      {
        "meal:1-kyoto-dinner-19-00": {
          "user-a": "up",
          "user-b": "up",
        },
      },
      { day: 1, destination: "Kyoto" },
      { type: "Dinner", time: "19:00" },
      0,
      0,
      voters
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(2);
  });
});

describe("WanderPlanLLMFlow post-auth hydration", () => {
  const originalFetch = global.fetch;

  function jsonResponse(body) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
  });

  test("crew login replaces stale cached profile and bucket with backend data", async () => {
    window.localStorage.setItem(
      "wp-u",
      JSON.stringify({
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["family"],
        interests: { hiking: false },
        budget: "luxury",
        dietary: ["Vegan"],
      })
    );
    window.localStorage.setItem(
      "wp-b",
      JSON.stringify([
        {
          id: "old-bucket-1",
          name: "Auckland",
          country: "New Zealand",
        },
      ])
    );

    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/auth/login" && method === "POST") {
        return jsonResponse({
          accessToken: "test-token:crew-user",
          name: "Crew Member",
        });
      }
      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Crew Member",
            travel_styles: ["friends"],
            interests: { food: true, culture: true },
            budget_tier: "budget",
            dietary: ["Halal"],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") {
        return jsonResponse({
          items: [
            {
              id: "crew-bucket-1",
              destination: "Kyoto",
              name: "Kyoto",
              country: "Japan",
              tags: ["culture"],
              best_months: [3, 4],
              bestMonths: [3, 4],
              cost_per_day: 180,
              costPerDay: 180,
              best_time_desc: "Spring",
              bestTimeDesc: "Spring",
              cost_note: "Peak blossom season",
              costNote: "Peak blossom season",
            },
          ],
        });
      }
      if (path === "/crew/peer-profiles" && method === "GET") {
        return jsonResponse({ peers: [] });
      }
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({ trips: [] });
      }
      if (path === "/crew/invites/sent" && method === "GET") {
        return jsonResponse({ invites: [] });
      }
      return jsonResponse({});
    });

    render(<WanderPlan />);

    fireEvent.click(await screen.findByText("Start your bucket list"));
    fireEvent.change(await screen.findByPlaceholderText("Email"), {
      target: { value: "crew@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());

    fireEvent.click(screen.getByText("Profile"));
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Crew Member")).not.toBeNull()
    );

    fireEvent.click(screen.getByText("Bucket List"));
    await waitFor(() => expect(screen.queryByText("Kyoto")).not.toBeNull());
    expect(screen.queryByText("Auckland")).toBeNull();

    const scopedUser = JSON.parse(
      window.localStorage.getItem("wp-u:uid:crew-user") || "{}"
    );
    const scopedBucket = JSON.parse(
      window.localStorage.getItem("wp-b:uid:crew-user") || "[]"
    );
    expect(scopedUser.name).toBe("Crew Member");
    expect(scopedUser.email).toBe("crew@test.com");
    expect(scopedBucket).toHaveLength(1);
    expect(scopedBucket[0].name).toBe("Kyoto");
  });
});

describe("WanderPlanLLMFlow companion entry", () => {
  const originalFetch = global.fetch;

  function jsonResponse(body) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
  });

  test("active trip detail opens live companion with shared trip payload", async () => {
    let liveCompanion = {
      trip: {
        id: "11111111-1111-4111-8111-111111111111",
        owner_id: "active-user",
        name: "Active Tokyo Sprint",
        status: "active",
        duration_days: 7,
      },
      is_ready: true,
      readiness_reason: null,
      locked_window: { start: "2026-06-01", end: "2026-06-07" },
      current_step: 14,
      members: [
        {
          user_id: "active-user",
          role: "owner",
          status: "accepted",
          display_name: "Alice Active",
          email: "alice@test.com",
        },
      ],
      today: {
        day_number: 1,
        date: "2026-06-01",
        title: "Arrival Day",
        approved: true,
        items: [
          {
            activity_id: "a-1",
            time_slot: "09:00-10:00",
            title: "Land in Tokyo",
            category: "flight",
            location: "Haneda Airport",
            live_status: "pending",
            live_updated_by_name: null,
          },
        ],
      },
      upcoming: [
        {
          day_number: 2,
          date: "2026-06-02",
          title: "Culture Day",
          approved: true,
          items: [
            {
              activity_id: "a-2",
              time_slot: "10:00-11:30",
              title: "Senso-ji Temple",
              category: "culture",
              location: "Asakusa",
            },
          ],
        },
      ],
      current_item: {
        activity_id: "a-1",
        time_slot: "09:00-10:00",
        title: "Land in Tokyo",
        category: "flight",
        location: "Haneda Airport",
      },
      next_item: {
        activity_id: "a-2",
        time_slot: "13:00-14:00",
        title: "Check in at hotel",
        category: "checkin",
        location: "Shinjuku",
      },
      today_checkins: [
        {
          activity_id: "a-1",
          status: "pending",
          updated_by: null,
          updated_by_name: null,
          updated_at: null,
        },
      ],
      day_progress: {
        total_items: 1,
        done: 0,
        skipped: 0,
        in_progress: 0,
        pending: 1,
        completed_items: 0,
        completion_pct: 0,
        last_updated_at: null,
      },
      stays: [
        {
          destination: "Tokyo",
          name: "Shinjuku Grand",
          type: "Hotel",
          rate_per_night: 220,
          total_nights: 3,
          booking_source: "WanderPlan Search",
          why_this_one: "Central for your first days in Tokyo.",
        },
      ],
      today_meals: [
        {
          day: 1,
          date: "2026-06-01",
          destination: "Tokyo",
          type: "Dinner",
          time: "19:00",
          name: "Izakaya Hanabi",
          cuisine: "Japanese",
          cost: 42,
          note: "Easy walk from the hotel.",
        },
      ],
      expense_summary: {
        currency: "USD",
        daily_target: 180,
        total_budget: 1260,
        spent: 244,
        remaining: 1016,
        warning_active: false,
        today_spent: 61,
        categories: [
          { category: "dining", budget: 315, spent: 61, remaining: 254, over_budget: false },
          { category: "activities", budget: 252, spent: 0, remaining: 252, over_budget: false },
        ],
      },
      recent_expenses: [
        {
          id: "expense-1",
          trip_id: "11111111-1111-4111-8111-111111111111",
          user_id: "active-user",
          expense_date: "2026-06-01",
          merchant: "Haneda Ramen",
          amount: 61,
          currency: "USD",
          category: "dining",
          split_count: 1,
        },
      ],
      expense_member_balances: [
        {
          user_id: "active-user",
          display_name: "Alice Active",
          paid_total: 61,
          share_total: 61,
          net_balance: 0,
        },
      ],
      stats: { day_count: 7, approved_days: 7, item_count: 12 },
    };
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Alice Active",
            travel_styles: ["solo"],
            interests: { culture: true },
            budget_tier: "moderate",
            dietary: [],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") {
        return jsonResponse({ items: [] });
      }
      if (path === "/crew/peer-profiles" && method === "GET") {
        return jsonResponse({ peers: [] });
      }
      if (path === "/crew/invites/sent" && method === "GET") {
        return jsonResponse({ invites: [] });
      }
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({
          trips: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              owner_id: "active-user",
              name: "Active Tokyo Sprint",
              status: "active",
              duration_days: 7,
              my_status: "accepted",
              my_role: "owner",
              destinations: ["Tokyo", "Kyoto"],
              members: [
                {
                  user_id: "active-user",
                  role: "owner",
                  status: "accepted",
                  name: "Alice Active",
                  email: "alice@test.com",
                  profile: { display_name: "Alice Active", budget_tier: "moderate" },
                },
              ],
            },
          ],
        });
      }
      if (path === "/trips/11111111-1111-4111-8111-111111111111" && method === "GET") {
        return jsonResponse({
          trip: {
            id: "11111111-1111-4111-8111-111111111111",
            owner_id: "active-user",
            name: "Active Tokyo Sprint",
            status: "active",
            duration_days: 7,
            members: [],
          },
        });
      }
      if (path === "/trips/11111111-1111-4111-8111-111111111111/companion" && method === "GET") {
        return jsonResponse({
          companion: liveCompanion,
        });
      }
      if (path === "/trips/11111111-1111-4111-8111-111111111111/planning-state" && method === "PUT") {
        const body = JSON.parse(String(options && options.body || "{}"));
        const patch = body && body.state && body.state.companion_checkins && body.state.companion_checkins["a-1"];
        if (patch) {
          liveCompanion = {
            ...liveCompanion,
            today: {
              ...liveCompanion.today,
              items: liveCompanion.today.items.map((item) =>
                item.activity_id === "a-1"
                  ? { ...item, live_status: patch.status, live_updated_by_name: "Alice Active" }
                  : item
              ),
            },
            today_checkins: [
              {
                activity_id: "a-1",
                status: patch.status,
                updated_by: patch.updated_by,
                updated_by_name: "Alice Active",
                updated_at: patch.updated_at,
              },
            ],
            day_progress: {
              total_items: 1,
              done: patch.status === "done" ? 1 : 0,
              skipped: patch.status === "skipped" ? 1 : 0,
              in_progress: patch.status === "in_progress" ? 1 : 0,
              pending: patch.status === "pending" ? 1 : 0,
              completed_items: patch.status === "done" || patch.status === "skipped" ? 1 : 0,
              completion_pct: patch.status === "done" || patch.status === "skipped" ? 100 : 0,
              last_updated_at: patch.updated_at,
            },
          };
        }
        return jsonResponse({ state: body.state || {}, updated_at: "2026-06-01T10:00:00Z" });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:active-user"));
    window.localStorage.setItem(
      "wp-u:uid:active-user",
      JSON.stringify({
        name: "Alice Active",
        email: "alice@test.com",
        styles: ["solo"],
        interests: {},
        budget: "moderate",
        dietary: [],
      })
    );

    render(<WanderPlan />);

    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(await screen.findByText("Active Tokyo Sprint"));
    await waitFor(() =>
      expect(screen.queryByText("Open Live Companion")).not.toBeNull()
    );
    expect(screen.queryByText("Continue Planning")).toBeNull();

    fireEvent.click(screen.getByText("Open Live Companion"));

    await waitFor(() =>
      expect(screen.queryByText("Live Companion")).not.toBeNull()
    );
    await waitFor(() =>
      expect(screen.queryAllByText("Land in Tokyo").length).toBeGreaterThan(0)
    );
    expect(screen.queryByText("LIVE COMPANION SETUP")).toBeNull();
    expect(screen.queryByText("Culture Day")).not.toBeNull();
    expect(screen.queryByText("NOW / NEXT")).not.toBeNull();
    expect(screen.queryByText("TODAY PROGRESS")).not.toBeNull();
    expect(screen.queryByText("QUICK ACTIONS")).not.toBeNull();
    expect(screen.queryByText("Open Itinerary")).not.toBeNull();
    expect(screen.queryByText("Share via WhatsApp")).not.toBeNull();
    expect(screen.queryByText("Copy Trip Summary")).not.toBeNull();
    expect(screen.queryByText("Copy Invite Link")).not.toBeNull();
    expect(screen.queryByText("STAY SNAPSHOT")).not.toBeNull();
    expect(screen.queryByText("Shinjuku Grand")).not.toBeNull();
    expect(screen.queryByText("DINING TODAY")).not.toBeNull();
    expect(screen.queryByText("Izakaya Hanabi")).not.toBeNull();
    expect(screen.queryByText("END-OF-DAY RECEIPTS")).not.toBeNull();
    expect(screen.queryByText("Haneda Ramen")).not.toBeNull();
    expect(screen.queryByText("MANUAL EXPENSE")).not.toBeNull();
    expect(screen.queryByText("WHO PAID VS SHARE")).not.toBeNull();
    expect(screen.queryByText("Save Manual Expense")).not.toBeNull();
    expect(screen.queryAllByText("Pending").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Done" })[0]);

    await waitFor(() =>
      expect(screen.queryByText("Updated by Alice Active")).not.toBeNull()
    );
    expect(screen.queryByText("100%")).not.toBeNull();

    fireEvent.click(screen.getByText("Open Itinerary"));

    await waitFor(() =>
      expect(screen.queryByText("Itinerary")).not.toBeNull()
    );
  });

  test("companion shows recovery state when active trip is not ready", async () => {
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Alice Active",
            travel_styles: ["solo"],
            interests: { culture: true },
            budget_tier: "moderate",
            dietary: [],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") return jsonResponse({ items: [] });
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({
          trips: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              owner_id: "active-user",
              name: "Active Tokyo Sprint",
              status: "active",
              duration_days: 7,
              my_status: "accepted",
              my_role: "owner",
              destinations: ["Tokyo", "Kyoto"],
              members: [],
            },
          ],
        });
      }
      if (path === "/trips/11111111-1111-4111-8111-111111111111" && method === "GET") {
        return jsonResponse({
          trip: {
            id: "11111111-1111-4111-8111-111111111111",
            owner_id: "active-user",
            name: "Active Tokyo Sprint",
            status: "active",
            duration_days: 7,
            members: [],
          },
        });
      }
      if (path === "/trips/11111111-1111-4111-8111-111111111111/companion" && method === "GET") {
        return jsonResponse({
          companion: {
            trip: {
              id: "11111111-1111-4111-8111-111111111111",
              owner_id: "active-user",
              name: "Active Tokyo Sprint",
              status: "active",
              duration_days: 7,
            },
            is_ready: false,
            readiness_reason: "locked_dates_and_itinerary_required",
            locked_window: { start: null, end: null },
            current_step: 4,
            members: [],
            days: [],
            today: null,
            upcoming: [],
            current_item: null,
            next_item: null,
            today_checkins: [],
            day_progress: {},
            stays: [],
            today_meals: [],
            stats: { day_count: 0, approved_days: 0, item_count: 0 },
          },
        });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:active-user"));
    window.localStorage.setItem(
      "wp-u:uid:active-user",
      JSON.stringify({
        name: "Alice Active",
        email: "alice@test.com",
        styles: ["solo"],
        interests: {},
        budget: "moderate",
        dietary: [],
      })
    );

    render(<WanderPlan />);
    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(await screen.findByText("Active Tokyo Sprint"));
    fireEvent.click(await screen.findByText("Open Live Companion"));

    expect(await screen.findByText("LIVE COMPANION SETUP")).not.toBeNull();
    expect(screen.queryByText("TODAY'S PLAN")).toBeNull();
    expect(screen.queryByText("TODAY PROGRESS")).toBeNull();
  });
});

describe("WanderPlanLLMFlow Step 3 interest consensus", () => {
  test("counts only current user + accepted/joined members", () => {
    const members = [
      {
        id: "m-accepted",
        status: "accepted",
        profile: { interests: { hiking: true } },
      },
      {
        id: "m-invited",
        status: "invited",
        profile: { interests: { hiking: true } },
      },
      {
        id: "m-selected-joined",
        status: "selected",
        profile: { interests: { hiking: false } },
      },
      {
        id: "m-accepted-no-answer",
        status: "accepted",
        profile: { interests: {} },
      },
    ];

    const summary = summarizeInterestConsensus(
      "hiking",
      { hiking: true },
      members,
      { "m-selected-joined": true }
    );

    // Included: current user yes, accepted yes, selected+joined no
    expect(summary.yesCount).toBe(2);
    expect(summary.totalCount).toBe(3);
    expect(summary.pct).toBe(67);
  });

  test("returns zero percentage when nobody has a boolean answer", () => {
    const summary = summarizeInterestConsensus(
      "culture",
      {},
      [{ id: "m1", status: "accepted", profile: { interests: {} } }],
      {}
    );
    expect(summary.yesCount).toBe(0);
    expect(summary.totalCount).toBe(0);
    expect(summary.pct).toBe(0);
  });
});
