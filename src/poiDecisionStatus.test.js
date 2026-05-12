import { readPoiDecisionStatus } from "./WanderPlanLLMFlow";

describe("POI decision status", () => {
  test("reads persisted canonical POI status keys", () => {
    const poi = { name: "Cape Greco National Forest Park Hiking", destination: "Ayia Napa", category: "Nature" };
    const status = {
      "poi:cape-greco-national-forest-park-hiking-ayia-napa-nature": "yes",
    };

    expect(readPoiDecisionStatus(status, poi, 0)).toBe("yes");
  });
});
