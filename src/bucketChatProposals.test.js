import {
  bucketClarifyMessage,
  bucketQueryShouldSuggestDestinations,
  bucketResolveContextualQuery,
  buildBucketChatProposals,
} from "./WanderPlanLLMFlow";

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
      [{ name: "Punta Arenas", country: "" }]
    );

    expect(proposals).toEqual([
      expect.objectContaining({ name: "Punta Arenas", country: "Chile" }),
      expect.objectContaining({ name: "Boulders Beach", country: "South Africa" }),
    ]);
  });

  test("treats culture and experience prompts as destination-suggestion requests", () => {
    expect(bucketQueryShouldSuggestDestinations("experience chinese culture")).toBe(true);
    expect(bucketQueryShouldSuggestDestinations("want to experience chinese culture")).toBe(true);
    expect(bucketQueryShouldSuggestDestinations("places to watch penguins")).toBe(true);
  });

  test("clarification message asks for a useful travel clue instead of giving up", () => {
    expect(bucketClarifyMessage("something fun")).toMatch(/region, country, season, or vibe/i);
    expect(bucketClarifyMessage("things in Chile")).toMatch(/culture, food, nature, beaches, or cities/i);
  });

  test("resolves one-word clarification replies against previous bucket context", () => {
    const history = [
      { from: "user", text: "experience chinese culture in china" },
      {
        from: "agent",
        text: "I can turn that into bucket-list ideas. Which kind of places in China should I bias toward: culture, food, nature, beaches, or cities?",
      },
    ];

    expect(bucketResolveContextualQuery("culture", history)).toBe("culture in china");
    expect(bucketQueryShouldSuggestDestinations(bucketResolveContextualQuery("culture", history))).toBe(true);
  });
});
