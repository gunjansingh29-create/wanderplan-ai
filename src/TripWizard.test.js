import { getUserIdFromToken, normalizeFlightLegRows } from "./TripWizard";

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
});
