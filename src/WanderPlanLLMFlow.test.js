import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  accountCacheKey,
  buildCurrentVoteActor,
  canEditVoteForMember,
  canonicalDestinationVoteKeyFromStoredKey,
  canonicalPoiVoteKeyFromStoredKey,
  dedupeVoteVoters,
  emptyUserState,
  findDuplicatePoiKeys,
  isCurrentVoteVoter,
  makeVoteUserId,
  mergeProfileIntoUser,
  mergeVoteRows,
  normalizeDestinationVoteState,
  normalizePoiStateMap,
  normalizePersonalBucketItems,
  readDestinationVoteRow,
  readPoiVoteRow,
  voteKeyAliasesFor,
  readVoteForVoter,
  resolveWizardTripId,
  summarizeDestinationVotes,
  summarizeInterestConsensus,
  summarizePoiVotes,
  wizardSyncIntervalMs,
} from "./WanderPlanLLMFlow";
import WanderPlan from "./WanderPlanLLMFlow";

describe("WanderPlanLLMFlow account persistence helpers", () => {
  test("accountCacheKey scopes cached data by token user id or email", () => {
    expect(accountCacheKey("wp-u", "test-token:user-123", "")).toBe(
      "wp-u:uid:user-123"
    );
    expect(accountCacheKey("wp-b", "", "crew@test.com")).toBe(
      "wp-b:email:crew@test.com"
    );
    expect(accountCacheKey("wp-t", "", "")).toBe("wp-t");
  });

  test("mergeProfileIntoUser replaces stale local profile fields with backend profile", () => {
    const merged = mergeProfileIntoUser(
      {
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["family"],
        interests: { hiking: false },
        budget: "luxury",
        dietary: ["Vegan"],
      },
      {
        display_name: "Crew Member",
        travel_styles: ["friends"],
        interests: { hiking: true, food: true },
        budget_tier: "budget",
        dietary: ["Halal"],
      },
      "crew@test.com",
      "Crew Member"
    );

    expect(merged).toEqual({
      name: "Crew Member",
      email: "crew@test.com",
      styles: ["friends"],
      interests: { hiking: true, food: true },
      budget: "budget",
      dietary: ["Halal"],
    });
  });

  test("normalizePersonalBucketItems keeps backend ids on personal bucket entries", () => {
    expect(
      normalizePersonalBucketItems([
        { id: "bucket-1", destination: "Kyoto", name: "Kyoto" },
      ])
    ).toEqual([{ id: "bucket-1", destination: "Kyoto", name: "Kyoto" }]);
  });

  test("wizardSyncIntervalMs uses fast polling for collaborative steps", () => {
    expect(wizardSyncIntervalMs(1)).toBe(1200);
    expect(wizardSyncIntervalMs(2)).toBe(1200);
    expect(wizardSyncIntervalMs(3)).toBe(1200);
    expect(wizardSyncIntervalMs(5)).toBe(1200);
    expect(wizardSyncIntervalMs(6)).toBe(1200);
    expect(wizardSyncIntervalMs(4)).toBe(3000);
  });

  test("resolveWizardTripId falls back to newTrip id when currentTripId is missing", () => {
    expect(
      resolveWizardTripId("", { id: "trip-from-new-trip" })
    ).toBe("trip-from-new-trip");
    expect(
      resolveWizardTripId("", { id: "trip-from-new-trip" }, { id: "trip-from-view" })
    ).toBe("trip-from-view");
    expect(
      resolveWizardTripId("trip-from-current", { id: "trip-from-new-trip" }, { id: "trip-from-view" })
    ).toBe("trip-from-current");
  });
});

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

  test("isCurrentVoteVoter matches on any shared alias", () => {
    const current = {
      id: "email:bob@test.com",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    const voter = {
      id: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    expect(isCurrentVoteVoter(voter, current)).toBe(true);
  });

  test("canEditVoteForMember always allows organizer veto access", () => {
    const current = {
      id: "email:organizer@test.com",
      userId: "00000000-0000-0000-0000-000000000001",
      email: "organizer@test.com",
    };
    const crew = {
      id: "00000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000002",
      email: "bob@test.com",
    };
    expect(canEditVoteForMember(crew, current, true)).toBe(true);
    expect(canEditVoteForMember(crew, current, false)).toBe(false);
  });

  test("dedupeVoteVoters merges the same member represented by uuid and email aliases", () => {
    expect(
      dedupeVoteVoters([
        {
          id: "email:bob@test.com",
          email: "bob@test.com",
          name: "Bob Email",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          userId: "00000000-0000-0000-0000-000000000002",
          email: "bob@test.com",
          name: "Bob UUID",
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: "email:bob@test.com",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      }),
    ]);
  });

  test("buildCurrentVoteActor avoids transient me id for synced trips", () => {
    expect(
      buildCurrentVoteActor(
        "test-token:user-123",
        { email: "" },
        "00000000-0000-0000-0000-000000000111"
      )
    ).toEqual({
      id: "user-123",
      userId: "user-123",
      email: "",
    });
    expect(
      buildCurrentVoteActor(
        "",
        { email: "crew@test.com" },
        "00000000-0000-0000-0000-000000000111"
      )
    ).toEqual({
      id: "email:crew@test.com",
      userId: "",
      email: "crew@test.com",
    });
    expect(
      buildCurrentVoteActor("", { email: "" }, "")
    ).toEqual({
      id: "me",
      userId: "",
      email: "",
    });
  });

  test("mergeVoteRows combines votes stored under multiple destination aliases", () => {
    expect(
      mergeVoteRows(
        {
          "dest:auckland": { "user-a": "up" },
          "trip-dest-0-auckland": { "user-b": "down" },
        },
        ["dest:auckland", "trip-dest-0-auckland"]
      )
    ).toEqual({
      "user-a": "up",
      "user-b": "down",
    });
  });

  test("canonicalDestinationVoteKeyFromStoredKey maps legacy trip destination ids to canonical keys", () => {
    expect(canonicalDestinationVoteKeyFromStoredKey("trip-dest-0-auckland")).toBe(
      "dest:auckland"
    );
    expect(canonicalDestinationVoteKeyFromStoredKey("dest:sydney")).toBe(
      "dest:sydney"
    );
    expect(canonicalDestinationVoteKeyFromStoredKey("custom-row")).toBe(
      "custom-row"
    );
  });

  test("normalizeDestinationVoteState collapses legacy and canonical destination rows", () => {
    expect(
      normalizeDestinationVoteState({
        "trip-dest-0-auckland": {
          "user-a": "up",
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "email:crew@test.com": "up",
          "user-b": "up",
        },
      })
    ).toEqual({
      "dest:auckland": {
        "user-a": "up",
        "email:crew@test.com": "up",
        "user-b": "up",
      },
    });
  });

  test("readDestinationVoteRow merges canonical and legacy destination keys", () => {
    const row = readDestinationVoteRow(
      {
        "dest:auckland": { "user-a": "up" },
        "trip-dest-0-auckland": { "user-b": "up" },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" }
    );
    expect(row["user-a"]).toBe("up");
    expect(row["user-b"]).toBe("up");
  });

  test("readDestinationVoteRow lets canonical destination votes override stale legacy rows", () => {
    const row = readDestinationVoteRow(
      {
        "trip-dest-0-auckland": {
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "email:crew@test.com": "up",
        },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" }
    );
    expect(row["email:crew@test.com"]).toBe("up");
  });

  test("summarizeDestinationVotes counts 2 of 2 yes votes as complete majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:auckland": { "user-a": "up", "user-b": "up" },
      },
      { name: "Auckland", vote_key: "dest:auckland" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes treats split votes as complete but not majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:sydney": { "user-a": "up", "user-b": "down" },
      },
      { name: "Sydney", vote_key: "dest:sydney" },
      voters,
      2
    );
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(false);
  });

  test("summarizeDestinationVotes keeps incomplete voting out of majority", () => {
    const voters = [{ id: "user-a" }, { id: "user-b" }];
    const summary = summarizeDestinationVotes(
      {
        "dest:melbourne": { "user-a": "up" },
      },
      { name: "Melbourne", vote_key: "dest:melbourne" },
      voters,
      2
    );
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(1);
    expect(summary.allVoted).toBe(false);
    expect(summary.majorityWin).toBe(false);
  });

  test("summarizeDestinationVotes handles alias-mixed rows for 3 voters", () => {
    const voters = [
      { id: "email:organizer@test.com", email: "organizer@test.com" },
      { id: "00000000-0000-0000-0000-000000000002", userId: "00000000-0000-0000-0000-000000000002", email: "bob@test.com" },
      { id: "user-c" },
    ];
    const summary = summarizeDestinationVotes(
      {
        "dest:queenstown": {
          "email:organizer@test.com": "up",
        },
        "trip-dest-0-queenstown": {
          "00000000-0000-0000-0000-000000000002": "up",
          "user-c": "down",
        },
      },
      { name: "Queenstown", vote_key: "dest:queenstown", id: "trip-dest-0-queenstown" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(3);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes dedupes overlapping voter aliases before counting", () => {
    const voters = [
      { id: "user-a" },
      { id: "email:bob@test.com", email: "bob@test.com" },
      {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "bob@test.com",
      },
    ];
    const summary = summarizeDestinationVotes(
      {
        "dest:kyoto": {
          "user-a": "up",
          "00000000-0000-0000-0000-000000000002": "up",
        },
      },
      { name: "Kyoto", vote_key: "dest:kyoto" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes reflects organizer veto when canonical row flips destination to in", () => {
    const voters = [
      { id: "organizer-1" },
      {
        id: "email:crew@test.com",
        email: "crew@test.com",
      },
    ];
    const summary = summarizeDestinationVotes(
      {
        "trip-dest-0-auckland": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
        "dest:auckland": {
          "organizer-1": "up",
          "email:crew@test.com": "up",
        },
      },
      { name: "Auckland", vote_key: "dest:auckland", id: "trip-dest-0-auckland" },
      voters,
      2
    );
    expect(summary.up).toBe(2);
    expect(summary.down).toBe(0);
    expect(summary.votedCount).toBe(2);
    expect(summary.allVoted).toBe(true);
    expect(summary.majorityWin).toBe(true);
  });

  test("summarizeDestinationVotes keeps total up/down tally in sync after organizer veto", () => {
    const voters = [
      { id: "organizer-1" },
      { id: "email:crew@test.com", email: "crew@test.com" },
    ];
    const beforeVeto = summarizeDestinationVotes(
      {
        "dest:sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
      },
      { name: "Sydney", vote_key: "dest:sydney", id: "trip-dest-0-sydney" },
      voters,
      2
    );
    const afterVeto = summarizeDestinationVotes(
      {
        "trip-dest-0-sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "down",
        },
        "dest:sydney": {
          "organizer-1": "up",
          "email:crew@test.com": "up",
        },
      },
      { name: "Sydney", vote_key: "dest:sydney", id: "trip-dest-0-sydney" },
      voters,
      2
    );

    expect(beforeVeto.up).toBe(1);
    expect(beforeVeto.down).toBe(1);
    expect(afterVeto.up).toBe(2);
    expect(afterVeto.down).toBe(0);
    expect(afterVeto.votedCount).toBe(2);
    expect(afterVeto.allVoted).toBe(true);
    expect(afterVeto.majorityWin).toBe(true);
  });

  test("findDuplicatePoiKeys flags repeated canonical POIs in the shortlist", () => {
    expect(
      findDuplicatePoiKeys([
        { poi_id: "poi-1", name: "Sky Tower", destination: "Auckland", category: "Culture" },
        { poi_id: "poi-1", name: "Sky Tower", destination: "Auckland", category: "Culture" },
        { name: "Laneway Food Tour", destination: "Melbourne", category: "Food" },
      ])
    ).toEqual([
      expect.objectContaining({
        key: "poi:poi-1",
        indexes: [0, 1],
      }),
    ]);
  });

  test("canonicalPoiVoteKeyFromStoredKey maps legacy index keys via known poi lookup", () => {
    expect(
      canonicalPoiVoteKeyFromStoredKey("0", {
        0: { name: "Sky Tower", destination: "Auckland", category: "Culture" },
      })
    ).toBe("poi:sky-tower-auckland-culture");
    expect(canonicalPoiVoteKeyFromStoredKey("poi:abc", {})).toBe("poi:abc");
    expect(canonicalPoiVoteKeyFromStoredKey("missing", {})).toBe("");
  });

  test("normalizePoiStateMap collapses legacy index rows into canonical POI keys", () => {
    expect(
      normalizePoiStateMap(
        {
          0: { "user-a": "up" },
          "poi:sky-tower-auckland-culture": { "user-b": "down" },
        },
        [{ name: "Sky Tower", destination: "Auckland", category: "Culture" }],
        {}
      )
    ).toEqual({
      "poi:sky-tower-auckland-culture": {
        "user-a": "up",
        "user-b": "down",
      },
    });
  });

  test("readPoiVoteRow prefers canonical key over legacy index rows", () => {
    const meta = readPoiVoteRow(
      {
        0: { "user-a": "down" },
        "poi:sky-tower-auckland-culture": { "user-a": "up", "user-b": "up" },
      },
      { name: "Sky Tower", destination: "Auckland", category: "Culture" },
      0
    );
    expect(meta.key).toBe("poi:sky-tower-auckland-culture");
    expect(meta.row).toEqual({ "user-a": "up", "user-b": "up" });
  });

  test("summarizePoiVotes dedupes member aliases and counts synced votes correctly", () => {
    const voters = [
      { id: "organizer-1" },
      { id: "email:crew@test.com", email: "crew@test.com" },
      {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000002",
        email: "crew@test.com",
      },
    ];
    const summary = summarizePoiVotes(
      {
        "poi:sky-tower-auckland-culture": {
          "organizer-1": "up",
          "00000000-0000-0000-0000-000000000002": "down",
        },
      },
      { name: "Sky Tower", destination: "Auckland", category: "Culture" },
      0,
      voters
    );
    expect(summary.key).toBe("poi:sky-tower-auckland-culture");
    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.votedCount).toBe(2);
    expect(summary.totalVoters).toBe(2);
  });
});

describe("WanderPlanLLMFlow post-auth hydration", () => {
  const originalFetch = global.fetch;

  function jsonResponse(body) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
  });

  test("crew login replaces stale cached profile and bucket with backend data", async () => {
    window.localStorage.setItem(
      "wp-u",
      JSON.stringify({
        name: "Organizer",
        email: "organizer@test.com",
        styles: ["family"],
        interests: { hiking: false },
        budget: "luxury",
        dietary: ["Vegan"],
      })
    );
    window.localStorage.setItem(
      "wp-b",
      JSON.stringify([
        {
          id: "old-bucket-1",
          name: "Auckland",
          country: "New Zealand",
        },
      ])
    );

    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/auth/login" && method === "POST") {
        return jsonResponse({
          accessToken: "test-token:crew-user",
          name: "Crew Member",
        });
      }
      if (path === "/me/profile" && method === "GET") {
        return jsonResponse({
          profile: {
            display_name: "Crew Member",
            travel_styles: ["friends"],
            interests: { food: true, culture: true },
            budget_tier: "budget",
            dietary: ["Halal"],
          },
        });
      }
      if (path === "/me/bucket-list" && method === "GET") {
        return jsonResponse({
          items: [
            {
              id: "crew-bucket-1",
              destination: "Kyoto",
              name: "Kyoto",
              country: "Japan",
              tags: ["culture"],
              best_months: [3, 4],
              bestMonths: [3, 4],
              cost_per_day: 180,
              costPerDay: 180,
              best_time_desc: "Spring",
              bestTimeDesc: "Spring",
              cost_note: "Peak blossom season",
              costNote: "Peak blossom season",
            },
          ],
        });
      }
      if (path === "/crew/peer-profiles" && method === "GET") {
        return jsonResponse({ peers: [] });
      }
      if (path === "/me/trips" && method === "GET") {
        return jsonResponse({ trips: [] });
      }
      if (path === "/crew/invites/sent" && method === "GET") {
        return jsonResponse({ invites: [] });
      }
      return jsonResponse({});
    });

    render(<WanderPlan />);

    fireEvent.click(await screen.findByText("Start your bucket list"));
    fireEvent.change(await screen.findByPlaceholderText("Email"), {
      target: { value: "crew@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());

    fireEvent.click(screen.getByText("Profile"));
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Crew Member")).not.toBeNull()
    );

    fireEvent.click(screen.getByText("Bucket List"));
    await waitFor(() => expect(screen.queryByText("Kyoto")).not.toBeNull());
    expect(screen.queryByText("Auckland")).toBeNull();

    const scopedUser = JSON.parse(
      window.localStorage.getItem("wp-u:uid:crew-user") || "{}"
    );
    const scopedBucket = JSON.parse(
      window.localStorage.getItem("wp-b:uid:crew-user") || "[]"
    );
    expect(scopedUser.name).toBe("Crew Member");
    expect(scopedUser.email).toBe("crew@test.com");
    expect(scopedBucket).toHaveLength(1);
    expect(scopedBucket[0].name).toBe("Kyoto");
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
