/**
 * AuthPage — Page Object for the Auth screen (sign up / sign in)
 * and Onboarding screens (3-step post-registration flow).
 */

import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(readonly page: Page) {}

  // ── Auth helpers ────────────────────────────────────────────────────────

  async openFromHomepage(): Promise<void> {
    const authVisible = await this.page.locator('input[type="email"]').isVisible({ timeout: 1500 }).catch(() => false);
    if (authVisible) return;

    const cta = this.page
      .getByRole('button')
      .filter({ hasText: /get started|plan.*trip|start.*free|sign up/i })
      .first();

    const ctaVisible = await cta.isVisible({ timeout: 3000 }).catch(() => false);
    if (ctaVisible) {
      await cta.click();
      await this.page.waitForSelector('input[type="email"]', { timeout: 6000 }).catch(() => {});
    }
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.getByLabel(/email/i).fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.getByLabel(/password/i).fill(password);
  }

  async submitSignUp(): Promise<void> {
    await this.page.getByRole('button', { name: /create account/i }).click();
  }

  async submitSignIn(): Promise<void> {
    await this.page.getByRole('button', { name: /^sign in$/i }).click();
  }

  async switchToLogin(): Promise<void> {
    await this.page.getByRole('button').filter({ hasText: /sign in|already have/i }).last().click();
  }

  async switchToSignUp(): Promise<void> {
    await this.page.getByRole('button').filter({ hasText: /sign up|don't have/i }).last().click();
  }

  async signUp(email: string, password: string, name?: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitSignUp();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitSignIn();
  }

  /** Wait until the app navigates away from the auth screen. */
  async waitForPostAuth(): Promise<void> {
    // Post-auth lands on onboarding or the wizard
    await this.page.waitForFunction(
      () => !document.querySelector('input[type="email"]'),
      { timeout: 10_000 }
    ).catch(() => {});
  }

  // ── Onboarding helpers (3 steps) ────────────────────────────────────────

  /**
   * Complete the 3-step onboarding flow.
   * @param travelStyle  One of: 'solo' | 'couple' | 'group'
   * @param interests    Array of interest IDs to toggle on.
   * @param budgetTier   Budget level ID: 'budget' | 'moderate' | 'luxury'
   */
  async completeOnboarding(
    travelStyle = 'solo',
    interests   = ['adventure', 'food'],
    budgetTier  = 'moderate'
  ): Promise<void> {
    // Step 1: Travel style
    const hasOnboarding = await this.page
      .locator('text=/travel style|how do you|step 1 of 3/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!hasOnboarding) return;

    await this.page.waitForSelector('text=/travel style|how do you/i', { timeout: 8000 });
    const styleBtn = this.page.getByRole('button').filter({ hasText: new RegExp(travelStyle, 'i') }).first();
    if (await styleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleBtn.click();
    }
    await this.clickOnboardContinue();

    // Step 2: Interests
    await this.page.waitForSelector('text=/interests|activities|what do you love/i', { timeout: 5000 });
    for (const interest of interests) {
      const interestBtn = this.page.getByRole('button').filter({ hasText: new RegExp(interest, 'i') }).first();
      if (await interestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await interestBtn.click();
        await this.page.waitForTimeout(150);
      }
    }
    await this.clickOnboardContinue();

    // Step 3: Budget
    await this.page.waitForSelector('text=/budget|per day|spending/i', { timeout: 5000 });
    const budgetBtn = this.page.getByRole('button').filter({ hasText: new RegExp(budgetTier, 'i') }).first();
    if (await budgetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await budgetBtn.click();
    }

    // Final "Finish & Start Planning" button
    const finishBtn = this.page.getByRole('button', { name: /finish.*start planning|start planning/i });
    await finishBtn.waitFor({ state: 'visible', timeout: 5000 });
    await finishBtn.click();
  }

  private async clickOnboardContinue(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /^continue/i });
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await this.page.waitForTimeout(400);
  }

  async verifyOnboardProgressBar(step: number, total = 3): Promise<void> {
    const expected = `Step ${step} of ${total}`;
    await expect(this.page.locator(`text=${expected}`)).toBeVisible();
  }
}
