import { airportAliasFallbackCode } from "./WanderPlanLLMFlow";

describe("destination airport resolution", () => {
  test("does not hand-code destination names into airport aliases", () => {
    expect(airportAliasFallbackCode("Chengdu")).toBe("");
    expect(airportAliasFallbackCode("Chengdu, Sichuan")).toBe("");
    expect(airportAliasFallbackCode("Ayia Napa")).toBe("");
    expect(airportAliasFallbackCode("Limassol")).toBe("");
    expect(airportAliasFallbackCode("Nicosia")).toBe("");
    expect(airportAliasFallbackCode("Paphos")).toBe("");
  });
});
