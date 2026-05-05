import {
  duplicateCrewInviteMessageForStatus,
  findCrewMemberByEmail,
  normalizePhone,
  isValidPhone,
  findCrewMemberByPhone,
} from "./wanderplan-dashboard";

describe("wanderplan dashboard crew invite duplicate guards", () => {
  test("duplicateCrewInviteMessageForStatus returns member message for joined status", () => {
    expect(duplicateCrewInviteMessageForStatus("Joined")).toBe("Already a member.");
  });

  test("duplicateCrewInviteMessageForStatus returns invite message for non-joined statuses", () => {
    expect(duplicateCrewInviteMessageForStatus("Invited")).toBe(
      "This person is already invited."
    );
    expect(duplicateCrewInviteMessageForStatus(" joined ")).toBe("Already a member.");
    expect(duplicateCrewInviteMessageForStatus("")).toBe(
      "This person is already invited."
    );
  });

  test("findCrewMemberByEmail matches email case-insensitively", () => {
    const members = [
      { email: "test@example.com", status: "Invited" },
      { email: "joined@example.com", status: "Joined" },
    ];

    expect(findCrewMemberByEmail(members, " Test@Example.com ")).toEqual(members[0]);
    expect(findCrewMemberByEmail(members, "JOINED@example.com")).toEqual(members[1]);
  });

  test("findCrewMemberByEmail returns null when not found", () => {
    const members = [{ email: "test@example.com", status: "Invited" }];

    expect(findCrewMemberByEmail(members, "other@example.com")).toBeNull();
    expect(findCrewMemberByEmail(members, " ")).toBeNull();
  });
});

describe("phone utilities", () => {
  test("normalizePhone strips non-digit characters", () => {
    expect(normalizePhone("+1 (555) 000-1234")).toBe("15550001234");
    expect(normalizePhone("555.000.1234")).toBe("5550001234");
    expect(normalizePhone("555 000 1234")).toBe("5550001234");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
  });

  test("isValidPhone accepts numbers with 7–15 digits", () => {
    expect(isValidPhone("+1 555-000-1234")).toBe(true);
    expect(isValidPhone("5550001234")).toBe(true);
    expect(isValidPhone("1234567")).toBe(true); // 7 digits — minimum
    expect(isValidPhone("123456789012345")).toBe(true); // 15 digits — maximum
  });

  test("isValidPhone rejects numbers outside valid digit range", () => {
    expect(isValidPhone("123456")).toBe(false); // 6 digits — too short
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits — too long
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });

  test("findCrewMemberByPhone matches phone digits regardless of formatting", () => {
    const members = [
      { phone: "15550001234", status: "Invited" },
      { phone: "15550009876", status: "Joined" },
    ];

    expect(findCrewMemberByPhone(members, "+1 (555) 000-1234")).toEqual(members[0]);
    expect(findCrewMemberByPhone(members, "1-555-000-9876")).toEqual(members[1]);
  });

  test("findCrewMemberByPhone returns null when not found", () => {
    const members = [{ phone: "15550001234", status: "Invited" }];

    expect(findCrewMemberByPhone(members, "+1 555-000-9999")).toBeNull();
    expect(findCrewMemberByPhone(members, "")).toBeNull();
  });

  test("findCrewMemberByPhone returns null for empty members list", () => {
    expect(findCrewMemberByPhone([], "+1 555-000-1234")).toBeNull();
  });
});

// CI trigger
