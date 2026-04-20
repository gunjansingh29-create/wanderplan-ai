import {
  duplicateCrewInviteMessageForStatus,
  findCrewMemberByEmail,
} from "./wanderplan-dashboard";

describe("wanderplan dashboard crew invite duplicate guards", () => {
  test("duplicateCrewInviteMessageForStatus returns member message for joined status", () => {
    expect(duplicateCrewInviteMessageForStatus("Joined")).toBe("Already a member.");
  });

  test("duplicateCrewInviteMessageForStatus returns invite message for non-joined statuses", () => {
    expect(duplicateCrewInviteMessageForStatus("Invited")).toBe(
      "This person is already invited."
    );
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
