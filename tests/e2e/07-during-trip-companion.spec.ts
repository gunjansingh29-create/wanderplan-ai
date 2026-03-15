import { test, expect } from '@playwright/test';
import { setupApiMocks } from './fixtures/api-mock';

const ACTIVE_TRIP_ID = '11111111-1111-4111-8111-111111111111';

test.describe('07 - During-trip companion', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route(`**/${ACTIVE_TRIP_ID}/companion`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          companion: {
            trip: {
              id: ACTIVE_TRIP_ID,
              owner_id: '00000000-0000-0000-0000-000000000001',
              name: 'Active Tokyo Sprint',
              status: 'active',
              duration_days: 7,
            },
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
                },
                {
                  activity_id: 'act-2',
                  time_slot: '13:00-14:00',
                  title: 'Check in at hotel',
                  category: 'checkin',
                  location: 'Shinjuku',
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
            days: [],
            stats: { day_count: 7, approved_days: 7, item_count: 12 },
          },
        }),
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
    await expect(page.getByText('Land in Tokyo')).toBeVisible();
    await expect(page.getByText('Culture Day')).toBeVisible();
    await expect(page.getByText('Trip Window')).toBeVisible();
  });
});
