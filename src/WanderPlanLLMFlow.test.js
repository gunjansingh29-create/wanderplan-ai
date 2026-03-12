import {
  makeVoteUserId,
  voteKeyAliasesFor,
  readVoteForVoter,
  summarizeInterestConsensus,
} from "./WanderPlanLLMFlow";

describe("WanderPlanLLMFlow vote identity helpers", () => {
  test("makeVoteUserId prefers user id, then email fallback", () => {
    expect(makeVoteUserId("u-123", "a@test.com", "member-1")).toBe("u-123");
    expect(makeVoteUserId("", "a@test.com", "member-1")).toBe("email:a@test.com");
    expect(makeVoteUserId("", "", "member-1")).toBe("member-1");
  });

  test("voteKeyAliasesFor returns unique aliases for id/userId/email", () => {
    expect(
      voteKeyAliasesFor({
        id: "email:bob@test.com",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      })
    ).toEqual([
      "email:bob@test.com",
      "00000000-0000-0000-0000-000000000002",
    ]);
  });

  test("readVoteForVoter resolves vote by any alias key", () => {
    const voter = {
      id: "email:bob@test.com",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };

    expect(
      readVoteForVoter(
        { "00000000-0000-0000-0000-000000000002": "up" },
        voter
      )
    ).toBe("up");
    expect(readVoteForVoter({ "email:bob@test.com": "down" }, voter)).toBe(
      "down"
    );
  });

  test("readVoteForVoter normalizes yes/no to up/down", () => {
    const voter = { id: "u-1" };
    expect(readVoteForVoter({ "u-1": "yes" }, voter)).toBe("up");
    expect(readVoteForVoter({ "u-1": "no" }, voter)).toBe("down");
  });
});

describe("WanderPlanLLMFlow Step 3 interest consensus", () => {
  test("counts only current user + accepted/joined members", () => {
    const members = [
      {
        id: "m-accepted",
        status: "accepted",
        profile: { interests: { hiking: true } },
      },
      {
        id: "m-invited",
        status: "invited",
        profile: { interests: { hiking: true } },
      },
      {
        id: "m-selected-joined",
        status: "selected",
        profile: { interests: { hiking: false } },
      },
      {
        id: "m-accepted-no-answer",
        status: "accepted",
        profile: { interests: {} },
      },
    ];

    const summary = summarizeInterestConsensus(
      "hiking",
      { hiking: true },
      members,
      { "m-selected-joined": true }
    );

    // Included: current user yes, accepted yes, selected+joined no
    expect(summary.yesCount).toBe(2);
    expect(summary.totalCount).toBe(3);
    expect(summary.pct).toBe(67);
  });

  test("returns zero percentage when nobody has a boolean answer", () => {
    const summary = summarizeInterestConsensus(
      "culture",
      {},
      [{ id: "m1", status: "accepted", profile: { interests: {} } }],
      {}
    );
    expect(summary.yesCount).toBe(0);
    expect(summary.totalCount).toBe(0);
    expect(summary.pct).toBe(0);
  });
});
