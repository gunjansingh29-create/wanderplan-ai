import { acceptedPoiRowsForDuration } from "./WanderPlanLLMFlow";

describe("duration accepted activities", () => {
  test("counts accepted POIs from the shared option pool", () => {
    const pool = {
      "poi:paphos-park": {
        name: "Paphos Archaeological Park Exploration",
        destination: "Paphos",
        category: "Culture",
      },
      "poi:troodos-hike": {
        name: "Troodos Mountain Hiking Trail",
        destination: "Limassol",
        category: "Nature",
      },
    };

    expect(acceptedPoiRowsForDuration([], pool, { 0: "yes", 1: "yes" }).map((p) => p.name)).toEqual([
      "Paphos Archaeological Park Exploration",
      "Troodos Mountain Hiking Trail",
    ]);
  });
});
