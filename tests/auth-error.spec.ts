import { test, expect } from '@playwright/test';

test('Auth error page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/auth-code-error');
  await expect(page.getByRole('heading', { name: /Authentication Failed/i })).toBeVisible();
  await expect(page.getByText(/couldn't complete your sign-in/i)).toBeVisible();
});
