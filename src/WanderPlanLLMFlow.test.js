import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  accountCacheKey,
  activeTripTravelerCount,
  availabilityWindowMatchesTripDays,
  addTripDestinationValue,
  buildTransitItem,
  buildCurrentVoteActor,
  buildDestinationFallbackPois,
  buildDurationPlanSignature,
  buildFallbackItinerary,
  buildFlightRoutePlan,
  buildItinerarySavePayload,
  buildPOIGroupPrefsFromCrew,
  buildPoiRequestSignature,
  groundPoiRowsWithRoutePlan,
  shouldReplaceWithGroundedNearbyPois,
  buildRoutePlanSignature,
  buildDiningRowsFromSuggestions,
  classifyPoiFailureReason,
  chooseBestItineraryRows,
  buildTripShareLink,
  buildTripShareSummary,
  buildTripWhatsAppText,
  buildWhatsAppShareUrl,
  bucketClarifyMessage,
  bucketQueryAnchorName,
  bucketQueryNeedsSpecificChildren,
  canEditVoteForMember,
  canonicalDestinationVoteKeyFromStoredKey,
  canonicalMealVoteKey,
  canonicalPoiVoteKeyFromStoredKey,
  canonicalStayVoteKey,
  companionCheckinMeta,
  dedupeVoteVoters,
  destinationsNeedingPoiCoverage,
  emptyUserState,
  estimateTransitMinutes,
  findDuplicatePoiKeys,
  fillMissingDurationPerDestination,
  formatMoney,
  inclusiveIsoDays,
  itineraryRowsScore,
  isCurrentVoteVoter,
  makeVoteUserId,
  materializeItineraryDates,
  mergeAvailabilityDraft,
  mergeProfileIntoUser,
  mergeSharedFlightDates,
  mergeVoteRows,
  moveFlightRouteStop,
  normalizeDestinationVoteState,
  normalizeDiningPlan,
  normalizePoiStateMap,
  normalizeRoutePlan,
  normalizeStays,
  normalizePersonalBucketItems,
  normalizeTripDestinationValue,
  normalizeWizardStepIndex,
  orderDestinationsByRoutePlan,
  POI_LLM_TIMEOUT_MS,
  ROUTE_LLM_TIMEOUT_MS,
  poiListNeedsRefresh,
  readDestinationVoteRow,
  readMealVoteRow,
  readPoiVoteRow,
  readStayVoteRow,
  voteKeyAliasesFor,
  readVoteForVoter,
  receiptItemsTotal,
  refineBucketItemsForQuery,
  resolveAvailabilityDraftWindow,
  resolveBudgetTier,
  resolveTripBudgetTier,
  resolveWizardTripId,
  roundTripFlightRoutePlan,
  routePlanDurationMap,
  isManufacturedPoiName,
  resolvePoiVotingDecision,
  sanitizeAvailabilityOverlapData,
  sanitizeAvailabilityWindow,
  sanitizeFlightDatesForTrip,
  shouldAutoGeneratePois,
  shouldSkipPoiAutoGenerate,
  shouldResetTravelPlanForDurationChange,
  summarizeDestinationVotes,
  summarizeInterestConsensus,
  summarizeMealVotes,
  summarizePoiVotes,
  summarizeStayVotes,
  stayPreviewLink,
  trimPoiErrorDetail,
  trimRouteErrorDetail,
  tripDestinationNamesFromValues,
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

  test("normalizePersonalBucketItems drops non-destination bucket entries", () => {
    expect(
      normalizePersonalBucketItems([
        { id: "bucket-1", name: "Kyoto", country: "Japan" },
        { id: "bucket-2", name: "skiing" },
        { id: "bucket-3", name: "northern lights" },
        { id: "bucket-4", name: "South America" },
      ])
    ).toEqual([{ id: "bucket-1", name: "Kyoto", country: "Japan" }]);
  });

  test("bucketQueryNeedsSpecificChildren detects city-list style requests", () => {
    expect(bucketQueryNeedsSpecificChildren("popular tourist cities in Japan")).toBe(true);
    expect(bucketQueryNeedsSpecificChildren("Kyoto")).toBe(false);
  });

  test("bucketQueryAnchorName extracts trailing scope from request", () => {
    expect(bucketQueryAnchorName("popular tourist cities in Japan")).toBe("japan");
    expect(bucketQueryAnchorName("best places for food in Mexico")).toBe("mexico");
  });

  test("refineBucketItemsForQuery removes broad parent destination echoes", () => {
    expect(
      refineBucketItemsForQuery("popular tourist cities in Japan", [
        { name: "Japan", country: "" },
        { name: "Kyoto", country: "Japan" },
        { name: "Osaka", country: "Japan" },
      ])
    ).toEqual([
      { name: "Kyoto", country: "Japan" },
      { name: "Osaka", country: "Japan" },
    ]);
  });

  test("refineBucketItemsForQuery removes known non-destination phrases", () => {
    expect(
      refineBucketItemsForQuery("bucket ideas", [
        { name: "Kyoto", country: "Japan" },
        { name: "street markets", country: "" },
        { name: "mountain views", country: "" },
      ])
    ).toEqual([{ name: "Kyoto", country: "Japan" }]);
  });

  test("bucketClarifyMessage nudges user toward specific places inside scope", () => {
    expect(bucketClarifyMessage("popular tourist cities in Japan")).toMatch(/specific cities, islands, or regions in Japan/i);
  });

  test("buildPoiRequestSignature changes when destinations or traveler profile inputs change", () => {
    const base = buildPoiRequestSignature(
      [{ name: "Kyoto", country: "Japan" }],
      { culture: true, food: false },
      "moderate",
      ["Vegetarian"],
      {
        extraYes: ["temples"],
        extraNo: [],
        dietary: [],
        memberSummaries: ["Crew: likes temples"],
      }
    );

    const updated = buildPoiRequestSignature(
      [
        { name: "Kyoto", country: "Japan" },
        { name: "Osaka", country: "Japan" },
      ],
      { culture: true, food: true },
      "budget",
      ["Vegetarian"],
      {
        extraYes: ["temples"],
        extraNo: ["nightlife"],
        dietary: [],
        memberSummaries: ["Crew: likes temples; avoids nightlife"],
      }
    );

    expect(updated).not.toBe(base);
    expect(base).toMatch(/grounded-nearby-sites-v1/);
  });

  test("poiListNeedsRefresh detects signature mismatch and destination drift", () => {
    const rows = [
      { name: "Fushimi Inari Shrine", destination: "Kyoto" },
      { name: "Dotonbori Food Walk", destination: "Osaka" },
    ];

    expect(
      poiListNeedsRefresh("sig-a", "sig-b", rows, [
        { name: "Kyoto" },
        { name: "Osaka" },
      ])
    ).toBe(true);

    expect(
      poiListNeedsRefresh("sig-a", "sig-a", rows, [
        { name: "Kyoto" },
        { name: "Osaka" },
        { name: "Nara" },
      ])
    ).toBe(true);

    expect(
      poiListNeedsRefresh("sig-a", "sig-a", rows, [
        { name: "Kyoto" },
        { name: "Osaka" },
      ])
    ).toBe(false);
  });

  test("poiListNeedsRefresh stays false when every destination already has enough POIs", () => {
    const rows = [
      { name: "Kiyomizu-dera", destination: "Kyoto" },
      { name: "Nishiki Market", destination: "Kyoto" },
      { name: "Gion Evening Walk", destination: "Kyoto" },
      { name: "Arashiyama Bamboo Grove", destination: "Kyoto" },
      { name: "Dotonbori", destination: "Osaka" },
      { name: "Osaka Castle", destination: "Osaka" },
      { name: "Shinsekai Food Crawl", destination: "Osaka" },
      { name: "Umeda Sky Building", destination: "Osaka" },
    ];

    expect(
      poiListNeedsRefresh("sig-a", "sig-b", rows, [
        { name: "Kyoto" },
        { name: "Osaka" },
      ])
    ).toBe(false);
  });

  test("poiListNeedsRefresh treats destination qualifiers as the same place", () => {
    const rows = [
      { name: "Temple Route Walk", destination: "Grishneshwar" },
      { name: "Ancient Cave Circuit", destination: "Grishneshwar" },
      { name: "Pilgrim Heritage Trail", destination: "Grishneshwar" },
      { name: "Evening Aarti Experience", destination: "Grishneshwar" },
      { name: "Ritual Viewing", destination: "Kedarnath" },
      { name: "Pilgrim Trail", destination: "Kedarnath" },
      { name: "Mountain Prayer Walk", destination: "Kedarnath" },
      { name: "Temple Courtyard History Tour", destination: "Kedarnath" },
    ];

    expect(
      poiListNeedsRefresh("sig-a", "sig-b", rows, [
        { name: "Grishneshwar (Aurangabad)" },
        { name: "Kedarnath" },
      ])
    ).toBe(false);
  });

  test("isManufacturedPoiName detects generic destination filler rows", () => {
    expect(isManufacturedPoiName("Somnath Heritage Walk", "Somnath")).toBe(true);
    expect(isManufacturedPoiName("Bhalka Tirth", "Somnath")).toBe(false);
  });

  test("shouldReplaceWithGroundedNearbyPois prefers route planner nearby sites over manufactured rows", () => {
    const rows = [
      { name: "Somnath Heritage Walk" },
      { name: "Somnath Temple Darshan and Orientation Walk" },
    ];
    const routePlan = {
      destinations: [
        {
          destination: "Somnath",
          nearbySites: ["Bhalka Tirth", "Triveni Sangam", "Somnath Beach"],
        },
      ],
    };

    expect(shouldReplaceWithGroundedNearbyPois(rows, { name: "Somnath" }, routePlan)).toBe(true);
    expect(
      shouldReplaceWithGroundedNearbyPois(
        [{ name: "Bhalka Tirth" }, { name: "Triveni Sangam" }],
        { name: "Somnath" },
        routePlan
      )
    ).toBe(false);
  });

  test("groundPoiRowsWithRoutePlan replaces manufactured rows with route nearby sites", () => {
    const rows = [
      { name: "Somnath Heritage Walk", destination: "Somnath", category: "Culture", duration: "2h", cost: 0, rating: 4.2 },
      { name: "Somnath Temple Darshan and Orientation Walk", destination: "Somnath", category: "Culture", duration: "2h", cost: 0, rating: 4.1 },
    ];
    const routePlan = {
      destinations: [
        {
          destination: "Somnath",
          nearbySites: ["Bhalka Tirth", "Triveni Sangam", "Somnath Beach"],
        },
      ],
    };

    const grounded = groundPoiRowsWithRoutePlan(
      rows,
      routePlan,
      { culture: true },
      "moderate",
      [],
      {}
    );

    expect(grounded.map((row) => row.name)).toEqual([
      "Bhalka Tirth",
      "Triveni Sangam",
      "Somnath Beach",
    ]);
    expect(grounded.every((row) => row.failureReason === "route_plan_grounded")).toBe(true);
  });

  test("classifyPoiFailureReason treats backend timeout details as timed_out", () => {
    expect(
      classifyPoiFailureReason(
        "provider_error",
        "LLM proxy HTTP 504: LLM error: TimeoutError contacting Anthropic"
      )
    ).toBe("timed_out");
    expect(classifyPoiFailureReason("provider_error", "LLM proxy HTTP 529")).toBe(
      "provider_error"
    );
  });

  test("trimPoiErrorDetail preserves readable provider detail and timeout exceeds backend window", () => {
    expect(trimPoiErrorDetail("Error: LLM proxy HTTP 504: LLM error: TimeoutError contacting Anthropic")).toBe(
      "LLM proxy HTTP 504: LLM error: TimeoutError contacting Anthropic"
    );
    expect(POI_LLM_TIMEOUT_MS).toBeGreaterThan(30000);
  });

  test("trimRouteErrorDetail preserves readable provider detail and route timeout exceeds backend window", () => {
    expect(trimRouteErrorDetail("Error: LLM proxy HTTP 504: LLM error: TimeoutError contacting Anthropic")).toBe(
      "LLM proxy HTTP 504: LLM error: TimeoutError contacting Anthropic"
    );
    expect(trimRouteErrorDetail("")).toBe("Could not build a route plan yet. Try again in a moment.");
    expect(ROUTE_LLM_TIMEOUT_MS).toBeGreaterThan(60000);
  });

  test("resolvePoiVotingDecision keeps all POIs eligible while respecting votes and prior decisions", () => {
    expect(resolvePoiVotingDecision("", { up: 2, down: 0 }, {})).toBe("yes");
    expect(resolvePoiVotingDecision("", { up: 0, down: 2 }, {})).toBe("no");
    expect(resolvePoiVotingDecision("yes", { up: 0, down: 0 }, {})).toBe("yes");
    expect(resolvePoiVotingDecision("no", { up: 0, down: 0 }, {})).toBe("no");
    expect(resolvePoiVotingDecision("", { up: 0, down: 0 }, { "member-1": "yes" })).toBe("yes");
    expect(resolvePoiVotingDecision("", { up: 0, down: 0 }, { "member-1": "no" })).toBe("no");
    expect(resolvePoiVotingDecision("", { up: 0, down: 0 }, {})).toBe("yes");
  });

  test("poiListNeedsRefresh ignores extra POIs from removed destinations when current ones are covered", () => {
    const rows = [
      { name: "Temple Route Walk", destination: "Grishneshwar" },
      { name: "Ancient Cave Circuit", destination: "Grishneshwar" },
      { name: "Pilgrim Heritage Trail", destination: "Grishneshwar" },
      { name: "Evening Aarti Experience", destination: "Grishneshwar" },
      { name: "Ritual Viewing", destination: "Kedarnath" },
      { name: "Pilgrim Trail", destination: "Kedarnath" },
      { name: "Mountain Prayer Walk", destination: "Kedarnath" },
      { name: "Temple Courtyard History Tour", destination: "Kedarnath" },
      { name: "Old Destination Extra", destination: "Nageshwar" },
    ];

    expect(
      poiListNeedsRefresh("sig-a", "sig-b", rows, [
        { name: "Grishneshwar (Aurangabad)" },
        { name: "Kedarnath" },
      ])
    ).toBe(false);
  });

  test("destinationsNeedingPoiCoverage flags newly added or under-covered destinations", () => {
    const rows = [
      { name: "Fushimi Inari Shrine", destination: "Kyoto" },
      { name: "Arashiyama Bamboo Grove", destination: "Kyoto" },
      { name: "Dotonbori Food Walk", destination: "Osaka" },
    ];

    expect(
      destinationsNeedingPoiCoverage(rows, [
        { name: "Kyoto" },
        { name: "Osaka" },
        { name: "Nara" },
      ], 2).map((d) => d.name)
    ).toEqual(["Osaka", "Nara"]);
  });

  test("buildPOIGroupPrefsFromCrew summarizes accepted traveler profile inputs for prompts", () => {
    expect(
      buildPOIGroupPrefsFromCrew([
        {
          name: "Crew One",
          profile: {
            interests: { hiking: true, nightlife: false },
            dietary: ["Vegetarian"],
            budget_tier: "budget",
          },
        },
      ])
    ).toEqual({
      extraYes: ["hiking"],
      extraNo: ["nightlife"],
      dietary: ["Vegetarian"],
      memberSummaries: [
        "Crew One: likes hiking; avoids nightlife; dietary Vegetarian; budget budget",
      ],
    });
  });

  test("buildDestinationFallbackPois stays destination-specific and returns themed rows", () => {
    const rows = buildDestinationFallbackPois(
      { name: "Kedarnath", country: "India" },
      { spiritual: true },
      "moderate",
      [],
      {}
    );

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.destination === "Kedarnath")).toBe(true);
    expect(rows.some((row) => /Temple|Sacred|Aarti|Heritage/i.test(row.name))).toBe(true);
  });

  test("buildDestinationFallbackPois prefers food-forward options when food is the only selected interest", () => {
    const rows = buildDestinationFallbackPois(
      { name: "Osaka", country: "Japan" },
      { food: true },
      "budget",
      [],
      {}
    );

    expect(rows).toHaveLength(4);
    expect(rows.some((row) => row.category === "Food")).toBe(true);
    expect(rows.some((row) => /Food|Market|Cuisine|Dinner/i.test(row.name))).toBe(true);
  });

  test("shouldAutoGeneratePois only triggers for empty step 6 wizard state", () => {
    expect(
      shouldAutoGeneratePois("wizard", 6, [], false, false, false, [{ name: "Kyoto" }])
    ).toBe(true);
    expect(
      shouldAutoGeneratePois("wizard", 6, [{ name: "Fushimi Inari" }], false, false, false, [{ name: "Kyoto" }])
    ).toBe(false);
    expect(
      shouldAutoGeneratePois("wizard", 6, [], false, true, false, [{ name: "Kyoto" }])
    ).toBe(false);
    expect(
      shouldAutoGeneratePois("wizard", 6, [], false, false, true, [{ name: "Kyoto" }])
    ).toBe(false);
    expect(
      shouldAutoGeneratePois("wizard", 6, [], true, false, false, [{ name: "Kyoto" }])
    ).toBe(true);
  });

  test("shouldSkipPoiAutoGenerate only skips when a prior auto-run already has rows", () => {
    expect(shouldSkipPoiAutoGenerate(true, [{ name: "Fushimi Inari" }])).toBe(true);
    expect(shouldSkipPoiAutoGenerate(true, [])).toBe(false);
    expect(shouldSkipPoiAutoGenerate(false, [{ name: "Fushimi Inari" }])).toBe(false);
  });

  test("wizardSyncIntervalMs uses fast polling for collaborative steps", () => {
    expect(wizardSyncIntervalMs(1)).toBe(1200);
    expect(wizardSyncIntervalMs(2)).toBe(1200);
    expect(wizardSyncIntervalMs(3)).toBe(1200);
    expect(wizardSyncIntervalMs(5)).toBe(1200);
    expect(wizardSyncIntervalMs(6)).toBe(1200);
    expect(wizardSyncIntervalMs(9)).toBe(3000);
    expect(wizardSyncIntervalMs(10)).toBe(1200);
    expect(wizardSyncIntervalMs(11)).toBe(1200);
    expect(wizardSyncIntervalMs(12)).toBe(1200);
    expect(wizardSyncIntervalMs(13)).toBe(1200);
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

  test("buildFallbackItinerary places breakfast first and keeps morning POIs before lunch", () => {
    const rows = buildFallbackItinerary(
      [{ name: "Kyoto" }],
      [
        { name: "Arashiyama Bamboo Grove", destination: "Kyoto", cost: 0, category: "Nature", tags: ["garden", "photography"] },
        { name: "Nishiki Market", destination: "Kyoto", cost: 15, category: "Food", tags: ["market", "food"] },
        { name: "Gion Evening Walk", destination: "Kyoto", cost: 0, category: "Culture", tags: ["night", "walk"] },
      ],
      [{ name: "Riverside Inn", destination: "Kyoto", neighborhood: "Gion" }],
      [
        { name: "Morning Table", destination: "Kyoto", type: "Breakfast", cost: 18 },
        { name: "Market Lunch", destination: "Kyoto", type: "Lunch", cost: 24 },
        { name: "Lantern Dinner", destination: "Kyoto", type: "Dinner", cost: 36 },
      ],
      3,
      "2026-04-10",
      { Kyoto: 2 }
    );
    const fullDay = rows.find((day) => day.items.some((item) => item.title === "Morning Table"));
    expect(fullDay).toBeTruthy();
    const breakfastIndex = fullDay.items.findIndex((item) => item.title === "Morning Table");
    const lunchIndex = fullDay.items.findIndex((item) => item.title === "Market Lunch");
    const morningPoiIndex = fullDay.items.findIndex((item) => {
      const title = String(item.title).toLowerCase();
      return title.includes("arashiyama bamboo grove") || title.includes("nishiki market");
    });
    expect(breakfastIndex).toBeGreaterThanOrEqual(0);
    expect(lunchIndex).toBeGreaterThan(breakfastIndex);
    expect(morningPoiIndex).toBeGreaterThan(breakfastIndex);
    expect(morningPoiIndex).toBeLessThan(lunchIndex);
  });

  test("buildFallbackItinerary inserts travel legs around meals and POIs", () => {
    const rows = buildFallbackItinerary(
      [{ name: "Kyoto" }],
      [
        { name: "Arashiyama Bamboo Grove", destination: "Kyoto", cost: 0, category: "Nature", tags: ["garden", "photography"] },
        { name: "Nishiki Market", destination: "Kyoto", cost: 15, category: "Food", tags: ["market", "food"] },
      ],
      [{ name: "Riverside Inn", destination: "Kyoto", neighborhood: "Gion" }],
      [
        { name: "Morning Table", destination: "Kyoto", type: "Breakfast", cost: 18 },
        { name: "Market Lunch", destination: "Kyoto", type: "Lunch", cost: 24 },
        { name: "Lantern Dinner", destination: "Kyoto", type: "Dinner", cost: 36 },
      ],
      3,
      "2026-04-10",
      { Kyoto: 2 }
    );
    const fullDay = rows.find((day) => day.items.some((item) => item.title === "Morning Table"));
    expect(fullDay.items.some((item) => item.type === "travel")).toBe(true);
    expect(
      fullDay.items.some((item) =>
        String(item.title).toLowerCase().includes("transit from morning table to")
      )
    ).toBe(true);
  });

  test("buildFallbackItinerary uses POI location hints in visible routing", () => {
    const rows = buildFallbackItinerary(
      [{ name: "Wellington" }],
      [
        { name: "Mount Victoria Lookout", destination: "Wellington", locationHint: "Mount Victoria", bestTime: "morning", cost: 0, category: "Nature", tags: ["lookout"] },
        { name: "Courtenay Place Live Music", destination: "Wellington", locationHint: "Courtenay Place", bestTime: "evening", cost: 20, category: "Nightlife", tags: ["music", "night"] },
      ],
      [{ name: "Te Aro Apartment", destination: "Wellington", neighborhood: "Te Aro" }],
      [
        { name: "Olive Cafe", destination: "Wellington", type: "Breakfast", cost: 18 },
        { name: "Harbor Lunch", destination: "Wellington", type: "Lunch", cost: 24 },
        { name: "Dockside Dinner", destination: "Wellington", type: "Dinner", cost: 36 },
      ],
      3,
      "2026-04-10",
      { Wellington: 2 }
    );
    const fullDay = rows.find((day) => day.items.some((item) => item.title === "Olive Cafe"));
    expect(fullDay.items.some((item) => String(item.title).includes("Mount Victoria Lookout in Mount Victoria"))).toBe(true);
    expect(fullDay.items.some((item) => String(item.title).includes("Mount Victoria Lookout (Mount Victoria)"))).toBe(true);
  });

  test("buildFallbackItinerary honors explicit POI bestTime metadata", () => {
    const rows = buildFallbackItinerary(
      [{ name: "Wellington" }],
      [
        { name: "Botanic Garden Walk", destination: "Wellington", locationHint: "Botanic Garden", bestTime: "morning", cost: 0, category: "Nature", tags: ["garden"] },
        { name: "Waterfront Sunset Cruise", destination: "Wellington", locationHint: "Wellington Waterfront", bestTime: "evening", cost: 35, category: "Culture", tags: ["sunset", "harbor"] },
      ],
      [{ name: "Te Aro Apartment", destination: "Wellington", neighborhood: "Te Aro" }],
      [
        { name: "Olive Cafe", destination: "Wellington", type: "Breakfast", cost: 18 },
        { name: "Harbor Lunch", destination: "Wellington", type: "Lunch", cost: 24 },
        { name: "Dockside Dinner", destination: "Wellington", type: "Dinner", cost: 36 },
      ],
      3,
      "2026-04-10",
      { Wellington: 2 }
    );
    const fullDay = rows.find((day) => day.items.some((item) => item.title === "Olive Cafe"));
    const morningPoiIndex = fullDay.items.findIndex((item) => String(item.title).includes("Botanic Garden Walk"));
    const eveningPoiIndex = fullDay.items.findIndex((item) => String(item.title).includes("Waterfront Sunset Cruise"));
    const lunchIndex = fullDay.items.findIndex((item) => item.title === "Harbor Lunch");
    expect(morningPoiIndex).toBeGreaterThanOrEqual(0);
    expect(lunchIndex).toBeGreaterThan(morningPoiIndex);
    expect(eveningPoiIndex).toBeGreaterThan(lunchIndex);
  });

  test("materializeItineraryDates assigns locked dates to day labels", () => {
    expect(
      materializeItineraryDates(
        [
          { day: 1, date: "Day 1", items: [] },
          { day: 2, date: "Day 2", items: [] },
        ],
        "2026-03-22"
      )
    ).toEqual([
      { day: 1, date: "2026-03-22", items: [] },
      { day: 2, date: "2026-03-23", items: [] },
    ]);
  });

  test("normalizeWizardStepIndex migrates legacy post-duration steps to the new order", () => {
    expect(normalizeWizardStepIndex(9, 0)).toBe(13);
    expect(normalizeWizardStepIndex(10, 0)).toBe(14);
    expect(normalizeWizardStepIndex(11, 0)).toBe(10);
    expect(normalizeWizardStepIndex(13, 0)).toBe(12);
    expect(normalizeWizardStepIndex(11, 2)).toBe(12);
  });

  test("route planner helpers normalize, order, and map durations from route output", () => {
    const signature = buildRoutePlanSignature(
      [{ name: "Kedarnath", country: "India" }, { name: "Somnath", country: "India" }],
      { culture: true },
      "moderate",
      ["Vegetarian"],
      ["spiritual"],
      { extraYes: ["temples"], extraNo: [], dietary: [], memberSummaries: ["Crew: likes temples"] }
    );

    expect(signature).toContain("kedarnath");
    expect(signature).toContain("temples");

    const plan = normalizeRoutePlan(
      {
        startingCity: "Delhi",
        endingCity: "Ahmedabad",
        summary: "North to west pilgrimage sweep.",
        totalDays: 6,
        phases: [{ title: "Phase 1", route: ["Kedarnath", "Somnath"], days: 6, notes: "Minimize backtracking" }],
        destinations: [
          {
            destination: "Kedarnath",
            days: 2,
            nearbySites: ["Triyuginarayan Temple"],
            reason: "High-altitude darshan first",
            bestTime: "Morning",
            travelNote: "Road plus trek"
          },
          {
            destination: "Somnath",
            days: 4,
            nearbySites: ["Bhalka Tirth"],
            reason: "West coast finish",
            bestTime: "Evening aarti",
            travelNote: "Rail or flight connection"
          }
        ]
      },
      [{ name: "Kedarnath", country: "India" }, { name: "Somnath", country: "India" }]
    );

    expect(orderDestinationsByRoutePlan(
      [{ name: "Somnath" }, { name: "Kedarnath" }],
      plan
    ).map((d) => d.name)).toEqual(["Kedarnath", "Somnath"]);

    expect(routePlanDurationMap(plan)).toEqual({
      Kedarnath: 2,
      Somnath: 4,
    });
  });

  test("estimateTransitMinutes and buildTransitItem provide a practical travel leg", () => {
    expect(estimateTransitMinutes("Morning Table", "Arashiyama Bamboo Grove")).toBeGreaterThan(0);
    expect(buildTransitItem("09:15", "Morning Table", "Arashiyama Bamboo Grove")).toEqual(
      expect.objectContaining({
        time: "09:15",
        type: "travel",
        title: expect.stringContaining("Approx."),
      })
    );
  });

  test("chooseBestItineraryRows prefers fallback when generic LLM rows omit approved POIs", () => {
    const genericRows = [
      {
        day: 1,
        destination: "Auckland",
        items: [
          { time: "09:00", type: "flight", title: "Arrive in Auckland", cost: 0 },
          { time: "10:00", type: "activity", title: "Explore Auckland", cost: 0 },
        ],
      },
    ];
    const fallbackRows = buildFallbackItinerary(
      [{ name: "Auckland" }],
      [{ name: "Mount Eden Summit Hike", destination: "Auckland", category: "Nature", tags: ["hiking", "views"] }],
      [{ name: "Grand Auckland Palace", destination: "Auckland", neighborhood: "CBD" }],
      [
        { name: "Auckland Morning Table", destination: "Auckland", type: "Breakfast", cost: 18 },
        { name: "Auckland Lunch Table", destination: "Auckland", type: "Lunch", cost: 24 },
        { name: "Auckland Evening Table", destination: "Auckland", type: "Dinner", cost: 36 },
      ],
      3,
      "",
      { Auckland: 2 }
    );
    const chosen = chooseBestItineraryRows(genericRows, fallbackRows, [
      { name: "Mount Eden Summit Hike", destination: "Auckland" },
    ]);
    expect(chosen).toEqual(fallbackRows);
    expect(itineraryRowsScore(chosen, [{ name: "Mount Eden Summit Hike", destination: "Auckland" }]).poiHits).toBeGreaterThan(0);
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

  test("normalizeStays converts curated fallback stays into honest area guidance", () => {
    const out = normalizeStays(
      [
        {
          name: "Britomart House",
          destination: "Auckland",
          type: "Boutique Hotel",
          rating: 4.7,
          ratePerNight: 220,
          nights: 2,
          amenities: ["WiFi", "Breakfast", "Harbor views"],
          neighborhood: "Britomart",
          bookingSource: "WanderPlan curated fallback",
          whyThisOne: "Walkable to ferries, dining, and the waterfront.",
          cancellation: "Free cancellation up to 48 hours",
          bookingUrl: "https://example.test/britomart-house",
        },
      ],
      [{ name: "Auckland" }],
      "moderate",
      2
    );
    expect(out[0]).toEqual(
      expect.objectContaining({
        name: "Stay near Britomart",
        destination: "Auckland",
        type: "Area guidance",
        rating: 0,
        amenities: ["WiFi", "Breakfast", "Harbor views"],
        neighborhood: "Britomart",
        bookingSource: "WanderPlan area guidance",
        whyThisOne: "Walkable to ferries, dining, and the waterfront.",
        cancellation: "Free cancellation up to 48 hours",
        bookingUrl: "https://example.test/britomart-house",
      })
    );
  });

  test("normalizeStays converts prefixed manufactured stay names into area guidance", () => {
    const out = normalizeStays(
      [
        {
          name: "Grand Bhimashankar Palace",
          destination: "Bhimashankar",
          type: "Hotel",
          rating: 4.8,
          ratePerNight: 200,
          neighborhood: "temple approach road",
          bookingSource: "WanderPlan curated fallback",
        },
      ],
      [{ name: "Bhimashankar" }],
      "moderate",
      1
    );
    expect(out[0]).toEqual(
      expect.objectContaining({
        name: "Stay near temple approach road",
        destination: "Bhimashankar",
        type: "Area guidance",
        rating: 0,
        bookingSource: "WanderPlan area guidance",
      })
    );
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
    expect(out[0].meals[0].options.length).toBeGreaterThanOrEqual(1);
    expect(out[0].meals[0].rating).toBe(4.7);
    expect(out[0].meals[0].options[0]).toEqual(
      expect.objectContaining({ name: "Harbor Brunch", rating: 4.7 })
    );
  });

  test("normalizeDiningPlan preserves selected option notes and travel minutes", () => {
    const out = normalizeDiningPlan([
      {
        day: 2,
        destination: "Wellington",
        anchor: "Cuba Street",
        meals: [
          {
            type: "Dinner",
            selectedOption: 0,
            options: [
              {
                name: "Ortega Fish Shack",
                city: "Wellington",
                cuisine: "Seafood",
                cost: 46,
                rating: 4.7,
                note: "One of Wellington's better-known dinner spots.",
                travel_minutes: 14,
              },
            ],
          },
        ],
      },
    ]);
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Ortega Fish Shack",
        rating: 4.7,
        note: "One of Wellington's better-known dinner spots.",
        travelMinutes: 14,
      })
    );
    expect(out[0]).toEqual(
      expect.objectContaining({
        destination: "Wellington",
        anchor: "Cuba Street",
        locationLabel: "Wellington",
        stayAnchorLabel: "Cuba Street",
      })
    );
  });

  test("normalizeDiningPlan converts manufactured dining names into area guidance", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Bhimashankar",
        anchor: "temple access road",
        meals: [
          {
            type: "Lunch",
            name: "Bhimashankar Market Bistro",
            cost: 28,
            rating: 4.6,
          },
        ],
      },
    ]);
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Lunch near sightseeing stop",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "poi",
      })
    );
    expect(out[0].meals[0].options[0]).toEqual(
      expect.objectContaining({
        name: "Lunch near sightseeing stop",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "poi",
      })
    );
  });

  test("normalizeDiningPlan converts destination-prefixed generic dining names into area guidance", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Bhimashankar",
        anchor: "temple access road",
        meals: [
          {
            type: "Dinner",
            name: "Bhimashankar Local Supper House",
            cost: 32,
            rating: 4.5,
          },
        ],
      },
    ]);
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Dinner near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
    expect(out[0].meals[0].options[0]).toEqual(
      expect.objectContaining({
        name: "Dinner near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
  });

  test("normalizeDiningPlan converts non-prefixed synthetic temple dining names into area guidance", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Somnath",
        anchor: "temple access road",
        meals: [
          {
            type: "Dinner",
            name: "Temple Courtyard Cafe",
            cost: 30,
            rating: 4.4,
          },
          {
            type: "Breakfast",
            name: "Pilgrim Supper House",
            cost: 18,
            rating: 4.3,
          },
        ],
      },
    ]);
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Dinner near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
    expect(out[0].meals[1]).toEqual(
      expect.objectContaining({
        name: "Breakfast near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
  });

  test("normalizeDiningPlan converts synthetic themed dining names from route flow into area guidance", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Somnath",
        anchor: "temple access road",
        meals: [
          {
            type: "Breakfast",
            name: "Kedarnath Sunrise Cafe",
            cost: 18,
            rating: 4.5,
          },
          {
            type: "Lunch",
            name: "Traditional Malwa Cuisine Cooking Class",
            cost: 35,
            rating: 4.5,
          },
          {
            type: "Dinner",
            name: "Somnath Coastal Photography and Seafood Tasting",
            cost: 45,
            rating: 4.5,
          },
          {
            type: "Dinner",
            name: "Kashi Vishwanath Evening Table",
            cost: 52,
            rating: 4.5,
          },
        ],
      },
    ]);
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Breakfast near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
    expect(out[0].meals[1]).toEqual(
      expect.objectContaining({
        name: "Lunch near sightseeing stop",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "poi",
      })
    );
    expect(out[0].meals[2]).toEqual(
      expect.objectContaining({
        name: "Dinner near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
    expect(out[0].meals[3]).toEqual(
      expect.objectContaining({
        name: "Dinner near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
  });

  test("normalizeDiningPlan sanitizes long synthetic anchors into place-like area labels", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Varanasi",
        anchor: "Heritage Walk and Photography Tour of Varanasi Ghats",
        meals: [
          {
            type: "Breakfast",
            name: "Temple Courtyard Cafe",
            cost: 22,
            rating: 4.4,
          },
        ],
      },
    ]);
    expect(out[0]).toEqual(
      expect.objectContaining({
        anchor: "Varanasi Ghats",
        locationLabel: "Varanasi",
        stayAnchorLabel: "Varanasi Ghats",
      })
    );
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Breakfast near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
  });

  test("normalizeDiningPlan strips travel-style arrival anchors before building area guidance", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Somnath",
        anchor: "Arrive in Grishneshwar (Aurangabad)",
        meals: [
          {
            type: "Breakfast",
            name: "Temple Courtyard Cafe",
            cost: 22,
            rating: 4.4,
          },
        ],
      },
    ]);
    expect(out[0]).toEqual(
      expect.objectContaining({
        anchor: "Grishneshwar (Aurangabad)",
        locationLabel: "Somnath",
        stayAnchorLabel: "Grishneshwar (Aurangabad)",
      })
    );
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Breakfast near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "stay",
      })
    );
  });

  test("normalizeDiningPlan strips transit-style anchors down to the destination side of the route", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Somnath",
        anchor: "Approx. 10 min transit from Lunch in Grishneshwar (Aurangabad) to Ellora Caves (Grishneshwar area)",
        meals: [
          {
            type: "Lunch",
            name: "Temple Courtyard Cafe",
            cost: 28,
            rating: 4.4,
          },
        ],
      },
    ]);
    expect(out[0]).toEqual(
      expect.objectContaining({
        anchor: "Ellora Caves (Grishneshwar area)",
        locationLabel: "Somnath",
        lunchAnchorLabel: "Ellora Caves (Grishneshwar area)",
      })
    );
    expect(out[0].meals[0]).toEqual(
      expect.objectContaining({
        name: "Lunch near sightseeing stop",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
        anchorRole: "poi",
      })
    );
  });

  test("normalizeDiningPlan converts itinerary-phrase names while keeping non-guidance choices selectable", () => {
    const out = normalizeDiningPlan([
      {
        day: 1,
        destination: "Aurangabad",
        anchor: "Arrive in Grishneshwar (Aurangabad)",
        meals: [
          {
            type: "Breakfast",
            name: "Breakfast near Arrive in Grishneshwar (Aurangabad)",
            cost: 45,
            rating: 4.6,
            options: [
              { name: "Breakfast near Arrive in Grishneshwar (Aurangabad)", cost: 45, rating: 4.6 },
              { name: "Somnath morning cafe area", cost: 35, rating: 4.4 },
              { name: "Temple-access breakfast around Somnath", cost: 18, rating: 4.3 },
              { name: "Somnath tea and bakery area", cost: 53, rating: 4.2 },
            ],
          },
          {
            type: "Lunch",
            name: "Lunch near Approx. 10 min transit from Lunch in Grishneshwar (Aurangabad) to Ellora Caves (Grishneshwar area)",
            cost: 45,
            rating: 4.5,
          },
        ],
      },
    ]);
    expect(out[0].meals[0].name).not.toBe("Breakfast near Arrive in Grishneshwar (Aurangabad)");
    expect(out[0].meals[0].cost).toBeGreaterThan(0);
    expect(out[0].meals[0].options[0]).toEqual(
      expect.objectContaining({
        name: "Breakfast near your stay",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
      })
    );
    expect(out[0].meals[1]).toEqual(
      expect.objectContaining({
        name: "Lunch near sightseeing stop",
        cuisine: "Area guidance",
        rating: 0,
        cost: 0,
      })
    );
  });

  test("buildDiningRowsFromSuggestions groups one structured dining card per destination", () => {
    const rows = buildDiningRowsFromSuggestions([
      {
        meal: "Breakfast",
        city: "Aurangabad",
        anchor_role: "stay",
        anchor_label: "Grishneshwar stay area",
        near_poi: "Grishneshwar stay area",
        focus_dish: "Poha and chai",
        focus_note: "Classic local breakfast before temple visits.",
        name: "Breakfast near your stay",
        options: [{ name: "Breakfast near your stay", cuisine: "Area guidance", cost: 0, rating: 0, tags: ["area-guidance", "breakfast"] }],
      },
      {
        meal: "Lunch",
        city: "Aurangabad",
        anchor_role: "poi",
        anchor_label: "Ellora Caves",
        near_poi: "Ellora Caves",
        name: "Lunch near sightseeing stop",
        options: [{ name: "Lunch near sightseeing stop", cuisine: "Area guidance", cost: 0, rating: 0, tags: ["area-guidance", "lunch"] }],
      },
      {
        meal: "Dinner",
        city: "Aurangabad",
        anchor_role: "stay",
        anchor_label: "Grishneshwar stay area",
        near_poi: "Grishneshwar stay area",
        name: "Dinner near your stay",
        options: [{ name: "Dinner near your stay", cuisine: "Area guidance", cost: 0, rating: 0, tags: ["area-guidance", "dinner"] }],
      },
      {
        meal: "Lunch",
        city: "Aurangabad",
        anchor_role: "poi",
        anchor_label: "Daulatabad Fort",
        near_poi: "Daulatabad Fort",
        name: "Duplicate lunch should be ignored",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        destination: "Aurangabad",
        locationLabel: "Day 1 - Aurangabad",
        stayAnchorLabel: "Grishneshwar stay area",
        lunchAnchorLabel: "Ellora Caves",
      })
    );
    expect(rows[0].meals.map((meal) => meal.type)).toEqual(["Breakfast", "Lunch", "Dinner"]);
    expect(rows[0].meals[0]).toEqual(expect.objectContaining({ anchorRole: "stay", anchorLabel: "Grishneshwar stay area" }));
    expect(rows[0].meals[1]).toEqual(expect.objectContaining({ anchorRole: "poi", anchorLabel: "Ellora Caves" }));
    expect(rows[0].meals[2]).toEqual(expect.objectContaining({ anchorRole: "stay", anchorLabel: "Grishneshwar stay area" }));
    expect(rows[0].meals[0]).toEqual(
      expect.objectContaining({
        focusDish: "Poha and chai",
        focusArea: expect.any(String),
        focusNote: "Classic local breakfast before temple visits.",
      })
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

describe("WanderPlanLLMFlow trip setup hardening helpers", () => {
  test("trip destination helpers normalize direct entries and bucket ids into unique destination names", () => {
    const bucket = [
      { id: "bucket-1", name: "Kyoto" },
      { id: "bucket-2", name: "Auckland" },
    ];
    const added = addTripDestinationValue(["  kyoto  "], "Auckland");
    expect(added).toEqual(["  kyoto  ", "Auckland"]);
    expect(normalizeTripDestinationValue("  New   York ")).toBe("New York");
    expect(
      tripDestinationNamesFromValues(
        ["bucket-1", "auckland", "Auckland", "  Kyoto "],
        bucket
      )
    ).toEqual(["Kyoto", "auckland"]);
  });

  test("activeTripTravelerCount treats accepted or joined members as active travelers", () => {
    expect(activeTripTravelerCount([], {})).toBe(1);
    expect(
      activeTripTravelerCount(
        [
          { id: "m-accepted", status: "accepted" },
          { id: "m-invited", status: "invited" },
          { id: "m-selected", status: "selected" },
        ],
        { "m-selected": true }
      )
    ).toBe(3);
  });
});

describe("WanderPlanLLMFlow solo trip setup", () => {
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

  test("allows direct destination entry without bucket list and skips destination voting for solo trips", async () => {
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Solo Traveler",
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
      if (path === "/me/trips" && method === "GET") return jsonResponse({ trips: [] });
      if (path === "/wizard/sessions" && method === "POST") {
        return jsonResponse({
          session: {
            id: "session-1",
            trip_id: "11111111-1111-4111-8111-111111111111",
          },
        });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:solo-user"));
    window.localStorage.setItem(
      "wp-u:uid:solo-user",
      JSON.stringify({
        name: "Solo Traveler",
        email: "solo@test.com",
        styles: ["solo"],
        interests: {},
        budget: "moderate",
        dietary: [],
      })
    );

    render(<WanderPlan />);

    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(screen.getByText("Plan a new trip"));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("e.g. Summer 2025")).not.toBeNull()
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Summer 2025"), {
      target: { value: "Solo Escape" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Add a destination directly (e.g. Kyoto)"),
      { target: { value: "Kyoto" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.queryByText("Kyoto")).not.toBeNull());
    fireEvent.click(screen.getByText("Start Planning"));

    await waitFor(() =>
      expect(screen.queryByText("Confirm 1 Destination")).not.toBeNull()
    );
    fireEvent.click(screen.getByText("Confirm 1 Destination"));

    await waitFor(() => expect(screen.queryByText("Continue Solo")).not.toBeNull());
    fireEvent.click(screen.getByText("Continue Solo"));

    await waitFor(() =>
      expect(
        screen.queryByText(
          "Solo trip detected. Voting is skipped here, so you can continue directly with your destination set."
        )
      ).not.toBeNull()
    );
    expect(screen.queryByText(/Majority needed:/)).toBeNull();
  });

  test("persists step 1 destination removals for saved trips", async () => {
    const putBodies = [];
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const parsedUrl = new URL(String(url), "https://example.test");
      const path = parsedUrl.pathname;
      const tripId = "22222222-2222-4222-8222-222222222222";

      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Organizer",
            travel_styles: ["friends"],
            interests: { culture: true },
            budget_tier: "moderate",
            dietary: [],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") {
        return jsonResponse({
          items: [
            { id: "bucket-kyoto", destination: "Kyoto", name: "Kyoto", country: "Japan" },
            { id: "bucket-osaka", destination: "Osaka", name: "Osaka", country: "Japan" },
          ],
        });
      }
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({
          trips: [
            {
              id: tripId,
              name: "Japan Sprint",
              status: "planning",
              my_status: "owner",
              duration_days: 6,
              members: [],
              destinations: [{ name: "Kyoto" }, { name: "Osaka" }],
              my_role: "owner",
            },
          ],
        });
      }
      if (path === `/trips/${tripId}` && method === "GET") {
        return jsonResponse({
          trip: {
            id: tripId,
            name: "Japan Sprint",
            status: "planning",
            duration_days: 6,
            members: [],
          },
        });
      }
      if (path === `/trips/${tripId}/destinations` && method === "GET") {
        return jsonResponse({
          destinations: [{ name: "Kyoto", votes: 0 }, { name: "Osaka", votes: 0 }],
        });
      }
      if (path === `/trips/${tripId}/destinations` && method === "PUT") {
        const body = JSON.parse((options && options.body) || "{}");
        putBodies.push(body);
        return jsonResponse({
          destinations: (Array.isArray(body.destinations) ? body.destinations : []).map((name) => ({
            name,
            votes: 0,
          })),
        });
      }
      if (path === `/trips/${tripId}/pois` && method === "GET") return jsonResponse({ pois: [] });
      if (path === `/trips/${tripId}/planning-state` && method === "GET") return jsonResponse({ state: {}, updated_at: "2026-06-01T10:00:00Z" });
      if (path === `/trips/${tripId}/planning-state` && method === "PUT") {
        const body = JSON.parse((options && options.body) || "{}");
        return jsonResponse({ state: body.state || {}, updated_at: "2026-06-01T10:00:00Z" });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:organizer-user"));
    window.localStorage.setItem(
      "wp-u:uid:organizer-user",
      JSON.stringify({
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["friends"],
        interests: {},
        budget: "moderate",
        dietary: [],
      })
    );

    render(<WanderPlan />);

    await waitFor(() => expect(screen.queryByText("Japan Sprint")).not.toBeNull());
    fireEvent.click(screen.getByText("Japan Sprint"));
    await waitFor(() => expect(screen.queryByText("Continue Planning")).not.toBeNull());
    fireEvent.click(screen.getByText("Continue Planning"));

    await waitFor(() => expect(screen.queryByText("Confirm 2 Destinations")).not.toBeNull());
    fireEvent.click(screen.getAllByText("Remove")[0]);

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
      expect(putBodies[putBodies.length - 1].destinations).toEqual(["Osaka"]);
    });
  });

  test("persists the step 6 route plan before continuing", async () => {
    const putBodies = [];
    const tripId = "33333333-3333-4333-8333-333333333333";
    const routePlan = {
      summary: "Start in Kyoto, then continue west to Osaka for an efficient city pair.",
      startingCity: "Kyoto",
      endingCity: "Osaka",
      totalDays: 5,
      destinations: [
        { destination: "Kyoto", days: 3, nearbySites: ["Fushimi Inari Shrine"] },
        { destination: "Osaka", days: 2, nearbySites: ["Dotonbori"] },
      ],
      phases: [
        { title: "Kansai Core", route: ["Kyoto", "Osaka"], days: 5, notes: "Minimal backtracking." },
      ],
    };
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const parsedUrl = new URL(String(url), "https://example.test");
      const path = parsedUrl.pathname;

      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Organizer",
            travel_styles: ["friends"],
            interests: { culture: true, food: true },
            budget_tier: "moderate",
            dietary: [],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") {
        return jsonResponse({
          items: [
            { id: "bucket-kyoto", destination: "Kyoto", name: "Kyoto", country: "Japan" },
            { id: "bucket-osaka", destination: "Osaka", name: "Osaka", country: "Japan" },
          ],
        });
      }
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({
          trips: [
            {
              id: tripId,
              name: "Japan Sprint",
              status: "planning",
              my_status: "owner",
              my_role: "owner",
              duration_days: 5,
              members: [],
              destinations: [{ name: "Kyoto" }, { name: "Osaka" }],
            },
          ],
        });
      }
      if (path === `/trips/${tripId}` && method === "GET") {
        return jsonResponse({
          trip: {
            id: tripId,
            name: "Japan Sprint",
            status: "planning",
            duration_days: 5,
            members: [],
          },
        });
      }
      if (path === `/trips/${tripId}/destinations` && method === "GET") {
        return jsonResponse({
          destinations: [{ name: "Kyoto", votes: 0 }, { name: "Osaka", votes: 0 }],
        });
      }
      if (path === `/trips/${tripId}/pois` && method === "GET") return jsonResponse({ pois: [] });
      if (path === `/trips/${tripId}/planning-state` && method === "GET") {
        return jsonResponse({
          current_step: 5,
          state: {
            wizard_order_version: 2,
            route_plan: routePlan,
          },
          updated_at: "2026-06-01T10:00:00Z",
        });
      }
      if (path === `/trips/${tripId}/planning-state` && method === "PUT") {
        const body = JSON.parse((options && options.body) || "{}");
        putBodies.push(body);
        return jsonResponse({
          current_step: body.current_step,
          state: body.state || {},
          updated_at: "2026-06-01T10:00:00Z",
        });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:organizer-user"));
    window.localStorage.setItem(
      "wp-u:uid:organizer-user",
      JSON.stringify({
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["friends"],
        interests: { culture: true, food: true },
        budget: "moderate",
        dietary: [],
      })
    );

    render(<WanderPlan />);

    await waitFor(() => expect(screen.queryByText("Japan Sprint")).not.toBeNull());
    fireEvent.click(screen.getByText("Japan Sprint"));
    await waitFor(() => expect(screen.queryByText("Continue Planning")).not.toBeNull());
    fireEvent.click(screen.getByText("Continue Planning"));

    await waitFor(() => expect(screen.queryByText("Use Route Plan & Continue")).not.toBeNull());
    fireEvent.click(screen.getByText("Use Route Plan & Continue"));

    await waitFor(() => {
      const routeSaveBody = putBodies.find((body) => body && body.state && body.state.route_plan);
      expect(routeSaveBody).toBeTruthy();
      expect(routeSaveBody.state.route_plan.destinations.map((stop) => stop.destination)).toEqual(["Kyoto", "Osaka"]);
      expect(routeSaveBody.state.duration_per_destination).toEqual({ Kyoto: 3, Osaka: 2 });
    });

    await waitFor(() => {
      expect(putBodies.some((body) => body && body.current_step === 6)).toBe(true);
    });
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
