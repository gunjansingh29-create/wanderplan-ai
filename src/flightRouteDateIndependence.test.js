import { resolveFlightDatesAfterRouteStopEdit } from "./WanderPlanLLMFlow";

describe("flight route date independence", () => {
  test("editing first destination arrival date does not overwrite outbound journey dates", () => {
    expect(
      resolveFlightDatesAfterRouteStopEdit(
        { origin: "DTW", final_airport: "DTW", depart: "2026-05-10", ret: "2026-05-17" },
        0,
        "travel_date",
        "2026-05-11"
      )
    ).toEqual({
      origin: "DTW",
      final_airport: "DTW",
      depart: "2026-05-10",
      ret: "2026-05-17",
    });
  });
});
