import { shouldContinueAfterFlightPlanningSaveError } from "./WanderPlanLLMFlow";

describe("flight confirmation save failure handling", () => {
  test("continues after transient planning-state save failure once flight selection succeeded", () => {
    expect(shouldContinueAfterFlightPlanningSaveError(new Error("planning_state_save_failed"))).toBe(true);
    expect(shouldContinueAfterFlightPlanningSaveError(new Error("HTTP 500"))).toBe(false);
  });
});
