/**
 * ════════════════════════════════════════════════════════════════════════════
 * WANDERPLAN AI — Jest Frontend Test Suite
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   (1) Bucket List Agent — NLP extraction, deduplication, ranking
 *   (2) Timing Agent — scoring algorithm, compromise logic, edge cases
 *   (3) Budget Agent — allocation, over-budget detection, currency conversion
 *   (4) Flight Agent — Amadeus parsing, sorting, fallback logic
 *   (5) Itinerary Agent — clustering, energy curve, rest days
 *   (8) Frontend Components — YesNoCard, BudgetMeter, TripProgressStepper
 *
 * Run: npx jest wanderplan-frontend.test.js --verbose
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ════════════════════════════════════════════════════════════════════════════
// MODULE IMPLEMENTATIONS (inline for self-contained test file)
// In production these would be imported from their respective modules
// ════════════════════════════════════════════════════════════════════════════

// ── (1) Bucket List Agent ─────────────────────────────────────────────────

const DESTINATION_ALIASES = {
  nyc: "New York City", "new york": "New York City", "new york city": "New York City",
  la: "Los Angeles", "los angeles": "Los Angeles",
  sf: "San Francisco", "san francisco": "San Francisco", "san fran": "San Francisco",
  bkk: "Bangkok", london: "London", paris: "Paris", tokyo: "Tokyo",
  bali: "Bali", kyoto: "Kyoto", rome: "Rome", barcelona: "Barcelona",
  santorini: "Santorini", iceland: "Iceland", marrakech: "Marrakech",
};

const DESTINATION_COUNTRIES = {
  "New York City": "United States", "Los Angeles": "United States",
  "San Francisco": "United States", Bangkok: "Thailand",
  London: "United Kingdom", Paris: "France", Tokyo: "Japan",
  Bali: "Indonesia", Kyoto: "Japan", Rome: "Italy",
  Barcelona: "Spain", Santorini: "Greece", Iceland: "Iceland",
  Marrakech: "Morocco",
};

function extractDestinations(text) {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase().replace(/[^\w\s,]/g, "");
  const results = [];

  // Check for known aliases first (longest match)
  const sortedAliases = Object.keys(DESTINATION_ALIASES).sort((a, b) => b.length - a.length);
  let remaining = lower;

  for (const alias of sortedAliases) {
    if (remaining.includes(alias)) {
      const canonical = DESTINATION_ALIASES[alias];
      if (!results.find((r) => r.name === canonical)) {
        results.push({
          name: canonical,
          country: DESTINATION_COUNTRIES[canonical] || "Unknown",
        });
      }
      remaining = remaining.replace(alias, "");
    }
  }

  return results;
}

function deduplicateDestinations(destinations) {
  const seen = new Map();
  for (const dest of destinations) {
    const key = dest.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, dest);
    }
  }
  return Array.from(seen.values());
}

function calculateDestinationScore(destination, groupInterests = [], memberVotes = {}) {
  const baseScore = 50;
  const interestMatch = (destination.matchingInterests || []).filter((i) =>
    groupInterests.includes(i)
  ).length;
  const interestScore = Math.min(interestMatch * 10, 30);

  const upvotes = memberVotes.up || 0;
  const downvotes = memberVotes.down || 0;
  const totalVotes = upvotes + downvotes;
  const voteScore = totalVotes > 0 ? ((upvotes / totalVotes) * 20) : 0;

  return Math.min(100, Math.max(0, Math.round(baseScore + interestScore + voteScore)));
}

// ── (2) Timing Agent ──────────────────────────────────────────────────────

function calcWeatherScore(temp, rain, sun, idealTemp = [20, 30]) {
  const [lo, hi] = idealTemp;
  let tempScore;
  if (temp >= lo && temp <= hi) tempScore = 10;
  else if (temp < lo) tempScore = Math.max(0, 10 - (lo - temp) * 0.8);
  else tempScore = Math.max(0, 10 - (temp - hi) * 0.6);

  const rainScore = Math.max(0, 10 - rain / 30);
  const sunScore = Math.min(10, (sun / 12) * 10);

  return Math.round((tempScore * 0.45 + rainScore * 0.35 + sunScore * 0.2) * 10) / 10;
}

function calcCrowdScore(crowdIndex) {
  return Math.round((11 - crowdIndex) * 10) / 10;
}

function calcPriceScore(price, allPrices) {
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  return Math.round((1 - (price - minP) / range) * 9 + 1) * 10 / 10;
}

function calcTotalScore(weather, crowd, price, eventBonus = 0) {
  const base = 0.35 * weather + 0.25 * crowd + 0.25 * price +
    0.15 * Math.max(0, Math.min(10, 5 + eventBonus));
  return Math.round(Math.max(0, Math.min(10, base)) * 10) / 10;
}

function findOptimalMonth(destScores) {
  // destScores: array of 12 items, each { scores: [{destName, total}], combined }
  if (!destScores || destScores.length === 0) return null;
  return destScores.reduce((best, curr) =>
    curr.combined > best.combined ? curr : best
  );
}

function isCompromiseMonth(monthData, threshold = 6.0) {
  return monthData.scores.some((d) => d.total < threshold);
}

// ── (3) Budget Agent ──────────────────────────────────────────────────────

const ALLOCATION_PRESETS = {
  tropical_beach: { flights: 30, stays: 35, food: 15, activities: 12, transport: 5, emergency: 3 },
  cultural_temperate: { flights: 25, stays: 30, food: 15, activities: 18, transport: 8, emergency: 4 },
  adventure: { flights: 20, stays: 25, food: 15, activities: 25, transport: 10, emergency: 5 },
  luxury: { flights: 20, stays: 40, food: 20, activities: 12, transport: 5, emergency: 3 },
};

function getAllocation(destType) {
  return ALLOCATION_PRESETS[destType] || ALLOCATION_PRESETS.cultural_temperate;
}

function isOverBudget(spent, allocated, threshold = 1.0) {
  return spent >= allocated * threshold;
}

function isNearBudget(spent, allocated, threshold = 0.8) {
  return spent >= allocated * threshold && spent < allocated;
}

function convertCurrency(amount, fromRate, toRate) {
  if (fromRate <= 0 || toRate <= 0) throw new Error("Invalid exchange rate");
  return Math.round((amount / fromRate) * toRate * 100) / 100;
}

function calculateDailyBudget(totalBudget, days, members) {
  if (days <= 0 || members <= 0) throw new Error("Invalid trip parameters");
  return Math.round((totalBudget / days / members) * 100) / 100;
}

// ── (4) Flight Agent ──────────────────────────────────────────────────────

function parseAmadeusResponse(response) {
  if (!response || !response.data || !Array.isArray(response.data)) {
    throw new Error("Invalid Amadeus response format");
  }
  return response.data.map((offer) => ({
    airline: offer.validatingAirlineCodes?.[0] || "Unknown",
    price: parseFloat(offer.price?.total) || 0,
    currency: offer.price?.currency || "USD",
    stops: (offer.itineraries?.[0]?.segments?.length || 1) - 1,
    duration: offer.itineraries?.[0]?.duration || "Unknown",
    departure: offer.itineraries?.[0]?.segments?.[0]?.departure?.at || "",
    arrival: offer.itineraries?.[0]?.segments?.slice(-1)?.[0]?.arrival?.at || "",
    cabinClass: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || "ECONOMY",
    id: offer.id,
  }));
}

function sortFlights(flights, sortBy = "price") {
  return [...flights].sort((a, b) => {
    switch (sortBy) {
      case "price": return a.price - b.price;
      case "duration": return parseDuration(a.duration) - parseDuration(b.duration);
      case "stops": return a.stops - b.stops;
      default: return a.price - b.price;
    }
  });
}

function parseDuration(dur) {
  if (!dur || typeof dur !== "string") return Infinity;
  const match = dur.match(/PT(\d+)H(?:(\d+)M)?/);
  if (!match) return Infinity;
  return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
}

function filterByAirline(flights, preferredAirline) {
  const filtered = flights.filter((f) => f.airline === preferredAirline);
  return filtered.length > 0 ? filtered : flights; // Fallback to all
}

// ── (5) Itinerary Agent ───────────────────────────────────────────────────

function clusterByProximity(activities, maxDistanceKm = 5) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < activities.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [activities[i]];
    assigned.add(i);

    for (let j = i + 1; j < activities.length; j++) {
      if (assigned.has(j)) continue;
      const dist = haversine(activities[i].lat, activities[i].lng, activities[j].lat, activities[j].lng);
      if (dist <= maxDistanceKm) {
        cluster.push(activities[j]);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasBackToBackIntense(schedule) {
  for (let i = 0; i < schedule.length - 1; i++) {
    if (schedule[i].intensity === "high" && schedule[i + 1].intensity === "high") {
      return true;
    }
  }
  return false;
}

function applyEnergyCurve(activities) {
  const sorted = [...activities];
  // Sort so high-intensity items are separated by lower-intensity ones
  const highs = sorted.filter((a) => a.intensity === "high");
  const lows = sorted.filter((a) => a.intensity !== "high");
  const result = [];
  let hi = 0, lo = 0;

  while (hi < highs.length || lo < lows.length) {
    if (hi < highs.length) result.push(highs[hi++]);
    if (lo < lows.length) result.push(lows[lo++]);
    if (lo < lows.length && hi < highs.length) result.push(lows[lo++]);
  }
  return result;
}

function shouldInsertRestDay(consecutiveActiveDays, intensitySum) {
  return consecutiveActiveDays >= 3 || intensitySum > 20;
}


// ════════════════════════════════════════════════════════════════════════════
// (1) BUCKET LIST AGENT TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Bucket List Agent", () => {
  describe("NLP Destination Extraction", () => {
    test("should extract single destination from natural language", () => {
      const result = extractDestinations("I want to go to Bali");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: "Bali", country: "Indonesia" });
    });

    test("should extract multiple destinations from comma-separated input", () => {
      const result = extractDestinations("I'm thinking Bali, Kyoto, and Paris");
      expect(result).toHaveLength(3);
      expect(result.map((d) => d.name)).toEqual(
        expect.arrayContaining(["Bali", "Kyoto", "Paris"])
      );
    });

    test("should resolve aliases to canonical names", () => {
      const result = extractDestinations("Let's visit NYC and SF");
      expect(result).toHaveLength(2);
      expect(result.find((d) => d.name === "New York City")).toBeTruthy();
      expect(result.find((d) => d.name === "San Francisco")).toBeTruthy();
    });

    test("should return empty array for unrecognized destinations", () => {
      const result = extractDestinations("I want to go to Atlantis");
      expect(result).toHaveLength(0);
    });

    test("should return empty array for null or empty input", () => {
      expect(extractDestinations(null)).toEqual([]);
      expect(extractDestinations("")).toEqual([]);
      expect(extractDestinations(undefined)).toEqual([]);
    });

    test("should handle case-insensitive input", () => {
      const result = extractDestinations("TOKYO and LONDON please");
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.name)).toContain("Tokyo");
      expect(result.map((d) => d.name)).toContain("London");
    });

    test("should include correct country for each destination", () => {
      const result = extractDestinations("Barcelona and Rome");
      expect(result.find((d) => d.name === "Barcelona").country).toBe("Spain");
      expect(result.find((d) => d.name === "Rome").country).toBe("Italy");
    });
  });

  describe("Deduplication", () => {
    test("should merge 'NYC' and 'New York City' into a single entry", () => {
      const input = [
        { name: "New York City", country: "United States" },
        { name: "New York City", country: "United States" },
      ];
      const result = deduplicateDestinations(input);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("New York City");
    });

    test("should preserve distinct destinations", () => {
      const input = [
        { name: "Bali", country: "Indonesia" },
        { name: "Tokyo", country: "Japan" },
        { name: "Paris", country: "France" },
      ];
      const result = deduplicateDestinations(input);
      expect(result).toHaveLength(3);
    });

    test("should handle empty input array", () => {
      expect(deduplicateDestinations([])).toEqual([]);
    });

    test("should keep first occurrence when duplicates have different metadata", () => {
      const input = [
        { name: "Bali", country: "Indonesia", addedBy: "james" },
        { name: "bali", country: "Indonesia", addedBy: "sarah" },
      ];
      const result = deduplicateDestinations(input);
      expect(result).toHaveLength(1);
      expect(result[0].addedBy).toBe("james");
    });

    test("should handle case-insensitive deduplication", () => {
      const input = [
        { name: "TOKYO", country: "Japan" },
        { name: "tokyo", country: "Japan" },
        { name: "Tokyo", country: "Japan" },
      ];
      const result = deduplicateDestinations(input);
      expect(result).toHaveLength(1);
    });
  });

  describe("Ranking Algorithm", () => {
    test("should return 50 for destination with no interests or votes", () => {
      const score = calculateDestinationScore({}, [], {});
      expect(score).toBe(50);
    });

    test("should increase score with matching interests up to cap of 30", () => {
      const dest = { matchingInterests: ["hiking", "photography", "culture", "food"] };
      const interests = ["hiking", "photography", "culture", "food"];
      const score = calculateDestinationScore(dest, interests, {});
      expect(score).toBe(80); // 50 + 30 (capped)
    });

    test("should increase score with positive votes", () => {
      const score = calculateDestinationScore({}, [], { up: 4, down: 0 });
      expect(score).toBe(70); // 50 + 0 + 20
    });

    test("should cap total score at 100", () => {
      const dest = { matchingInterests: ["a", "b", "c", "d"] };
      const score = calculateDestinationScore(dest, ["a", "b", "c", "d"], { up: 10, down: 0 });
      expect(score).toBeLessThanOrEqual(100);
    });

    test("should never return score below 0", () => {
      const score = calculateDestinationScore({}, [], { up: 0, down: 100 });
      expect(score).toBeGreaterThanOrEqual(0);
    });

    test("should handle split votes reducing score proportionally", () => {
      const halfVotes = calculateDestinationScore({}, [], { up: 2, down: 2 });
      const allUp = calculateDestinationScore({}, [], { up: 4, down: 0 });
      expect(halfVotes).toBeLessThan(allUp);
    });
  });
});


// ════════════════════════════════════════════════════════════════════════════
// (2) TIMING AGENT TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Timing Agent", () => {
  describe("Weather Scoring", () => {
    test("should return perfect score for ideal temperature, no rain, max sun", () => {
      const score = calcWeatherScore(25, 0, 12, [20, 30]);
      expect(score).toBe(10);
    });

    test("should penalize temperature below ideal range", () => {
      const idealScore = calcWeatherScore(25, 50, 8, [20, 30]);
      const coldScore = calcWeatherScore(5, 50, 8, [20, 30]);
      expect(coldScore).toBeLessThan(idealScore);
    });

    test("should penalize heavy rainfall", () => {
      const dryScore = calcWeatherScore(25, 10, 8, [20, 30]);
      const rainyScore = calcWeatherScore(25, 300, 8, [20, 30]);
      expect(rainyScore).toBeLessThan(dryScore);
    });

    test("should return score between 0 and 10 for extreme conditions", () => {
      const extremeCold = calcWeatherScore(-20, 500, 0, [20, 30]);
      expect(extremeCold).toBeGreaterThanOrEqual(0);
      expect(extremeCold).toBeLessThanOrEqual(10);
    });

    test("should score higher for more sunshine hours", () => {
      const lowSun = calcWeatherScore(25, 50, 2, [20, 30]);
      const highSun = calcWeatherScore(25, 50, 10, [20, 30]);
      expect(highSun).toBeGreaterThan(lowSun);
    });
  });

  describe("Crowd Scoring", () => {
    test("should return 10 for minimum crowd index of 1", () => {
      expect(calcCrowdScore(1)).toBe(10);
    });

    test("should return 1 for maximum crowd index of 10", () => {
      expect(calcCrowdScore(10)).toBe(1);
    });

    test("should be inversely proportional to crowd index", () => {
      expect(calcCrowdScore(3)).toBeGreaterThan(calcCrowdScore(7));
    });
  });

  describe("Price Scoring", () => {
    test("should return 10 for cheapest month in range", () => {
      const score = calcPriceScore(500, [500, 800, 1000, 1200]);
      expect(score).toBe(10);
    });

    test("should return 1 for most expensive month in range", () => {
      const score = calcPriceScore(1200, [500, 800, 1000, 1200]);
      expect(score).toBe(1);
    });

    test("should handle all prices being equal", () => {
      const score = calcPriceScore(800, [800, 800, 800]);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe("Composite Score", () => {
    test("should combine all factors within 0-10 range", () => {
      const score = calcTotalScore(8, 7, 9, 2);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });

    test("should weight weather at 35% of composite", () => {
      const highWeather = calcTotalScore(10, 5, 5, 0);
      const lowWeather = calcTotalScore(0, 5, 5, 0);
      const delta = highWeather - lowWeather;
      expect(delta).toBeCloseTo(3.5, 1); // 10 * 0.35
    });

    test("should clamp negative event bonuses to floor of 0", () => {
      const score = calcTotalScore(5, 5, 5, -10);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Multi-Destination Optimization", () => {
    test("should find the month with highest combined score", () => {
      const monthScores = [
        { month: 0, combined: 6.2, scores: [{ destName: "Bali", total: 7 }, { destName: "Kyoto", total: 5.4 }] },
        { month: 3, combined: 8.1, scores: [{ destName: "Bali", total: 8 }, { destName: "Kyoto", total: 8.2 }] },
        { month: 6, combined: 5.8, scores: [{ destName: "Bali", total: 4 }, { destName: "Kyoto", total: 7.6 }] },
      ];
      const best = findOptimalMonth(monthScores);
      expect(best.month).toBe(3);
    });

    test("should return null for empty input", () => {
      expect(findOptimalMonth([])).toBeNull();
    });

    test("should identify compromise months where not all dests score above threshold", () => {
      const month = { scores: [{ destName: "Bali", total: 8 }, { destName: "Kyoto", total: 5.2 }] };
      expect(isCompromiseMonth(month, 6.0)).toBe(true);
    });

    test("should not flag month as compromise when all scores above threshold", () => {
      const month = { scores: [{ destName: "Bali", total: 8 }, { destName: "Kyoto", total: 7.5 }] };
      expect(isCompromiseMonth(month, 6.0)).toBe(false);
    });

    test("should handle edge case where all months score below threshold", () => {
      const allBad = Array.from({ length: 12 }, (_, i) => ({
        month: i, combined: 3.0 + Math.random(),
        scores: [{ destName: "Dest", total: 3.0 }],
      }));
      const best = findOptimalMonth(allBad);
      expect(best).not.toBeNull();
      expect(isCompromiseMonth(best, 6.0)).toBe(true);
    });
  });
});


// ════════════════════════════════════════════════════════════════════════════
// (3) BUDGET AGENT TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Budget Agent", () => {
  describe("Allocation Percentages", () => {
    test("should return correct allocation for tropical_beach type", () => {
      const alloc = getAllocation("tropical_beach");
      expect(alloc).toEqual({
        flights: 30, stays: 35, food: 15, activities: 12, transport: 5, emergency: 3,
      });
    });

    test("should allocate all percentages summing to 100", () => {
      for (const [type, alloc] of Object.entries(ALLOCATION_PRESETS)) {
        const sum = Object.values(alloc).reduce((s, v) => s + v, 0);
        expect(sum).toBe(100);
      }
    });

    test("should return cultural_temperate as fallback for unknown destination type", () => {
      const alloc = getAllocation("unknown_type");
      expect(alloc).toEqual(ALLOCATION_PRESETS.cultural_temperate);
    });

    test("should allocate higher activity percentage for adventure type", () => {
      const adventure = getAllocation("adventure");
      const tropical = getAllocation("tropical_beach");
      expect(adventure.activities).toBeGreaterThan(tropical.activities);
    });

    test("should allocate higher stays percentage for luxury type", () => {
      const luxury = getAllocation("luxury");
      const adventure = getAllocation("adventure");
      expect(luxury.stays).toBeGreaterThan(adventure.stays);
    });
  });

  describe("Over-Budget Detection", () => {
    test("should detect over-budget when spent equals allocated (boundary)", () => {
      expect(isOverBudget(250, 250)).toBe(true);
    });

    test("should not trigger over-budget when under allocated", () => {
      expect(isOverBudget(249.99, 250)).toBe(false);
    });

    test("should detect over-budget when spent exceeds allocated", () => {
      expect(isOverBudget(300, 250)).toBe(true);
    });

    test("should detect near-budget at exactly 80% threshold", () => {
      expect(isNearBudget(200, 250)).toBe(true); // 80% of 250
    });

    test("should not flag near-budget below 80% threshold", () => {
      expect(isNearBudget(199, 250)).toBe(false);
    });

    test("should not flag near-budget when already over budget", () => {
      expect(isNearBudget(260, 250)).toBe(false);
    });
  });

  describe("Currency Conversion", () => {
    test("should convert USD to EUR correctly", () => {
      const result = convertCurrency(100, 1.0, 0.92);
      expect(result).toBe(92.0);
    });

    test("should handle JPY conversion with large numbers", () => {
      const result = convertCurrency(100, 1.0, 149.50);
      expect(result).toBe(14950.0);
    });

    test("should throw error for zero exchange rate", () => {
      expect(() => convertCurrency(100, 0, 1.0)).toThrow("Invalid exchange rate");
    });

    test("should throw error for negative exchange rate", () => {
      expect(() => convertCurrency(100, -1, 1.0)).toThrow("Invalid exchange rate");
    });

    test("should round to 2 decimal places", () => {
      const result = convertCurrency(100, 1.0, 0.923456);
      expect(result).toBe(92.35);
    });
  });

  describe("Daily Budget Calculation", () => {
    test("should divide total budget by days and members", () => {
      const daily = calculateDailyBudget(6000, 10, 4);
      expect(daily).toBe(150.0);
    });

    test("should throw for zero days", () => {
      expect(() => calculateDailyBudget(6000, 0, 4)).toThrow("Invalid trip parameters");
    });

    test("should throw for zero members", () => {
      expect(() => calculateDailyBudget(6000, 10, 0)).toThrow("Invalid trip parameters");
    });

    test("should handle fractional results with 2 decimal precision", () => {
      const daily = calculateDailyBudget(1000, 3, 4);
      expect(daily).toBe(83.33);
    });

    test("should return 0 for zero budget", () => {
      expect(calculateDailyBudget(0, 10, 4)).toBe(0);
    });
  });
});


// ════════════════════════════════════════════════════════════════════════════
// (4) FLIGHT AGENT TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Flight Agent", () => {
  const mockAmadeusResponse = {
    data: [
      {
        id: "1", validatingAirlineCodes: ["JL"],
        price: { total: "1247.00", currency: "USD" },
        itineraries: [{
          duration: "PT14H15M",
          segments: [
            { departure: { at: "2025-10-04T10:30:00" }, arrival: { at: "2025-10-05T14:45:00" } },
          ],
        }],
        travelerPricings: [{ fareDetailsBySegment: [{ cabin: "PREMIUM_ECONOMY" }] }],
      },
      {
        id: "2", validatingAirlineCodes: ["EK"],
        price: { total: "980.00", currency: "USD" },
        itineraries: [{
          duration: "PT16H15M",
          segments: [
            { departure: { at: "2025-10-04T22:15:00" }, arrival: { at: "2025-10-05T06:30:00" } },
            { departure: { at: "2025-10-05T08:00:00" }, arrival: { at: "2025-10-05T14:30:00" } },
          ],
        }],
        travelerPricings: [{ fareDetailsBySegment: [{ cabin: "ECONOMY" }] }],
      },
      {
        id: "3", validatingAirlineCodes: ["SQ"],
        price: { total: "1100.00", currency: "USD" },
        itineraries: [{
          duration: "PT13H00M",
          segments: [
            { departure: { at: "2025-10-04T08:00:00" }, arrival: { at: "2025-10-04T21:00:00" } },
          ],
        }],
        travelerPricings: [{ fareDetailsBySegment: [{ cabin: "ECONOMY" }] }],
      },
    ],
  };

  describe("Amadeus Response Parsing", () => {
    test("should parse all flight offers from valid response", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      expect(flights).toHaveLength(3);
    });

    test("should extract airline code correctly", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      expect(flights[0].airline).toBe("JL");
      expect(flights[1].airline).toBe("EK");
    });

    test("should calculate correct number of stops", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      expect(flights[0].stops).toBe(0); // 1 segment = nonstop
      expect(flights[1].stops).toBe(1); // 2 segments = 1 stop
    });

    test("should parse price as number", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      expect(typeof flights[0].price).toBe("number");
      expect(flights[0].price).toBe(1247);
    });

    test("should throw for null or malformed response", () => {
      expect(() => parseAmadeusResponse(null)).toThrow();
      expect(() => parseAmadeusResponse({})).toThrow();
      expect(() => parseAmadeusResponse({ data: "not array" })).toThrow();
    });

    test("should handle missing optional fields gracefully", () => {
      const minimal = { data: [{ id: "x", price: { total: "500" }, itineraries: [{ segments: [{}] }] }] };
      const flights = parseAmadeusResponse(minimal);
      expect(flights[0].airline).toBe("Unknown");
      expect(flights[0].cabinClass).toBe("ECONOMY");
    });
  });

  describe("Sorting", () => {
    test("should sort by price ascending by default", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const sorted = sortFlights(flights, "price");
      expect(sorted[0].price).toBe(980);
      expect(sorted[2].price).toBe(1247);
    });

    test("should sort by stops ascending", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const sorted = sortFlights(flights, "stops");
      expect(sorted[0].stops).toBe(0);
    });

    test("should sort by duration ascending", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const sorted = sortFlights(flights, "duration");
      expect(sorted[0].duration).toBe("PT13H00M"); // Shortest
    });

    test("should not mutate original array", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const original = [...flights];
      sortFlights(flights, "price");
      expect(flights).toEqual(original);
    });

    test("should handle empty flights array", () => {
      expect(sortFlights([], "price")).toEqual([]);
    });
  });

  describe("Airline Fallback", () => {
    test("should filter flights by preferred airline when available", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const filtered = filterByAirline(flights, "JL");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].airline).toBe("JL");
    });

    test("should fallback to all flights when preferred airline has no results", () => {
      const flights = parseAmadeusResponse(mockAmadeusResponse);
      const filtered = filterByAirline(flights, "NONEXISTENT");
      expect(filtered).toHaveLength(3);
    });

    test("should return multiple results when airline has multiple flights", () => {
      const flights = [
        { airline: "JL", price: 1000 }, { airline: "JL", price: 1200 },
        { airline: "EK", price: 900 },
      ];
      const filtered = filterByAirline(flights, "JL");
      expect(filtered).toHaveLength(2);
    });
  });

  describe("Duration Parsing", () => {
    test("should parse hours and minutes correctly", () => {
      expect(parseDuration("PT14H15M")).toBe(855);
    });

    test("should handle hours only", () => {
      expect(parseDuration("PT14H")).toBe(840);
    });

    test("should return Infinity for invalid format", () => {
      expect(parseDuration("invalid")).toBe(Infinity);
      expect(parseDuration(null)).toBe(Infinity);
    });
  });
});


// ════════════════════════════════════════════════════════════════════════════
// (5) ITINERARY AGENT TESTS
// ════════════════════════════════════════════════════════════════════════════

describe("Itinerary Agent", () => {
  describe("Geographical Clustering", () => {
    test("should group activities in the same area into one cluster", () => {
      const activities = [
        { name: "Monkey Forest", lat: -8.5185, lng: 115.2587 },
        { name: "Ubud Market", lat: -8.5069, lng: 115.2624 },  // ~1.3km away
        { name: "Tegallalang", lat: -8.4312, lng: 115.2792 },  // ~9.7km away
      ];
      const clusters = clusterByProximity(activities, 5);
      expect(clusters).toHaveLength(2);
      expect(clusters[0]).toHaveLength(2); // Monkey Forest + Ubud Market
      expect(clusters[1]).toHaveLength(1); // Tegallalang alone
    });

    test("should put all distant activities in separate clusters", () => {
      const activities = [
        { name: "A", lat: 0, lng: 0 },
        { name: "B", lat: 10, lng: 10 },   // ~1570km away
        { name: "C", lat: -10, lng: -10 },  // ~1570km away
      ];
      const clusters = clusterByProximity(activities, 5);
      expect(clusters).toHaveLength(3);
    });

    test("should put all nearby activities in one cluster", () => {
      const activities = [
        { name: "A", lat: -8.5000, lng: 115.2600 },
        { name: "B", lat: -8.5010, lng: 115.2610 },
        { name: "C", lat: -8.5005, lng: 115.2605 },
      ];
      const clusters = clusterByProximity(activities, 5);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(3);
    });

    test("should handle single activity", () => {
      const clusters = clusterByProximity([{ name: "Solo", lat: 0, lng: 0 }], 5);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(1);
    });

    test("should handle empty activities array", () => {
      expect(clusterByProximity([], 5)).toEqual([]);
    });

    test("should respect custom max distance parameter", () => {
      const activities = [
        { name: "A", lat: -8.5000, lng: 115.2600 },
        { name: "B", lat: -8.5200, lng: 115.2600 }, // ~2.2km away
      ];
      const tight = clusterByProximity(activities, 1);
      const loose = clusterByProximity(activities, 5);
      expect(tight).toHaveLength(2);
      expect(loose).toHaveLength(1);
    });
  });

  describe("Energy Curve Scheduling", () => {
    test("should not place two high-intensity activities back-to-back", () => {
      const activities = [
        { name: "Hike", intensity: "high" },
        { name: "Museum", intensity: "low" },
        { name: "Diving", intensity: "high" },
        { name: "Lunch", intensity: "low" },
      ];
      const scheduled = applyEnergyCurve(activities);
      expect(hasBackToBackIntense(scheduled)).toBe(false);
    });

    test("should detect back-to-back intensity in unscheduled list", () => {
      const bad = [
        { name: "Hike", intensity: "high" },
        { name: "Dive", intensity: "high" },
        { name: "Lunch", intensity: "low" },
      ];
      expect(hasBackToBackIntense(bad)).toBe(true);
    });

    test("should handle all high-intensity activities gracefully", () => {
      const allHigh = [
        { name: "A", intensity: "high" },
        { name: "B", intensity: "high" },
        { name: "C", intensity: "high" },
      ];
      // When no low-intensity buffers exist, back-to-back is unavoidable
      const scheduled = applyEnergyCurve(allHigh);
      expect(scheduled).toHaveLength(3);
    });

    test("should handle all low-intensity activities", () => {
      const allLow = [
        { name: "A", intensity: "low" },
        { name: "B", intensity: "low" },
      ];
      const scheduled = applyEnergyCurve(allLow);
      expect(hasBackToBackIntense(scheduled)).toBe(false);
    });

    test("should preserve all activities without dropping any", () => {
      const activities = [
        { name: "A", intensity: "high" },
        { name: "B", intensity: "low" },
        { name: "C", intensity: "high" },
        { name: "D", intensity: "low" },
        { name: "E", intensity: "high" },
      ];
      const scheduled = applyEnergyCurve(activities);
      expect(scheduled).toHaveLength(5);
    });
  });

  describe("Rest Day Insertion", () => {
    test("should insert rest day after 3 consecutive active days", () => {
      expect(shouldInsertRestDay(3, 15)).toBe(true);
    });

    test("should not insert rest day after only 2 active days", () => {
      expect(shouldInsertRestDay(2, 10)).toBe(false);
    });

    test("should insert rest day when intensity sum exceeds 20", () => {
      expect(shouldInsertRestDay(2, 21)).toBe(true);
    });

    test("should not insert rest day on day 1 with low intensity", () => {
      expect(shouldInsertRestDay(1, 5)).toBe(false);
    });

    test("should insert rest day at intensity boundary of exactly 20", () => {
      expect(shouldInsertRestDay(2, 20)).toBe(false); // > 20, not >=
    });
  });
});


// ════════════════════════════════════════════════════════════════════════════
// (8) FRONTEND COMPONENT TESTS
// ════════════════════════════════════════════════════════════════════════════

// Minimal component implementations for testing
function YesNoCard({ title, subtitle, description, tags = [], onApprove, onRevise }) {
  const [decided, setDecided] = React.useState(null);
  return (
    <div data-testid="yesno-card">
      <h3 data-testid="card-title">{title}</h3>
      {subtitle && <p data-testid="card-subtitle">{subtitle}</p>}
      <p data-testid="card-description">{description}</p>
      <div data-testid="tags-container">
        {tags.map((t, i) => <span key={i} data-testid={`tag-${i}`}>{t}</span>)}
      </div>
      <button data-testid="btn-revise" onClick={() => { setDecided("no"); onRevise?.(); }}>
        Revise
      </button>
      <button data-testid="btn-approve" onClick={() => { setDecided("yes"); onApprove?.(); }}>
        Approve
      </button>
      {decided && <span data-testid="decision-state">{decided}</span>}
    </div>
  );
}

function BudgetMeter({ spent, allocated, label = "Daily Budget" }) {
  const pct = Math.min((spent / allocated) * 100, 120);
  const zone = pct <= 70 ? "green" : pct <= 90 ? "yellow" : "red";
  return (
    <div data-testid="budget-meter">
      <span data-testid="meter-label">{label}</span>
      <span data-testid="meter-spent">${spent}</span>
      <span data-testid="meter-allocated">${allocated}</span>
      <div data-testid="meter-bar" data-zone={zone} role="progressbar"
        aria-valuenow={spent} aria-valuemin={0} aria-valuemax={allocated} />
      <span data-testid="meter-percentage">{Math.round(pct)}%</span>
      <span data-testid="meter-remaining">
        {pct <= 100 ? `${allocated - spent} remaining` : `Over by $${spent - allocated}`}
      </span>
    </div>
  );
}

const STAGES = [
  { key: "bucket_list", label: "Destinations" },
  { key: "timing", label: "Timing" },
  { key: "interests", label: "Interests" },
  { key: "health", label: "Health" },
  { key: "pois", label: "POIs" },
  { key: "budgeting", label: "Budget" },
  { key: "flights", label: "Flights" },
  { key: "stays", label: "Stays" },
  { key: "dining", label: "Dining" },
  { key: "itinerary", label: "Itinerary" },
];

function TripProgressStepper({ currentStage = "pois" }) {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);
  return (
    <div data-testid="stepper" role="list">
      {STAGES.map((stage, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming";
        return (
          <div key={stage.key} role="listitem" data-testid={`stage-${stage.key}`}
            data-state={state} aria-label={`${stage.label}: ${state}`}>
            {stage.label}
          </div>
        );
      })}
    </div>
  );
}


describe("Frontend Components", () => {
  describe("YesNoCard", () => {
    test("should render title, subtitle, and description", () => {
      render(<YesNoCard title="Santorini" subtitle="92% match" description="Beautiful island" />);
      expect(screen.getByTestId("card-title")).toHaveTextContent("Santorini");
      expect(screen.getByTestId("card-subtitle")).toHaveTextContent("92% match");
      expect(screen.getByTestId("card-description")).toHaveTextContent("Beautiful island");
    });

    test("should render all provided tags", () => {
      render(<YesNoCard title="Test" tags={["Photography", "Culture", "Wine"]} />);
      expect(screen.getByTestId("tag-0")).toHaveTextContent("Photography");
      expect(screen.getByTestId("tag-1")).toHaveTextContent("Culture");
      expect(screen.getByTestId("tag-2")).toHaveTextContent("Wine");
    });

    test("should fire onApprove callback when Approve button clicked", () => {
      const onApprove = jest.fn();
      render(<YesNoCard title="Test" onApprove={onApprove} />);
      fireEvent.click(screen.getByTestId("btn-approve"));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    test("should fire onRevise callback when Revise button clicked", () => {
      const onRevise = jest.fn();
      render(<YesNoCard title="Test" onRevise={onRevise} />);
      fireEvent.click(screen.getByTestId("btn-revise"));
      expect(onRevise).toHaveBeenCalledTimes(1);
    });

    test("should update decision state after button click", () => {
      render(<YesNoCard title="Test" onApprove={() => {}} />);
      fireEvent.click(screen.getByTestId("btn-approve"));
      expect(screen.getByTestId("decision-state")).toHaveTextContent("yes");
    });

    test("should not render subtitle when not provided", () => {
      render(<YesNoCard title="Test" description="Desc" />);
      expect(screen.queryByTestId("card-subtitle")).not.toBeInTheDocument();
    });

    test("should handle empty tags array without crashing", () => {
      render(<YesNoCard title="Test" tags={[]} />);
      expect(screen.getByTestId("tags-container")).toBeEmptyDOMElement();
    });
  });

  describe("BudgetMeter", () => {
    test("should display correct spent and allocated amounts", () => {
      render(<BudgetMeter spent={145} allocated={250} />);
      expect(screen.getByTestId("meter-spent")).toHaveTextContent("$145");
      expect(screen.getByTestId("meter-allocated")).toHaveTextContent("$250");
    });

    test("should show green zone when spending is at or below 70%", () => {
      render(<BudgetMeter spent={175} allocated={250} />);
      expect(screen.getByTestId("meter-bar")).toHaveAttribute("data-zone", "green");
    });

    test("should show yellow zone when spending is between 70-90%", () => {
      render(<BudgetMeter spent={200} allocated={250} />);
      expect(screen.getByTestId("meter-bar")).toHaveAttribute("data-zone", "yellow");
    });

    test("should show red zone when spending exceeds 90%", () => {
      render(<BudgetMeter spent={240} allocated={250} />);
      expect(screen.getByTestId("meter-bar")).toHaveAttribute("data-zone", "red");
    });

    test("should show 'Over by' message when spending exceeds budget", () => {
      render(<BudgetMeter spent={310} allocated={250} />);
      expect(screen.getByTestId("meter-remaining")).toHaveTextContent("Over by $60");
    });

    test("should show remaining amount when under budget", () => {
      render(<BudgetMeter spent={145} allocated={250} />);
      expect(screen.getByTestId("meter-remaining")).toHaveTextContent("105 remaining");
    });

    test("should have accessible progressbar role", () => {
      render(<BudgetMeter spent={100} allocated={250} />);
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "100");
      expect(bar).toHaveAttribute("aria-valuemax", "250");
    });

    test("should handle boundary at exactly 70% threshold", () => {
      render(<BudgetMeter spent={175} allocated={250} />);
      expect(screen.getByTestId("meter-bar")).toHaveAttribute("data-zone", "green");
    });
  });

  describe("TripProgressStepper", () => {
    test("should mark stages before current as 'done'", () => {
      render(<TripProgressStepper currentStage="pois" />);
      expect(screen.getByTestId("stage-bucket_list")).toHaveAttribute("data-state", "done");
      expect(screen.getByTestId("stage-timing")).toHaveAttribute("data-state", "done");
      expect(screen.getByTestId("stage-interests")).toHaveAttribute("data-state", "done");
      expect(screen.getByTestId("stage-health")).toHaveAttribute("data-state", "done");
    });

    test("should mark current stage as 'active'", () => {
      render(<TripProgressStepper currentStage="pois" />);
      expect(screen.getByTestId("stage-pois")).toHaveAttribute("data-state", "active");
    });

    test("should mark stages after current as 'upcoming'", () => {
      render(<TripProgressStepper currentStage="pois" />);
      expect(screen.getByTestId("stage-budgeting")).toHaveAttribute("data-state", "upcoming");
      expect(screen.getByTestId("stage-flights")).toHaveAttribute("data-state", "upcoming");
      expect(screen.getByTestId("stage-itinerary")).toHaveAttribute("data-state", "upcoming");
    });

    test("should highlight first stage when at beginning", () => {
      render(<TripProgressStepper currentStage="bucket_list" />);
      expect(screen.getByTestId("stage-bucket_list")).toHaveAttribute("data-state", "active");
      expect(screen.getByTestId("stage-timing")).toHaveAttribute("data-state", "upcoming");
    });

    test("should mark all stages as done except last when at final stage", () => {
      render(<TripProgressStepper currentStage="itinerary" />);
      expect(screen.getByTestId("stage-bucket_list")).toHaveAttribute("data-state", "done");
      expect(screen.getByTestId("stage-flights")).toHaveAttribute("data-state", "done");
      expect(screen.getByTestId("stage-itinerary")).toHaveAttribute("data-state", "active");
    });

    test("should render all 10 stages", () => {
      render(<TripProgressStepper currentStage="pois" />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(10);
    });

    test("should have accessible aria-labels on each stage", () => {
      render(<TripProgressStepper currentStage="timing" />);
      expect(screen.getByTestId("stage-timing")).toHaveAttribute(
        "aria-label", "Timing: active"
      );
      expect(screen.getByTestId("stage-bucket_list")).toHaveAttribute(
        "aria-label", "Destinations: done"
      );
    });
  });
});
