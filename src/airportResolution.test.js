import { airportAliasFallbackCode } from "./WanderPlanLLMFlow";

describe("destination airport resolution", () => {
  test("resolves Chengdu destinations to a nearby airport when live lookup misses", () => {
    expect(airportAliasFallbackCode("Chengdu")).toBe("TFU");
    expect(airportAliasFallbackCode("Chengdu, Sichuan")).toBe("TFU");
  });

  test("resolves Cyprus resort and city stops to nearby flight airports", () => {
    expect(airportAliasFallbackCode("Ayia Napa")).toBe("LCA");
    expect(airportAliasFallbackCode("Limassol")).toBe("LCA");
    expect(airportAliasFallbackCode("Nicosia")).toBe("LCA");
    expect(airportAliasFallbackCode("Paphos")).toBe("PFO");
  });
});
