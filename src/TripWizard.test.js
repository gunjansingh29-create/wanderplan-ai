import { getUserIdFromToken } from "./TripWizard";

describe("TripWizard token helpers", () => {
  test("extracts user id from test token format", () => {
    expect(getUserIdFromToken("test-token:00000000-0000-0000-0000-000000000001")).toBe(
      "00000000-0000-0000-0000-000000000001"
    );
  });

  test("returns empty string for invalid token", () => {
    expect(getUserIdFromToken("Bearer abc")).toBe("");
    expect(getUserIdFromToken("")).toBe("");
  });
});
