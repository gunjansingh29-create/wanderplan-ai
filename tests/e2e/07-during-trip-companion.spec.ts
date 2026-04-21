import { test, expect } from '@playwright/test';
import { setupApiMocks } from './fixtures/api-mock';

const ACTIVE_TRIP_ID = '11111111-1111-4111-8111-111111111111';

test.describe('07 - During-trip companion', () => {
  test.beforeEach(async ({ page }) => {
    let companionFetchCount = 0;
    let liveCompanion = {
      trip: {
        id: ACTIVE_TRIP_ID,
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Active Tokyo Sprint',
        status: 'active',
        duration_days: 7,
      },
      is_ready: true,
      readiness_reason: null,
      locked_window: { start: '2026-06-01', end: '2026-06-07' },
      current_step: 14,
      members: [
        {
          user_id: '00000000-0000-0000-0000-000000000001',
          role: 'owner',
          status: 'accepted',
          display_name: 'Alice Test',
          email: 'alice@test.com',
        },
      ],
      today: {
        day_number: 1,
        date: '2026-06-01',
        title: 'Arrival Day',
        approved: true,
        items: [
          {
            activity_id: 'act-1',
            time_slot: '09:00-10:00',
            title: 'Land in Tokyo',
            category: 'flight',
            location: 'Haneda Airport',
            live_status: 'pending',
            live_updated_by_name: null,
          },
          {
            activity_id: 'act-2',
            time_slot: '13:00-14:00',
            title: 'Check in at hotel',
            category: 'checkin',
            location: 'Shinjuku',
            live_status: 'pending',
            live_updated_by_name: null,
          },
        ],
      },
      upcoming: [
        {
          day_number: 2,
          date: '2026-06-02',
          title: 'Culture Day',
          approved: true,
          items: [
            {
              activity_id: 'act-3',
              time_slot: '10:00-11:30',
              title: 'Senso-ji Temple',
              category: 'culture',
              location: 'Asakusa',
            },
          ],
        },
      ],
      current_item: {
        activity_id: 'act-1',
        time_slot: '09:00-10:00',
        title: 'Land in Tokyo',
        category: 'flight',
        location: 'Haneda Airport',
      },
      next_item: {
        activity_id: 'act-2',
        time_slot: '13:00-14:00',
        title: 'Check in at hotel',
        category: 'checkin',
        location: 'Shinjuku',
      },
      today_checkins: [
        { activity_id: 'act-1', status: 'pending', updated_by: null, updated_by_name: null, updated_at: null },
        { activity_id: 'act-2', status: 'pending', updated_by: null, updated_by_name: null, updated_at: null },
      ],
      day_progress: {
        total_items: 2,
        done: 0,
        skipped: 0,
        in_progress: 0,
        pending: 2,
        completed_items: 0,
        completion_pct: 0,
        last_updated_at: null,
      },
      stays: [
        {
          destination: 'Tokyo',
          name: 'Shinjuku Grand',
          type: 'Hotel',
          rate_per_night: 220,
          total_nights: 3,
          booking_source: 'WanderPlan Search',
          why_this_one: "Walkable to tonight's plan.",
        },
      ],
      today_meals: [
        {
          day: 1,
          date: '2026-06-01',
          destination: 'Tokyo',
          type: 'Dinner',
          time: '19:00',
          name: 'Izakaya Hanabi',
          cuisine: 'Japanese',
          cost: 42,
          note: 'Easy walk from the hotel.',
        },
      ],
      days: [],
      stats: { day_count: 7, approved_days: 7, item_count: 12 },
    };

    await setupApiMocks(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('wp-auth', JSON.stringify('test-token:00000000-0000-0000-0000-000000000001'));
      window.localStorage.setItem(
        'wp-u:uid:00000000-0000-0000-0000-000000000001',
        JSON.stringify({
          name: 'Alice Test',
          email: 'alice@test.com',
          styles: ['solo'],
          interests: { culture: true, food: true },
          budget: 'moderate',
          dietary: [],
        })
      );
    });

    await page.route('**/me/trips', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          trips: [
            {
              id: ACTIVE_TRIP_ID,
              owner_id: '00000000-0000-0000-0000-000000000001',
              name: 'Active Tokyo Sprint',
              status: 'active',
              duration_days: 7,
              my_status: 'accepted',
              my_role: 'owner',
              destinations: ['Tokyo', 'Kyoto'],
              members: [
                {
                  user_id: '00000000-0000-0000-0000-000000000001',
                  role: 'owner',
                  status: 'accepted',
                  name: 'Alice Test',
                  email: 'alice@test.com',
                  profile: { display_name: 'Alice Test', budget_tier: 'moderate' },
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route(`**/${ACTIVE_TRIP_ID}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          trip: {
            id: ACTIVE_TRIP_ID,
            owner_id: '00000000-0000-0000-0000-000000000001',
            name: 'Active Tokyo Sprint',
            status: 'active',
            duration_days: 7,
            members: [],
          },
        }),
      });
    });

    await page.route(`**/${ACTIVE_TRIP_ID}/companion*`, async route => {
      companionFetchCount += 1;
      if (companionFetchCount > 1) {
        liveCompanion = {
          ...liveCompanion,
          current_item: {
            activity_id: 'act-2',
            time_slot: '10:15-11:00',
            title: 'Walk to Sydney Opera House',
            category: 'transit',
            location: 'Sydney Harbour',
          },
          next_item: {
            activity_id: 'act-3',
            time_slot: '11:15-12:15',
            title: 'Opera House guided entry',
            category: 'culture',
            location: 'Sydney Opera House',
          },
        };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ companion: liveCompanion }),
      });
    });

    await page.route(`**/${ACTIVE_TRIP_ID}/planning-state`, async route => {
      const body = route.request().postDataJSON() as any;
      const patch = body?.state?.companion_checkins?.['act-1'];
      if (patch) {
        liveCompanion = {
          ...liveCompanion,
          today: {
            ...liveCompanion.today,
            items: liveCompanion.today.items.map((item) =>
              item.activity_id === 'act-1'
                ? { ...item, live_status: patch.status, live_updated_by_name: 'Alice Test' }
                : item
            ),
          },
          today_checkins: liveCompanion.today_checkins.map((row) =>
            row.activity_id === 'act-1'
              ? { ...row, status: patch.status, updated_by: patch.updated_by, updated_by_name: 'Alice Test', updated_at: patch.updated_at }
              : row
          ),
          day_progress: {
            total_items: 2,
            done: patch.status === 'done' ? 1 : 0,
            skipped: patch.status === 'skipped' ? 1 : 0,
            in_progress: patch.status === 'in_progress' ? 1 : 0,
            pending: patch.status === 'pending' ? 2 : 1,
            completed_items: patch.status === 'done' || patch.status === 'skipped' ? 1 : 0,
            completion_pct: patch.status === 'done' || patch.status === 'skipped' ? 50 : 0,
            last_updated_at: patch.updated_at,
          },
        };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: body?.state || {}, updated_at: '2026-06-01T10:00:00Z' }),
      });
    });

    await page.goto('/');
  });

  test('active trip detail opens live companion and renders trip context', async ({ page }) => {
    await expect(page.getByText('Active Tokyo Sprint')).toBeVisible({ timeout: 8000 });
    await page.getByText('Active Tokyo Sprint').click();

    await expect(page.getByText('Open Live Companion')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Continue Planning')).toHaveCount(0);

    await page.getByText('Open Live Companion').click();

    await expect(page.getByText('Live Companion')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("TODAY'S PLAN")).toBeVisible();
    await expect(page.getByText('Land in Tokyo').first()).toBeVisible();
    await expect(page.getByText('Culture Day')).toBeVisible();
    await expect(page.getByText('Trip Window')).toBeVisible();
    await expect(page.getByText('NOW / NEXT')).toBeVisible();
    await expect(page.getByText('TODAY PROGRESS')).toBeVisible();
    await expect(page.getByText('QUICK ACTIONS')).toBeVisible();
    await expect(page.getByText('Open Itinerary')).toBeVisible();
    await expect(page.getByText('Share via WhatsApp')).toBeVisible();
    await expect(page.getByText('Copy Trip Summary')).toBeVisible();
    await expect(page.getByText('Copy Invite Link')).toBeVisible();
    await expect(page.getByText('STAY SNAPSHOT')).toBeVisible();
    await expect(page.getByText('Shinjuku Grand')).toBeVisible();
    await expect(page.getByText('DINING TODAY')).toBeVisible();
    await expect(page.getByText('Izakaya Hanabi')).toBeVisible();
    await expect(page.getByText('Walk to Sydney Opera House')).toHaveCount(0);

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Updated just now')).toBeVisible();
    await expect(page.getByText('Walk to Sydney Opera House')).toBeVisible();
    await expect(page.getByText('Opera House guided entry')).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).first().click();
    await expect(page.getByText('Updated by Alice Test')).toBeVisible();
    await expect(page.getByText('50%')).toBeVisible();

    await page.getByText('Open Itinerary').click();
    await expect(page.getByText('Itinerary')).toBeVisible();
  });

  test('active trips without locked dates or itinerary show recovery state', async ({ page }) => {
    const notReadyCompanion = {
      trip: {
        id: ACTIVE_TRIP_ID,
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Active Tokyo Sprint',
        status: 'active',
        duration_days: 7,
      },
      is_ready: false,
      readiness_reason: 'locked_dates_and_itinerary_required',
      locked_window: { start: null, end: null },
      current_step: 4,
      members: [
        {
          user_id: '00000000-0000-0000-0000-000000000001',
          role: 'owner',
          status: 'accepted',
          display_name: 'Alice Test',
          email: 'alice@test.com',
        },
      ],
      today: null,
      upcoming: [],
      current_item: null,
      next_item: null,
      today_checkins: [],
      day_progress: {},
      stays: [],
      today_meals: [],
      days: [],
      stats: { day_count: 0, approved_days: 0, item_count: 0 },
    };

    await page.unroute(`**/${ACTIVE_TRIP_ID}/companion*`);
    await page.route(`**/${ACTIVE_TRIP_ID}/companion*`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ companion: notReadyCompanion }),
      });
    });

    await expect(page.getByText('Active Tokyo Sprint')).toBeVisible({ timeout: 8000 });
    await page.getByText('Active Tokyo Sprint').click();
    await page.getByText('Open Live Companion').click();

    await expect(page.getByText('LIVE COMPANION SETUP')).toBeVisible();
    await expect(page.getByText("Live Companion isn't ready yet")).toBeVisible();
    await expect(page.getByText("TODAY'S PLAN")).toHaveCount(0);
    await expect(page.getByText('TODAY PROGRESS')).toHaveCount(0);
  });
});
