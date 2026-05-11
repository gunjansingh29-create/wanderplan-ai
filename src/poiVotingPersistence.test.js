import { applyPoiVoteToState, readPoiVoteRow, readVoteForVoter } from "./WanderPlanLLMFlow";

describe("POI voting persistence", () => {
  test("stores a step 7 up/down vote under the canonical POI key", () => {
    const poiRows = [{ name: "Tombs of the Kings", destination: "Paphos", category: "Culture" }];
    const voter = { id: "member-1", userId: "member-1", email: "member@example.com" };
    const next = applyPoiVoteToState({}, poiRows, {}, 0, voter, "down");
    const row = readPoiVoteRow(next, poiRows[0], 0).row;

    expect(readVoteForVoter(row, voter)).toBe("down");
  });
});
