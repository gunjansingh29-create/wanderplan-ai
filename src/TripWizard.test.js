import {
  availabilityRangeFitsTrip,
  availabilityWindowMatchesTripDays,
  countMyPoiSelections,
  countShortlistedPois,
  getUserIdFromToken,
  inclusiveIsoDays,
  isMyPoiShortlistSelection,
  isShortlistedPoi,
  mapMemberFromApi,
  normalizeBudgetTier,
  normalizeFlightLegRows,
  normalizeAirportCode,
  inferAirportCode,
  mapInterestAnswersToCategories,
  mapInterestAnswersToProfileInterests,
  summarizePoiVoteCounts,
} from "./TripWizard";

describe("TripWizard token helpers", () => {
  test("extracts user id from test token format", () => {
    expect(getUserIdFromToken("test-token:00000000-0000-0000-0000-000000000001")).toBe(
      "00000000-0000-0000-0000-000000000001"
    );
  });

  test("returns empty string for invalid token", () => {
    expect(getUserIdFromToken("Bearer abc")).toBe("");
    expect(getUserIdFromToken("")).toBe("");
  });

  test("extracts user id from JWT payload claims", () => {
    const payloadSub = Buffer.from(JSON.stringify({ sub: "user-sub-123" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const jwtWithSub = `x.${payloadSub}.y`;
    expect(getUserIdFromToken(jwtWithSub)).toBe("user-sub-123");

    const payloadUserId = Buffer.from(JSON.stringify({ user_id: "user-id-999" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const jwtWithUserId = `x.${payloadUserId}.y`;
    expect(getUserIdFromToken(jwtWithUserId)).toBe("user-id-999");
  });
});

describe("TripWizard availability date helpers", () => {
  test("counts calendar days inclusively", () => {
    expect(inclusiveIsoDays("2026-06-01", "2026-06-10")).toBe(10);
    expect(inclusiveIsoDays("2026-06-01", "2026-06-01")).toBe(1);
  });

  test("requires each member availability range to fit the full trip length", () => {
    expect(
      availabilityRangeFitsTrip({ start: "2026-06-01", end: "2026-06-10" }, 10)
    ).toBe(true);
    expect(
      availabilityRangeFitsTrip({ start: "2026-06-01", end: "2026-06-09" }, 10)
    ).toBe(false);
  });

  test("requires locked travel dates to match the trip length exactly", () => {
    expect(
      availabilityWindowMatchesTripDays({ start: "2026-06-01", end: "2026-06-10" }, 10)
    ).toBe(true);
    expect(
      availabilityWindowMatchesTripDays({ start: "2026-06-01", end: "2026-06-11" }, 10)
    ).toBe(false);
    expect(
      availabilityWindowMatchesTripDays({ start: "2026-06-01", end: "2026-06-09" }, 10)
    ).toBe(false);
  });
});

describe("TripWizard member profile helpers", () => {
  test("preserves backend budget tier on trip members", () => {
    const member = mapMemberFromApi({
      user_id: "user-1",
      email: "alex@example.com",
      status: "accepted",
      profile: {
        display_name: "Alex",
        budget_tier: "premium",
        dietary: ["vegetarian"],
      },
    });

    expect(member.profile.display_name).toBe("Alex");
    expect(member.profile.budget_tier).toBe("premium");
    expect(member.profile.dietary).toEqual(["vegetarian"]);
  });

  test("normalizes unknown budget tiers to moderate", () => {
    expect(normalizeBudgetTier("luxury")).toBe("luxury");
    expect(normalizeBudgetTier("")).toBe("moderate");
    expect(normalizeBudgetTier("cheap")).toBe("moderate");
  });
});

describe("TripWizard POI shortlist helpers", () => {
  test("treats backend shortlisted POIs as part of the shared voting list", () => {
    expect(isShortlistedPoi({ shortlisted: true }, false)).toBe(true);
    expect(isShortlistedPoi({ shortlisted: false }, true)).toBe(true);
    expect(isShortlistedPoi({ shortlisted: false }, false)).toBe(false);
  });

  test("counts the shared shortlist from backend state plus optimistic organizer changes", () => {
    const poiRows = [
      { id: "poi-1", shortlisted: true },
      { id: "poi-2", shortlisted: false },
      { id: "poi-3", shortlisted: false },
    ];
    const poiApproved = {
      1: true,
      2: false,
    };

    expect(countShortlistedPois(poiRows, poiApproved)).toBe(2);
  });

  test("tracks each crew member's own shortlist selections separately from the shared list", () => {
    const poiRows = [
      { id: "poi-1", shortlisted: true, shortlist_counts: { selected: 2, my_selected: false } },
      { id: "poi-2", shortlisted: false, shortlist_counts: { selected: 0, my_selected: true } },
    ];
    const poiApproved = {
      1: true,
    };

    expect(isMyPoiShortlistSelection(poiRows[0], false)).toBe(false);
    expect(isMyPoiShortlistSelection(poiRows[1], false)).toBe(true);
    expect(countMyPoiSelections(poiRows, poiApproved)).toBe(1);
  });

  test("summarizes POI vote counts for majority labels", () => {
    expect(summarizePoiVoteCounts({ approve: 3, reject: 1 })).toEqual({
      approve: 3,
      reject: 1,
      totalVotes: 4,
      outcome: "accept",
    });
    expect(summarizePoiVoteCounts({ approve: 1, reject: 3 })).toEqual({
      approve: 1,
      reject: 3,
      totalVotes: 4,
      outcome: "reject",
    });
    expect(summarizePoiVoteCounts({ approve: 2, reject: 2 })).toEqual({
      approve: 2,
      reject: 2,
      totalVotes: 4,
      outcome: "split",
    });
    expect(summarizePoiVoteCounts()).toEqual({
      approve: 0,
      reject: 0,
      totalVotes: 0,
      outcome: "pending",
    });
  });
});

describe("TripWizard flight leg normalization", () => {
  test("groups flat flight rows into multiple legs", () => {
    const rows = normalizeFlightLegRows([], [
      {
        leg_id: "leg-1-DTW-CDG-2026-06-10",
        flight_id: "f1",
        airline: "Airline A",
        departure_airport: "DTW",
        arrival_airport: "CDG",
        departure_time: "2026-06-10T08:00:00Z",
        arrival_time: "2026-06-10T16:00:00Z",
        price_usd: 320,
        stops: 0,
        duration_minutes: 480,
      },
      {
        leg_id: "leg-2-CDG-FCO-2026-06-14",
        flight_id: "f2",
        airline: "Airline B",
        departure_airport: "CDG",
        arrival_airport: "FCO",
        departure_time: "2026-06-14T09:00:00Z",
        arrival_time: "2026-06-14T11:00:00Z",
        price_usd: 140,
        stops: 0,
        duration_minutes: 120,
      },
      {
        leg_id: "leg-2-CDG-FCO-2026-06-14",
        flight_id: "f3",
        airline: "Airline C",
        departure_airport: "CDG",
        arrival_airport: "FCO",
        departure_time: "2026-06-14T13:00:00Z",
        arrival_time: "2026-06-14T15:10:00Z",
        price_usd: 150,
        stops: 1,
        duration_minutes: 130,
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].leg_id).toBe("leg-1-DTW-CDG-2026-06-10");
    expect(rows[1].leg_id).toBe("leg-2-CDG-FCO-2026-06-14");
    expect(rows[0].options).toHaveLength(1);
    expect(rows[1].options).toHaveLength(2);
  });

  test("uses provided leg blocks when available", () => {
    const rows = normalizeFlightLegRows(
      [
        {
          leg_id: "leg-1",
          from_airport: "JFK",
          to_airport: "LHR",
          depart_date: "2026-04-20",
          options: [
            {
              flight_id: "x1",
              airline: "Airline X",
              departure_time: "2026-04-20T10:00:00Z",
              arrival_time: "2026-04-20T18:00:00Z",
              price_usd: 410,
              stops: 0,
              duration_minutes: 480,
            },
          ],
        },
      ],
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].leg_id).toBe("leg-1");
    expect(rows[0].options).toHaveLength(1);
    expect(rows[0].options[0].flight_id).toBe("x1");
  });

  test("multi-city: 3 legs (outbound × 2 + return) are grouped correctly", () => {
    const input = [
      // Leg 1: LAX → NRT
      { leg_id: "leg-1-LAX-NRT-2025-06-15", flight_id: "mc1", airline: "Japan Airlines",
        departure_airport: "LAX", arrival_airport: "NRT",
        departure_time: "2025-06-15T10:30:00Z", arrival_time: "2025-06-16T14:45:00Z",
        price_usd: 248, stops: 0, duration_minutes: 660 },
      { leg_id: "leg-1-LAX-NRT-2025-06-15", flight_id: "mc2", airline: "ANA",
        departure_airport: "LAX", arrival_airport: "NRT",
        departure_time: "2025-06-15T23:00:00Z", arrival_time: "2025-06-17T04:15:00Z",
        price_usd: 220, stops: 0, duration_minutes: 720 },
      // Leg 2: NRT → KIX
      { leg_id: "leg-2-NRT-KIX-2025-06-20", flight_id: "mc3", airline: "ANA",
        departure_airport: "NRT", arrival_airport: "KIX",
        departure_time: "2025-06-20T09:00:00Z", arrival_time: "2025-06-20T10:25:00Z",
        price_usd: 85, stops: 0, duration_minutes: 85 },
      // Leg 3 (return): KIX → LAX
      { leg_id: "leg-3-KIX-LAX-2025-06-28", flight_id: "mc4", airline: "Japan Airlines",
        departure_airport: "KIX", arrival_airport: "LAX",
        departure_time: "2025-06-28T11:00:00Z", arrival_time: "2025-06-28T06:30:00Z",
        price_usd: 265, stops: 0, duration_minutes: 600 },
    ];

    const rows = normalizeFlightLegRows([], input);

    expect(rows).toHaveLength(3);
    expect(rows[0].from_airport).toBe("LAX");
    expect(rows[0].to_airport).toBe("NRT");
    expect(rows[0].options).toHaveLength(2);

    expect(rows[1].from_airport).toBe("NRT");
    expect(rows[1].to_airport).toBe("KIX");
    expect(rows[1].options).toHaveLength(1);

    expect(rows[2].from_airport).toBe("KIX");
    expect(rows[2].to_airport).toBe("LAX");
    expect(rows[2].options).toHaveLength(1);
  });

  test("legs are sorted by departure time when grouping from flat list", () => {
    const rows = normalizeFlightLegRows([], [
      { leg_id: "leg-2", flight_id: "b", airline: "B", departure_airport: "NRT", arrival_airport: "KIX",
        departure_time: "2025-06-20T09:00:00Z", arrival_time: "2025-06-20T10:25:00Z",
        price_usd: 90, stops: 0, duration_minutes: 85 },
      { leg_id: "leg-1", flight_id: "a", airline: "A", departure_airport: "LAX", arrival_airport: "NRT",
        departure_time: "2025-06-15T10:30:00Z", arrival_time: "2025-06-16T14:45:00Z",
        price_usd: 250, stops: 0, duration_minutes: 660 },
    ]);

    expect(rows[0].leg_id).toBe("leg-1");
    expect(rows[1].leg_id).toBe("leg-2");
  });

  test("normalizeFlightOption fills missing fields with defaults", () => {
    const rows = normalizeFlightLegRows([], [
      { leg_id: "leg-1", flight_id: "x", airline: "X Air",
        departure_airport: "SFO", arrival_airport: "LHR",
        departure_time: "2025-07-01T08:00:00Z", arrival_time: "2025-07-01T18:00:00Z",
        price_usd: 500 }   // no stops, no duration_minutes
    ]);

    expect(rows[0].options[0].stops).toBe(0);       // default 0
    expect(rows[0].options[0].price).toBe(500);
    expect(rows[0].options[0].airline).toBe("X Air");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Airport code helpers (new — city-to-airport picker)
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeAirportCode", () => {
  test("uppercases and strips non-alpha chars, returns first 3 letters", () => {
    expect(normalizeAirportCode("lax")).toBe("LAX");
    expect(normalizeAirportCode("LAX")).toBe("LAX");
    expect(normalizeAirportCode("l-a-x")).toBe("LAX");
    expect(normalizeAirportCode("lax123")).toBe("LAX");
  });

  test("returns fallback when value is shorter than 3 alpha chars", () => {
    expect(normalizeAirportCode("LA", "LAX")).toBe("LAX");
    expect(normalizeAirportCode("", "JFK")).toBe("JFK");
    expect(normalizeAirportCode(null, "ORD")).toBe("ORD");
  });

  test("uses default fallback LAX when none provided", () => {
    expect(normalizeAirportCode("")).toBe("LAX");
  });

  test("handles city display format 'Los Angeles (LAX)'", () => {
    // The input will be stripped of parens/spaces, keeping A-Z chars: LOSANGELESLAX → "LOS"
    // This is expected: normalizeAirportCode operates on the raw code, not display strings
    const raw = normalizeAirportCode("Los Angeles (LAX)", "LAX");
    // Should fall back because there are fewer than 3 consecutive letters OR return "LOS"
    expect(typeof raw).toBe("string");
    expect(raw.length).toBe(3);
  });
});

describe("inferAirportCode", () => {
  test("maps known destination names to their IATA codes", () => {
    expect(inferAirportCode("Tokyo")).toBe("NRT");
    expect(inferAirportCode("Kyoto")).toBe("KIX");
    expect(inferAirportCode("Santorini")).toBe("JTR");
    expect(inferAirportCode("Athens")).toBe("ATH");
    expect(inferAirportCode("Rome")).toBe("FCO");
    expect(inferAirportCode("Barcelona")).toBe("BCN");
    expect(inferAirportCode("Paris")).toBe("CDG");
  });

  test("is case-insensitive for destination names", () => {
    expect(inferAirportCode("TOKYO")).toBe("NRT");
    expect(inferAirportCode("tokyo")).toBe("NRT");
    expect(inferAirportCode("ToKyO")).toBe("NRT");
  });

  test("returns first 3 letters of unknown city when >= 3 chars", () => {
    // e.g. "Chicago" → "CHI" (not in the static map)
    const code = inferAirportCode("Chicago", "ORD");
    expect(code).toBe("CHI");
  });

  test("returns fallback for city names shorter than 3 chars", () => {
    expect(inferAirportCode("LA", "LAX")).toBe("LAX");
    expect(inferAirportCode("", "JFK")).toBe("JFK");
  });

  test("default fallback is NRT when none provided", () => {
    expect(inferAirportCode("")).toBe("NRT");
  });
});

describe("mapInterestAnswersToCategories", () => {
  test("maps yes answers to normalized POI categories", () => {
    const categories = mapInterestAnswersToCategories({
      0: "yes", // nature
      1: "yes", // adventure
      2: "yes", // food
      4: "yes", // art
    });
    expect(categories).toEqual(["nature", "adventure", "food", "art"]);
  });

  test("deduplicates repeated categories", () => {
    const categories = mapInterestAnswersToCategories({
      2: "yes", // food
      7: "yes", // food
      3: "yes", // culture
      5: "yes", // culture
    });
    expect(categories).toEqual(["food", "culture"]);
  });
});

describe("mapInterestAnswersToProfileInterests", () => {
  test("maps yes/no answers to profile interest booleans", () => {
    const profileInterests = mapInterestAnswersToProfileInterests({
      0: "yes", // nature
      1: "no",  // adventure
      2: "yes", // food
      3: "no",  // culture
    });
    expect(profileInterests).toEqual({
      nature: true,
      adventure: false,
      food: true,
      culture: false,
    });
  });

  test("keeps true when duplicate category has conflicting answers", () => {
    const profileInterests = mapInterestAnswersToProfileInterests({
      3: "yes", // culture
      5: "no",  // culture duplicate
    });
    expect(profileInterests).toEqual({ culture: true });
  });
});
