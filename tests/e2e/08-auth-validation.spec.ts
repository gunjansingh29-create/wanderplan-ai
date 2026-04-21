import { test, expect } from '@playwright/test';
import { setupApiMocks } from './fixtures/api-mock';

test.describe('08 — Auth validation edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /start your bucket list|get started/i }).first().click();
  });

  test('8.1 Sign In rejects invalid email format with inline error', async ({ page }) => {
    await page.getByPlaceholder('Email').fill('notanemail');
    await page.getByPlaceholder('Password').fill('Password1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.locator('text=Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText(/account not found\. please sign up\./i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });
});
