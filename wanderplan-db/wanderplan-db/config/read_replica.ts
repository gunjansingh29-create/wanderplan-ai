/**
 * WanderPlan AI — Read Replica Routing
 * Sends read-heavy queries (search, POIs, analytics) to the read replica.
 * Writes and transactional reads go to the primary.
 *
 * Uses Prisma Client Extensions (GA in Prisma 5+).
 */

import { PrismaClient } from "@prisma/client";
import { readReplicas } from "@prisma/extension-read-replicas";

// ════════════════════════════════════════════════════════════════════════════
// CLIENT SETUP
// ════════════════════════════════════════════════════════════════════════════

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL, // Primary (read-write)
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
}).$extends(
  readReplicas({
    url: process.env.DATABASE_REPLICA_URL!, // Read replica
  })
);

export default prisma;

// ════════════════════════════════════════════════════════════════════════════
// USAGE PATTERNS
// ════════════════════════════════════════════════════════════════════════════

/**
 * READ from replica (automatic for findMany, findFirst, findUnique, count, aggregate):
 *
 *   const pois = await prisma.pointOfInterest.findMany({ ... });
 *   // → routed to replica automatically
 *
 * WRITE to primary (automatic for create, update, delete, upsert):
 *
 *   await prisma.trip.create({ ... });
 *   // → routed to primary automatically
 *
 * FORCE PRIMARY for reads that need strong consistency:
 *
 *   const trip = await prisma.$primary().trip.findUnique({ ... });
 *   // → forced to primary
 *
 * TRANSACTIONS always use primary:
 *
 *   await prisma.$transaction([...]);
 *   // → primary only
 */

// ════════════════════════════════════════════════════════════════════════════
// SERVICE-LEVEL ROUTING HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Search service — always reads from replica.
 * Includes: POI search, bucket list search, full-text queries.
 */
export class SearchService {
  async searchPOIs(tripId: string, query: string, limit = 20) {
    // Replica: read-only full-text search
    return prisma.$queryRaw`
      SELECT id, name, destination, category, rating,
             ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) AS rank
      FROM points_of_interest
      WHERE trip_id = ${tripId}::UUID
        AND search_vector @@ websearch_to_tsquery('english', ${query})
        AND deleted_at IS NULL
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
  }

  async searchBucketList(tripId: string, query: string) {
    return prisma.$queryRaw`
      SELECT id, destination_name, country, rank_score,
             ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) AS rank
      FROM bucket_list_items
      WHERE trip_id = ${tripId}::UUID
        AND search_vector @@ websearch_to_tsquery('english', ${query})
        AND deleted_at IS NULL
      ORDER BY rank DESC
      LIMIT 20
    `;
  }

  async fuzzySearchPOIs(tripId: string, query: string, threshold = 0.3) {
    return prisma.$queryRaw`
      SELECT id, name, destination, category, similarity(name, ${query}) AS sim
      FROM points_of_interest
      WHERE trip_id = ${tripId}::UUID
        AND similarity(name, ${query}) > ${threshold}
        AND deleted_at IS NULL
      ORDER BY sim DESC
      LIMIT 20
    `;
  }
}

/**
 * Analytics service — always reads from replica.
 * Write path uses primary (event ingestion).
 */
export class AnalyticsService {
  // READ: replica
  async getScreenEngagement(days = 30) {
    return prisma.analyticsEvent.groupBy({
      by: ["screenName", "eventType"],
      _count: { id: true },
      where: {
        createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
      },
      orderBy: { _count: { id: "desc" } },
    });
  }

  // READ: replica
  async getUserActivity(userId: string, limit = 100) {
    return prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  // WRITE: automatically goes to primary
  async trackEvent(data: {
    userId: string;
    tripId?: string;
    screenName: string;
    eventType: string;
    eventData?: Record<string, unknown>;
  }) {
    return prisma.analyticsEvent.create({ data });
  }
}

/**
 * POI service — reads from replica, writes to primary.
 */
export class POIService {
  // READ: replica (automatic)
  async getByTrip(tripId: string, category?: string) {
    return prisma.pointOfInterest.findMany({
      where: {
        tripId,
        ...(category ? { category: category as any } : {}),
        approved: true,
        deletedAt: null,
      },
      orderBy: { rating: "desc" },
    });
  }

  // READ requiring strong consistency (after write): force primary
  async getByIdConsistent(id: string) {
    return prisma.$primary().pointOfInterest.findUnique({
      where: { id },
    });
  }

  // WRITE: primary (automatic)
  async approve(id: string) {
    return prisma.pointOfInterest.update({
      where: { id },
      data: { approved: true },
    });
  }
}

/**
 * Itinerary service — reads from replica for display, primary for edits.
 */
export class ItineraryService {
  // READ: replica
  async getFullItinerary(tripId: string) {
    return prisma.itineraryDay.findMany({
      where: { tripId, deletedAt: null },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { dayNumber: "asc" },
    });
  }

  // WRITE: primary (transactional — reorder items)
  async reorderItems(dayId: string, itemIds: string[]) {
    return prisma.$transaction(
      itemIds.map((id, index) =>
        prisma.itineraryItem.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
  }
}
