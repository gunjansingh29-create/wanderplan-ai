import { profilePayloadSignatureFor, shouldPersistProfile } from "./WanderPlanLLMFlow";

describe("WanderPlanLLMFlow profile autosave dedupe", () => {
  test("does not persist when payload values are unchanged across new object references", () => {
    const baseUser = {
      name: "Traveler",
      email: "traveler@example.com",
      styles: ["couple"],
      interests: { hiking: true, food: false },
      budget: "moderate",
      dietary: ["Vegetarian"],
    };
    const sameValuesDifferentRef = {
      name: "Traveler",
      email: "traveler@example.com",
      styles: ["couple"],
      interests: { hiking: true, food: false },
      budget: "moderate",
      dietary: ["Vegetarian"],
    };

    const savedSignature = profilePayloadSignatureFor(baseUser);
    expect(shouldPersistProfile(savedSignature, sameValuesDifferentRef)).toBe(false);
  });

  test("persists when profile payload changes", () => {
    const baseUser = {
      name: "Traveler",
      email: "traveler@example.com",
      styles: ["couple"],
      interests: { hiking: true },
      budget: "moderate",
      dietary: [],
    };
    const changedUser = { ...baseUser, budget: "premium" };

    const savedSignature = profilePayloadSignatureFor(baseUser);
    expect(shouldPersistProfile(savedSignature, changedUser)).toBe(true);
  });
});
