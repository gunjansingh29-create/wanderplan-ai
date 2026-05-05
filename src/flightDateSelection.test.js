import { resolveManualFlightDateEdit } from "./WanderPlanLLMFlow";

describe("manual flight date selection", () => {
  test("selecting a departure date keeps the field editable and fills the matching trip return date", () => {
    expect(resolveManualFlightDateEdit({ origin: "DTW" }, "depart", "2026-06-10", 10)).toEqual(
      expect.objectContaining({
        origin: "DTW",
        depart: "2026-06-10",
        ret: "2026-06-19",
      })
    );
  });

  test("selecting a return date fills the matching trip departure date when needed", () => {
    expect(resolveManualFlightDateEdit({}, "ret", "2026-06-19", 10)).toEqual(
      expect.objectContaining({
        depart: "2026-06-10",
        ret: "2026-06-19",
      })
    );
  });
});
