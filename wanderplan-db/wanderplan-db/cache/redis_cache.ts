/**
 * WanderPlan AI — Redis Caching Layer
 *
 * Cache tiers:
 *   • trip_plan documents      → 5 min TTL
 *   • flight/hotel search      → 15 min TTL
 *   • user profiles            → 1 hr TTL
 *
 * Invalidation: event-driven via service hooks + pub/sub
 */

import Redis from "ioredis";

// ════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT
// ════════════════════════════════════════════════════════════════════════════

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    return Math.min(times * 200, 5000);
  },
  enableReadyCheck: true,
  lazyConnect: false,
});

// Separate connection for pub/sub (Redis requirement)
const redisSub = redis.duplicate();

// ════════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

interface CacheTierConfig {
  prefix: string;
  ttlSeconds: number;
  description: string;
}

const CACHE_TIERS: Record<string, CacheTierConfig> = {
  TRIP_PLAN: {
    prefix: "trip_plan",
    ttlSeconds: 300, // 5 minutes
    description: "Master trip plan documents (read by all agents)",
  },
  FLIGHT_SEARCH: {
    prefix: "flight_search",
    ttlSeconds: 900, // 15 minutes
    description: "Flight search results from Amadeus/Skyscanner",
  },
  HOTEL_SEARCH: {
    prefix: "hotel_search",
    ttlSeconds: 900, // 15 minutes
    description: "Hotel search results from Booking/Expedia",
  },
  USER_PROFILE: {
    prefix: "user_profile",
    ttlSeconds: 3600, // 1 hour
    description: "User profile + preferences",
  },
  ITINERARY: {
    prefix: "itinerary",
    ttlSeconds: 300, // 5 minutes (changes frequently during planning)
    description: "Full itinerary with items per trip",
  },
  BUDGET: {
    prefix: "budget",
    ttlSeconds: 300, // 5 minutes
    description: "Budget breakdown with actual vs allocated",
  },
  POI_LIST: {
    prefix: "poi_list",
    ttlSeconds: 600, // 10 minutes
    description: "POIs for a trip, filtered by category or interests",
  },
  HEALTH_REQS: {
    prefix: "health_reqs",
    ttlSeconds: 86400, // 24 hours (rarely changes)
    description: "Health/vaccination requirements per destination",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// CACHE MANAGER
// ════════════════════════════════════════════════════════════════════════════

function buildKey(tier: CacheTierConfig, ...parts: string[]): string {
  return `wp:${tier.prefix}:${parts.join(":")}`;
}

export class CacheManager {
  /**
   * Read-through cache: returns cached value or calls loader, caches result.
   */
  async getOrSet<T>(
    tier: CacheTierConfig,
    keyParts: string[],
    loader: () => Promise<T>,
    ttlOverride?: number
  ): Promise<T> {
    const key = buildKey(tier, ...keyParts);
    const cached = await redis.get(key);

    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const value = await loader();
    const ttl = ttlOverride ?? tier.ttlSeconds;

    if (value !== null && value !== undefined) {
      await redis.setex(key, ttl, JSON.stringify(value));
    }

    return value;
  }

  /**
   * Write-through: update cache when data changes.
   */
  async set<T>(tier: CacheTierConfig, keyParts: string[], value: T, ttlOverride?: number): Promise<void> {
    const key = buildKey(tier, ...keyParts);
    const ttl = ttlOverride ?? tier.ttlSeconds;
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  /**
   * Invalidate a specific cache entry.
   */
  async invalidate(tier: CacheTierConfig, ...keyParts: string[]): Promise<void> {
    const key = buildKey(tier, ...keyParts);
    await redis.del(key);
  }

  /**
   * Invalidate all entries for a tier + partial key (e.g. all caches for a trip).
   */
  async invalidatePattern(tier: CacheTierConfig, pattern: string): Promise<number> {
    const fullPattern = `wp:${tier.prefix}:${pattern}*`;
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    return deleted;
  }

  /**
   * Invalidate ALL caches related to a specific trip.
   */
  async invalidateTripCaches(tripId: string): Promise<void> {
    const promises = [
      this.invalidate(CACHE_TIERS.TRIP_PLAN, tripId),
      this.invalidatePattern(CACHE_TIERS.FLIGHT_SEARCH, tripId),
      this.invalidatePattern(CACHE_TIERS.HOTEL_SEARCH, tripId),
      this.invalidatePattern(CACHE_TIERS.ITINERARY, tripId),
      this.invalidatePattern(CACHE_TIERS.BUDGET, tripId),
      this.invalidatePattern(CACHE_TIERS.POI_LIST, tripId),
      this.invalidatePattern(CACHE_TIERS.HEALTH_REQS, tripId),
    ];
    await Promise.all(promises);
  }
}

const cache = new CacheManager();

// ════════════════════════════════════════════════════════════════════════════
// SERVICE-SPECIFIC CACHE WRAPPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Trip Plan Cache — 5 minute TTL
 *
 * Invalidated when:
 *   • Any agent writes to the trip plan
 *   • Trip status changes
 *   • Members are added/removed
 *   • Budget is updated
 */
export class TripPlanCache {
  async get(tripId: string, loader: () => Promise<any>): Promise<any> {
    return cache.getOrSet(CACHE_TIERS.TRIP_PLAN, [tripId], loader);
  }

  async invalidate(tripId: string): Promise<void> {
    await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    // Publish invalidation event for other service instances
    await redis.publish("cache:invalidate", JSON.stringify({
      tier: "TRIP_PLAN",
      tripId,
      timestamp: Date.now(),
    }));
  }
}

/**
 * Flight Search Cache — 15 minute TTL
 *
 * Key: trip_id + origin + destination + dates + cabin_class
 * Invalidated when:
 *   • User changes search parameters
 *   • TTL expires (prices change frequently)
 *   • Flight is selected/deselected
 */
export class FlightSearchCache {
  buildSearchKey(params: {
    tripId: string;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    cabinClass: string;
  }): string[] {
    return [
      params.tripId,
      params.origin,
      params.destination,
      params.departureDate,
      params.returnDate || "oneway",
      params.cabinClass,
    ];
  }

  async get(params: Parameters<this["buildSearchKey"]>[0], loader: () => Promise<any>): Promise<any> {
    return cache.getOrSet(CACHE_TIERS.FLIGHT_SEARCH, this.buildSearchKey(params), loader);
  }

  async invalidateForTrip(tripId: string): Promise<void> {
    await cache.invalidatePattern(CACHE_TIERS.FLIGHT_SEARCH, tripId);
  }
}

/**
 * Hotel Search Cache — 15 minute TTL
 *
 * Key: trip_id + destination + checkin + checkout + guests
 * Invalidated when:
 *   • User changes search parameters
 *   • TTL expires
 *   • Accommodation is selected/deselected
 */
export class HotelSearchCache {
  buildSearchKey(params: {
    tripId: string;
    destination: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }): string[] {
    return [
      params.tripId,
      params.destination,
      params.checkIn,
      params.checkOut,
      String(params.guests),
    ];
  }

  async get(params: Parameters<this["buildSearchKey"]>[0], loader: () => Promise<any>): Promise<any> {
    return cache.getOrSet(CACHE_TIERS.HOTEL_SEARCH, this.buildSearchKey(params), loader);
  }

  async invalidateForTrip(tripId: string): Promise<void> {
    await cache.invalidatePattern(CACHE_TIERS.HOTEL_SEARCH, tripId);
  }
}

/**
 * User Profile Cache — 1 hour TTL
 *
 * Invalidated when:
 *   • User updates their profile
 *   • User changes preferences
 *   • User changes dietary restrictions
 */
export class UserProfileCache {
  async get(userId: string, loader: () => Promise<any>): Promise<any> {
    return cache.getOrSet(CACHE_TIERS.USER_PROFILE, [userId], loader);
  }

  async invalidate(userId: string): Promise<void> {
    await cache.invalidate(CACHE_TIERS.USER_PROFILE, userId);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION TRIGGERS (Event-driven)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Invalidation trigger map — defines which cache entries to bust
 * when a database write occurs.
 *
 * Integrate these into your service layer or Prisma middleware.
 */
export const INVALIDATION_TRIGGERS: Record<
  string,
  { description: string; handler: (data: any) => Promise<void> }
> = {
  // ── Trip Plan triggers ──────────────────────────────────────────
  "trip.statusChanged": {
    description: "Trip status changes (e.g. planning → confirmed)",
    handler: async ({ tripId }) => {
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },
  "trip.memberAdded": {
    description: "New member joins a trip",
    handler: async ({ tripId, userId }) => {
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
      // Also invalidate POI relevance (group interests changed)
      await cache.invalidatePattern(CACHE_TIERS.POI_LIST, tripId);
    },
  },
  "trip.memberRemoved": {
    description: "Member leaves a trip",
    handler: async ({ tripId, userId }) => {
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
      await cache.invalidatePattern(CACHE_TIERS.POI_LIST, tripId);
    },
  },

  // ── Agent write triggers ────────────────────────────────────────
  "agent.wroteToTripPlan": {
    description: "Any agent writes output to the trip plan",
    handler: async ({ tripId }) => {
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },

  // ── Budget triggers ─────────────────────────────────────────────
  "budget.updated": {
    description: "Budget allocation or daily budget changed",
    handler: async ({ tripId }) => {
      await cache.invalidate(CACHE_TIERS.BUDGET, tripId);
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },

  // ── Itinerary triggers ──────────────────────────────────────────
  "itinerary.dayAdded": {
    description: "New day added to itinerary",
    handler: async ({ tripId }) => {
      await cache.invalidatePattern(CACHE_TIERS.ITINERARY, tripId);
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },
  "itinerary.itemReordered": {
    description: "Items within a day reordered or modified",
    handler: async ({ tripId }) => {
      await cache.invalidatePattern(CACHE_TIERS.ITINERARY, tripId);
    },
  },

  // ── Flight triggers ─────────────────────────────────────────────
  "flight.selected": {
    description: "User selects a flight option",
    handler: async ({ tripId }) => {
      await new FlightSearchCache().invalidateForTrip(tripId);
      await cache.invalidate(CACHE_TIERS.BUDGET, tripId);
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },
  "flight.searchParamsChanged": {
    description: "User modifies flight search criteria",
    handler: async ({ tripId }) => {
      await new FlightSearchCache().invalidateForTrip(tripId);
    },
  },

  // ── Hotel triggers ──────────────────────────────────────────────
  "hotel.selected": {
    description: "User selects an accommodation",
    handler: async ({ tripId }) => {
      await new HotelSearchCache().invalidateForTrip(tripId);
      await cache.invalidate(CACHE_TIERS.BUDGET, tripId);
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },
  "hotel.searchParamsChanged": {
    description: "User modifies hotel search criteria",
    handler: async ({ tripId }) => {
      await new HotelSearchCache().invalidateForTrip(tripId);
    },
  },

  // ── POI triggers ────────────────────────────────────────────────
  "poi.approved": {
    description: "POI approved or removed from trip",
    handler: async ({ tripId }) => {
      await cache.invalidatePattern(CACHE_TIERS.POI_LIST, tripId);
      await cache.invalidate(CACHE_TIERS.TRIP_PLAN, tripId);
    },
  },

  // ── User profile triggers ──────────────────────────────────────
  "user.profileUpdated": {
    description: "User updates profile, preferences, or dietary restrictions",
    handler: async ({ userId, tripIds }) => {
      await new UserProfileCache().invalidate(userId);
      // Invalidate POI relevance for all user's trips (interests changed)
      for (const tripId of tripIds || []) {
        await cache.invalidatePattern(CACHE_TIERS.POI_LIST, tripId);
      }
    },
  },
};

// ════════════════════════════════════════════════════════════════════════════
// PRISMA MIDDLEWARE — Auto-invalidation on writes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Attach to Prisma client to automatically invalidate caches on mutations.
 *
 * Usage:
 *   prisma.$use(cacheInvalidationMiddleware);
 */
export async function cacheInvalidationMiddleware(
  params: any,
  next: (params: any) => Promise<any>
) {
  const result = await next(params);
  const { model, action } = params;

  // Only trigger on write operations
  if (!["create", "update", "delete", "upsert", "updateMany", "deleteMany"].includes(action)) {
    return result;
  }

  try {
    switch (model) {
      case "Trip":
        if (result?.id) {
          await INVALIDATION_TRIGGERS["trip.statusChanged"].handler({ tripId: result.id });
        }
        break;

      case "TripMember":
        if (result?.tripId) {
          const trigger = action === "delete"
            ? INVALIDATION_TRIGGERS["trip.memberRemoved"]
            : INVALIDATION_TRIGGERS["trip.memberAdded"];
          await trigger.handler({ tripId: result.tripId, userId: result.userId });
        }
        break;

      case "TripBudget":
        if (result?.tripId) {
          await INVALIDATION_TRIGGERS["budget.updated"].handler({ tripId: result.tripId });
        }
        break;

      case "ItineraryDay":
      case "ItineraryItem":
        const tripId = result?.tripId || params?.args?.where?.tripId;
        if (tripId) {
          await INVALIDATION_TRIGGERS["itinerary.dayAdded"].handler({ tripId });
        }
        break;

      case "FlightOption":
        if (result?.searchId) {
          // Look up trip from search → invalidate
          // In practice, pass tripId through the service layer
        }
        break;

      case "UserProfile":
        if (result?.userId) {
          await INVALIDATION_TRIGGERS["user.profileUpdated"].handler({ userId: result.userId });
        }
        break;

      case "PointOfInterest":
        if (result?.tripId) {
          await INVALIDATION_TRIGGERS["poi.approved"].handler({ tripId: result.tripId });
        }
        break;
    }
  } catch (error) {
    // Cache invalidation failures should never break the main flow
    console.error("Cache invalidation error:", error);
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════
// PUB/SUB — Cross-instance cache invalidation
// ════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to cache invalidation events from other service instances.
 * Each instance invalidates its local references when it receives a message.
 */
export function startCacheInvalidationListener(): void {
  redisSub.subscribe("cache:invalidate", (err) => {
    if (err) console.error("Redis subscribe error:", err);
  });

  redisSub.on("message", async (_channel, message) => {
    try {
      const event = JSON.parse(message);
      const tier = CACHE_TIERS[event.tier as keyof typeof CACHE_TIERS];
      if (tier && event.tripId) {
        await cache.invalidate(tier, event.tripId);
      }
    } catch (error) {
      console.error("Cache invalidation listener error:", error);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK & STATS
// ════════════════════════════════════════════════════════════════════════════

export async function getCacheStats(): Promise<Record<string, any>> {
  const info = await redis.info("memory");
  const keyspace = await redis.info("keyspace");

  const tierStats: Record<string, number> = {};
  for (const [name, config] of Object.entries(CACHE_TIERS)) {
    let cursor = "0";
    let count = 0;
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `wp:${config.prefix}:*`, "COUNT", 1000);
      cursor = next;
      count += keys.length;
    } while (cursor !== "0");
    tierStats[name] = count;
  }

  return {
    connected: redis.status === "ready",
    memory: info,
    keyspace,
    tiers: tierStats,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export {
  redis,
  cache,
  CACHE_TIERS,
  TripPlanCache,
  FlightSearchCache,
  HotelSearchCache,
  UserProfileCache,
};
