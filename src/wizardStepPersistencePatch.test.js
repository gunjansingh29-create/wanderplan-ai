import { withPersistedWizardStep } from "./WanderPlanLLMFlow";

describe("wizard step persistence patch", () => {
  test("adds current_step and wizard order version to step-specific saves", () => {
    expect(withPersistedWizardStep({ state: { poi_status: { 0: "yes" } } }, 7)).toEqual({
      current_step: 7,
      state: {
        poi_status: { 0: "yes" },
        wizard_order_version: 3,
      },
    });
  });
});
