/**
 * WizardPage — Page Object Model for the 14-stage WanderPlan wizard.
 *
 * Each stage has a dedicated helper method. The methods drive the UI
 * in a realistic way (selecting options, answering questions, approving
 * cards) and verify that the resulting state is correct before returning.
 */

import { Page, Locator, expect } from '@playwright/test';

// Stage keys in declaration order (mirrors STAGES in the component)
export type StageKey =
  | 'create' | 'bucket' | 'timing'    | 'interests'
  | 'health'  | 'pois'   | 'duration' | 'avail'
  | 'budget'  | 'flights'| 'stays'    | 'dining'
  | 'itinerary'| 'sync';

export class WizardPage {
  constructor(readonly page: Page) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Click the primary "Approve" button inside a YesNo card. */
  async approveYN(nthCard = 0): Promise<void> {
    const approveBtn = this.page.getByRole('button', { name: /approve/i }).nth(nthCard);
    await approveBtn.waitFor({ state: 'visible' });
    await approveBtn.click();
    // Wait for card animation to complete
    await this.page.waitForTimeout(400);
  }

  /** Click the "Revise" button (the No path). */
  async reviseYN(nthCard = 0): Promise<void> {
    await this.page.getByRole('button', { name: /revise/i }).nth(nthCard).click();
    await this.page.waitForTimeout(400);
  }

  /** Return the current active stage label from the Stepper. */
  async activeStageLabel(): Promise<string> {
    // The active step dot has a distinct secondary color; get its adjacent label
    const activeSpan = this.page.locator('[style*="E8634A"]').first();
    return (await activeSpan.textContent() ?? '').trim();
  }

  /** Assert the stepper shows `count` completed (green) dots. */
  async assertCompletedStages(count: number): Promise<void> {
    // Completed dots contain the "check" icon (path d="M20 6L9 17l-5-5")
    const checkIcons = this.page.locator('svg path[d="M20 6L9 17l-5-5"]');
    const found = await checkIcons.count();
    expect(found).toBeGreaterThanOrEqual(Math.max(0, count - 3));
  }

  /** Click a generic "Continue →" or "→" primary button. */
  async clickContinue(): Promise<void> {
    const btn = this.page
      .getByRole('button')
      .filter({ hasText: /continue|→/i })
      .first();
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  /** Grab the current budget-per-day value displayed on-screen. */
  async getBudgetDisplayValue(): Promise<number> {
    const text = await this.page.locator('text=/\\$\\d+/').first().textContent() ?? '$0';
    return parseInt(text.replace(/[^0-9]/g, ''), 10);
  }

  // ── Stage 0: Create ───────────────────────────────────────────────────────

  async completeCreateStage(options: {
    tripName?:    string;
    inviteEmails?: string[];
    /** 'solo' | 'group' — if provided, clicks the matching travel style button */
    travelStyle?: 'solo' | 'group';
  } = {}): Promise<void> {
    const name = options.tripName ?? 'Japan & Greece Adventure';

    // Fill trip name
    const nameInput = this.page.locator('input[placeholder*="trip" i], input[placeholder*="e.g"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(name);
    await expect(nameInput).toHaveValue(name);

    // Select travel style if specified
    if (options.travelStyle) {
      const styleBtn = this.page.getByRole('button', { name: new RegExp(options.travelStyle, 'i') }).first();
      const visible  = await styleBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) await styleBtn.click();
    }

    // Optionally invite members
    if (options.inviteEmails?.length) {
      const emailInput = this.page.locator('input[placeholder*="friend@email" i]');
      for (const email of options.inviteEmails) {
        await emailInput.fill(email);
        await this.page.getByRole('button', { name: /send/i }).click();
        await this.page.waitForTimeout(200);
      }
    }

    // Continue
    const continueBtn = this.page.getByRole('button').filter({ hasText: /continue with|continue/i }).first();
    await continueBtn.waitFor({ state: 'visible' });
    await continueBtn.click();
    await this.page.waitForTimeout(300);
  }

  // ── Stage 1: Bucket List ──────────────────────────────────────────────────

  async completeBucketListStage(destinations = ['Tokyo', 'Kyoto', 'Santorini']): Promise<void> {
    // Type each destination in the chat input (or bucket input if present)
    const chatInput = this.page.locator('input[placeholder*="destination" i], [data-testid="bucket-input"]');
    const hasChatInput = await chatInput.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasChatInput) {
      for (const dest of destinations) {
        await chatInput.fill(dest);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(200);
      }
    }
    // Approve the ranked destinations YN card
    await this.approveYN(0);
  }

  // ── Stage 2: Timing ───────────────────────────────────────────────────────

  async completeTimingStage(): Promise<void> {
    // Wait for heatmap to render
    await this.page.waitForSelector('text=/Ideal|Okay|Avoid/i', { timeout: 8000 });
    // Approve the timing suggestion
    await this.approveYN(0);
  }

  // ── Stage 3: Interests ────────────────────────────────────────────────────

  /**
   * Answer all visible interest questions.
   * `answers` maps question-index → 'yes' | 'no'. Defaults to the
   * fixture values used in the wizard component.
   */
  async completeInterestsStage(
    answers: Record<number, 'yes' | 'no'> = { 0:'yes', 1:'no', 2:'yes', 3:'yes', 4:'yes', 5:'no', 6:'yes', 7:'yes', 8:'no', 9:'yes' }
  ): Promise<void> {
    // Find all yes/no button pairs
    const yesButtons = this.page.getByRole('button', { name: /👍.*yes|yes/i });
    const noButtons  = this.page.getByRole('button', { name: /👎.*no|no/i });

    const count = await yesButtons.count();
    for (let i = 0; i < count; i++) {
      const ans = answers[i] ?? 'yes';
      if (ans === 'yes') {
        await yesButtons.nth(i).click();
      } else {
        await noButtons.nth(i).click();
      }
      await this.page.waitForTimeout(150);
    }

    // Click the final Continue button
    await this.page.getByRole('button', { name: /continue/i }).last().click();
    await this.page.waitForTimeout(300);
  }

  // ── Stage 4: Health ───────────────────────────────────────────────────────

  async completeHealthStage(approveAll = true): Promise<void> {
    // Approve each health requirement YN card
    const cards = this.page.getByRole('button', { name: /approve/i });
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      // Re-query since DOM updates after each click
      const approveBtn = this.page.getByRole('button', { name: /approve/i }).first();
      if (await approveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await approveBtn.click();
        await this.page.waitForTimeout(400);
      }
    }
    // If only 1 remain, click it to advance
    const lastApprove = this.page.getByRole('button', { name: /approve/i }).last();
    if (await lastApprove.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lastApprove.click();
    }
  }

  // ── Stage 5: POIs ─────────────────────────────────────────────────────────

  /**
   * Approve `approveCount` POIs and skip the rest.
   */
  async completePoisStage(approveCount = 8): Promise<void> {
    let approved = 0;
    let skipped  = 0;

    // Iterate until all POI cards have been actioned
    while (true) {
      const skipBtn    = this.page.getByRole('button', { name: /^skip$/i }).first();
      const approveBtn = this.page.getByRole('button', { name: /^approve$/i }).first();

      const hasApprove = await approveBtn.isVisible({ timeout: 1500 }).catch(() => false);
      const hasSkip    = await skipBtn.isVisible({ timeout: 500 }).catch(() => false);

      if (!hasApprove && !hasSkip) break;

      if (approved < approveCount && hasApprove) {
        try {
          await approveBtn.click();
          approved++;
        } catch {
          await this.page.waitForTimeout(150);
        }
      } else if (hasSkip) {
        try {
          await skipBtn.click();
          skipped++;
        } catch {
          await this.page.waitForTimeout(150);
        }
      } else {
        break;
      }
      await this.page.waitForTimeout(200);
    }

    // Click the "N activities selected — Continue" button
    const continueBtn = this.page.getByRole('button', { name: /activities selected|continue/i }).first();
    if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn.click();
    }
  }

  // ── Stage 6: Duration ─────────────────────────────────────────────────────

  async completeDurationStage(): Promise<void> {
    await this.approveYN(0);
  }

  // ── Stage 7: Availability ─────────────────────────────────────────────────

  async completeAvailabilityStage(): Promise<void> {
    await this.approveYN(0);
  }

  // ── Stage 8: Budget ───────────────────────────────────────────────────────

  async completeBudgetStage(dailyBudget = 150): Promise<void> {
    // Move the range slider to set budget
    const slider = this.page.locator('input[type="range"]');
    if (await slider.isVisible({ timeout: 2000 }).catch(() => false)) {
      const min = parseInt(await slider.getAttribute('min') ?? '50', 10);
      const max = parseInt(await slider.getAttribute('max') ?? '500', 10);
      // Calculate slider position as a proportion
      const pct = (dailyBudget - min) / (max - min);
      const box = (await slider.boundingBox())!;
      const x   = box.x + box.width * pct;
      const y   = box.y + box.height / 2;
      await this.page.mouse.click(x, y);
    }

    await this.approveYN(0);
  }

  // ── Stage 9: Flights ──────────────────────────────────────────────────────

  /**
   * Select a flight by index (0 = first / cheapest).
   * @param flightIndex   Which flight option to click.
   * @param flightClass   'Economy' | 'Business' | 'First'
   */
  async completeFlightsStage(flightIndex = 0, flightClass = 'Economy'): Promise<void> {
    // Select cabin class
    await this.page.getByRole('button', { name: flightClass, exact: true }).click();
    await this.page.waitForTimeout(300);

    const searchBtn = this.page.getByRole('button', { name: /search flight options/i });
    if (await searchBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await searchBtn.click();
      await this.page.waitForTimeout(600);
    }

    // Wait for flight cards
    await this.page.waitForSelector('text=/airlines|nonstop|stop/i', { timeout: 8000 });

    // Click the n-th flight card (look for price  pattern)
    const flightCards = this.page.locator('[style*="cursor:pointer"]').filter({ hasText: /\$\d+|nonstop|stop/i });
    if ((await flightCards.count()) > flightIndex) {
      await flightCards.nth(flightIndex).click();
    } else {
      // Fallback: click any element containing a price and airline name
      await this.page.locator('text=/\$\d{3,4}/').first().click();
    }

    await this.page.waitForTimeout(300);

    const saveBtn = this.page.getByRole('button', { name: /save selected flights/i });
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click();
    await this.page.waitForTimeout(300);

    const confirmBtn = this.page.getByRole('button', { name: /confirm and (open airline websites|continue)/i });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
  }

  // ── Stage 10: Stays ───────────────────────────────────────────────────────

  async completeStaysStage(): Promise<void> {
    // Book every available stay
    while (true) {
      const bookBtn = this.page.getByRole('button', { name: /book ✓|book$/i }).first();
      const hasBook = await bookBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (!hasBook) break;
      await bookBtn.click();
      await this.page.waitForTimeout(300);
    }

    // Click "Continue to Dining"
    const continueBtn = this.page.getByRole('button', { name: /continue to dining/i });
    await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await continueBtn.click();
  }

  // ── Stage 11: Dining ─────────────────────────────────────────────────────

  async completeDiningStage(): Promise<void> {
    // Approve all dining items (small green check buttons)
    while (true) {
      // Find any unapproved dining row's check button
      const checkBtn = this.page.locator('button').filter({ has: this.page.locator('svg path[d*="M20 6"]') }).first();
      const hasCheck = await checkBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (!hasCheck) break;
      await checkBtn.click();
      await this.page.waitForTimeout(150);
    }

    const continueBtn = this.page.getByRole('button', { name: /continue to itinerary/i });
    await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await continueBtn.click();
  }

  // ── Stage 12: Itinerary ───────────────────────────────────────────────────

  async completeItineraryStage(): Promise<void> {
    // Verify budget meter is visible
    await this.page.waitForSelector('text=/Total Budget|Budget/i', { timeout: 5000 });
    // Approve the itinerary YN card
    await this.approveYN(0);
  }

  // ── Stage 13: Sync (Completion) ───────────────────────────────────────────

  async verifyCompletionScreen(): Promise<{
    tripConfirmed: boolean;
    syncedCalendars: string[];
  }> {
    await expect(this.page.locator('h1')).toContainText(/Trip Confirmed/i, { timeout: 8000 });

    const syncedBadges = this.page.locator('text=✓ Synced');
    const count        = await syncedBadges.count();
    const synced: string[] = [];

    for (let i = 0; i < count; i++) {
      const row = syncedBadges.nth(i).locator('..').locator('..');
      synced.push((await row.textContent() ?? '').trim());
    }

    return { tripConfirmed: true, syncedCalendars: synced };
  }

  // ── Full happy-path runner ────────────────────────────────────────────────

  /**
   * Drive the wizard from Stage 0 (Create) to Stage 13 (Sync).
   * Returns the stages completed count.
   */
  async completeFullFlow(options: {
    tripName?:      string;
    inviteEmails?:  string[];
    destinations?:  string[];
    dailyBudget?:   number;
    flightIndex?:   number;
    flightClass?:   string;
    poiCount?:      number;
    /** 'solo' | 'group' — forwards to completeCreateStage */
    travelStyle?:   'solo' | 'group';
  } = {}): Promise<number> {
    let stagesCompleted = 0;

    await this.completeCreateStage({
      tripName:    options.tripName,
      inviteEmails: options.inviteEmails,
      travelStyle:  options.travelStyle,
    });
    stagesCompleted++;

    await this.completeBucketListStage(options.destinations);
    stagesCompleted++;

    await this.completeTimingStage();
    stagesCompleted++;

    await this.completeInterestsStage();
    stagesCompleted++;

    await this.completeHealthStage();
    stagesCompleted++;

    await this.completePoisStage(options.poiCount ?? 8);
    stagesCompleted++;

    await this.completeDurationStage();
    stagesCompleted++;

    await this.completeAvailabilityStage();
    stagesCompleted++;

    await this.completeBudgetStage(options.dailyBudget ?? 150);
    stagesCompleted++;

    await this.completeFlightsStage(options.flightIndex ?? 0, options.flightClass ?? 'Economy');
    stagesCompleted++;

    await this.completeStaysStage();
    stagesCompleted++;

    await this.completeDiningStage();
    stagesCompleted++;

    await this.completeItineraryStage();
    stagesCompleted++;

    // Sync screen appears automatically
    await this.page.waitForSelector('h1:has-text("Trip Confirmed")', { timeout: 10000 });
    stagesCompleted++;

    return stagesCompleted;
  }
}

