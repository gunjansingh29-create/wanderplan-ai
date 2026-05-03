import { buildBucketChatProposals } from "./WanderPlanLLMFlow";

describe("bucket chat proposal normalization", () => {
  test("builds LLM returned destinations without falling through to the generic error path", () => {
    const proposals = buildBucketChatProposals(
      [
        {
          name: "Punta Arenas",
          country: "Chile",
          bestMonths: [10, 11, 12, 1, 2, 3],
          costPerDay: 220,
          tags: ["Nature", "Photography"],
          bestTimeDesc: "Spring through summer for penguin colonies.",
          costNote: "Guided boat trips add to daily spend.",
        },
        {
          name: "Boulders Beach",
          country: "South Africa",
          bestMonths: [11, 12, 1, 2, 3],
          costPerDay: 180,
          tags: ["Beach", "Nature", "Photography"],
        },
        {
          name: "Punta Arenas",
          country: "Chile",
          bestMonths: [10, 11, 12],
        },
      ],
      []
    );

    expect(proposals).toEqual([
      expect.objectContaining({ name: "Punta Arenas", country: "Chile" }),
      expect.objectContaining({ name: "Boulders Beach", country: "South Africa" }),
    ]);
  });
});
