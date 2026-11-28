import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('@a11y public home has no critical or serious axe violations', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact)),
    JSON.stringify(result.violations, null, 2)).toEqual([]);
});

test('anonymous leadership entry is denied without a session', async ({ page }) => {
  await page.goto('/founder');
  await expect(page).not.toHaveURL(/\/founder\/?$/);
});
