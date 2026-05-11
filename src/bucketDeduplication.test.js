import {
  isTempBucketId,
  normalizePersonalBucketItems,
  upsertBucketItemList,
} from "./WanderPlanLLMFlow";

describe("bucket list deduplication — quick-pick no-duplicate fix", () => {
  // ── isTempBucketId ────────────────────────────────────────────────────

  test("isTempBucketId detects sendBL temp ids (d<timestamp>-<idx>)", () => {
    expect(isTempBucketId("d1746634109000-0")).toBe(true);
    expect(isTempBucketId("d1234567-2")).toBe(true);
    // IDs starting with 'd' but not matching d<digits>-<digits> are not temp
    expect(isTempBucketId("d123abc")).toBe(false);
  });

  test("isTempBucketId detects tmp- prefixed ids", () => {
    expect(isTempBucketId("tmp-1")).toBe(true);
    expect(isTempBucketId("tmp-abc")).toBe(true);
  });

  test("isTempBucketId detects trip-ai-dest- prefixed ids", () => {
    expect(isTempBucketId("trip-ai-dest-1234-0")).toBe(true);
  });

  test("isTempBucketId returns false for server-assigned UUIDs", () => {
    expect(isTempBucketId("bucket-1")).toBe(false);
    expect(isTempBucketId("abc123")).toBe(false);
    expect(isTempBucketId("server-uuid-kyoto")).toBe(false);
  });

  test("isTempBucketId returns true for empty or missing ids", () => {
    expect(isTempBucketId("")).toBe(true);
    expect(isTempBucketId(null)).toBe(true);
    expect(isTempBucketId(undefined)).toBe(true);
  });

  // ── normalizePersonalBucketItems deduplication ────────────────────────

  test("normalizePersonalBucketItems removes exact duplicate destination names", () => {
    const result = normalizePersonalBucketItems([
      { id: "server-1", name: "Tokyo", country: "Japan" },
      { id: "server-2", name: "Tokyo", country: "Japan" },
      { id: "server-3", name: "Paris", country: "France" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("server-1");
    expect(result[0].name).toBe("Tokyo");
    expect(result[1].name).toBe("Paris");
  });

  test("normalizePersonalBucketItems removes case-variant duplicates", () => {
    const result = normalizePersonalBucketItems([
      { id: "a", name: "bali" },
      { id: "b", name: "Bali" },
      { id: "c", name: "BALI" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  test("normalizePersonalBucketItems removes up to 7 duplicates (bug scenario)", () => {
    const dupes = Array.from({ length: 7 }, (_, i) => ({
      id: `server-${i + 1}`,
      name: "Kyoto",
      country: "Japan",
    }));
    const result = normalizePersonalBucketItems(dupes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-1");
  });

  test("normalizePersonalBucketItems keeps first occurrence for destination field", () => {
    const result = normalizePersonalBucketItems([
      { id: "a", destination: "Santorini" },
      { id: "b", destination: "Santorini" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  test("normalizePersonalBucketItems filters out items with empty or missing name fields", () => {
    const result = normalizePersonalBucketItems([
      { id: "a", name: "" },
      { id: "b" },
      { id: "c", name: null },
      { id: "d", destination: "Kyoto" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("d");
  });

  test("normalizePersonalBucketItems preserves distinct destinations", () => {
    const result = normalizePersonalBucketItems([
      { id: "1", name: "Tokyo", country: "Japan" },
      { id: "2", name: "Paris", country: "France" },
      { id: "3", name: "New York", country: "US" },
    ]);
    expect(result).toHaveLength(3);
  });

  // ── upsertBucketItemList ID promotion ────────────────────────────────

  test("upsertBucketItemList promotes server id when existing item has a sendBL temp id", () => {
    const result = upsertBucketItemList(
      [{ id: "d1746634109000-0", name: "Kyoto", country: "Japan", tags: ["Culture"] }],
      { id: "server-uuid-kyoto", name: "Kyoto", country: "Japan", tags: ["Culture", "Food"] }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-uuid-kyoto");
    expect(result[0].tags).toEqual(["Culture", "Food"]);
  });

  test("upsertBucketItemList promotes server id when existing item has a tmp- temp id", () => {
    const result = upsertBucketItemList(
      [{ id: "tmp-1", name: "Buenos Aires", country: "Argentina" }],
      { id: "server-ba", name: "Buenos Aires", country: "Argentina" }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-ba");
  });

  test("upsertBucketItemList promotes server id when existing item has a trip-ai-dest- temp id", () => {
    const result = upsertBucketItemList(
      [{ id: "trip-ai-dest-1234-0", name: "Lisbon", country: "Portugal" }],
      { id: "server-lisbon", name: "Lisbon", country: "Portugal" }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-lisbon");
  });

  test("upsertBucketItemList keeps existing server id when updating with a temp id", () => {
    const result = upsertBucketItemList(
      [{ id: "server-existing", name: "Bali", country: "Indonesia" }],
      { id: "tmp-new", name: "Bali", country: "Indonesia" }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-existing");
  });

  test("upsertBucketItemList keeps existing temp id when both are temp (tags updated)", () => {
    const result = upsertBucketItemList(
      [{ id: "tmp-1", name: "Buenos Aires", country: "Argentina", tags: ["Culture"] }],
      { id: "tmp-2", name: "Buenos Aires", country: "Argentina", tags: ["Food"] }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tmp-1");
    expect(result[0].tags).toEqual(["Food"]);
  });

  test("upsertBucketItemList appends new item when destination does not exist", () => {
    const result = upsertBucketItemList(
      [{ id: "server-1", name: "Tokyo", country: "Japan" }],
      { id: "server-2", name: "Paris", country: "France" }
    );
    expect(result).toHaveLength(2);
  });
});
