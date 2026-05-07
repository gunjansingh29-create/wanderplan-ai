import { airportAliasFallbackCode } from "./WanderPlanLLMFlow";

describe("destination airport resolution", () => {
  test("resolves Chengdu destinations to a nearby airport when live lookup misses", () => {
    expect(airportAliasFallbackCode("Chengdu")).toBe("TFU");
    expect(airportAliasFallbackCode("Chengdu, Sichuan")).toBe("TFU");
  });
});
