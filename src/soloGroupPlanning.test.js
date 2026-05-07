import { consensusStageKeyForStep } from "./WanderPlanLLMFlow";

describe("solo vs group planning consensus", () => {
  test("group stays and dining use organizer consensus stages", () => {
    expect(consensusStageKeyForStep(10, false)).toBe("stays");
    expect(consensusStageKeyForStep(11, false)).toBe("dining");
  });

  test("solo stays and dining skip group voting and organizer veto semantics", () => {
    expect(consensusStageKeyForStep(10, true)).toBe("");
    expect(consensusStageKeyForStep(11, true)).toBe("");
  });
});
