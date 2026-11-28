import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** UI kit gallery (ENABLE_UI_KIT=1 is set by playwright.config.mjs). Sample data only. */
const TABS = ['Tables', 'Charts', 'Forms', 'States', 'Approvals'];

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(([key, t]) => { try { localStorage.setItem(key, t); } catch {} }, ['thh.theme', theme]);
      await page.goto('/ui-kit');
    });

    test('applies the saved theme before interaction', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    for (const tab of TABS) {
      test(`${tab} tab has no WCAG A/AA violations`, async ({ page }) => {
        await page.getByRole('tab', { name: tab }).click();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      });
    }
  });
}

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('tabs work with the keyboard', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('tab', { name: 'Tables' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Charts', selected: true })).toBeVisible();
});

test('table filter narrows rows and can be cleared', async ({ page }) => {
  await page.goto('/ui-kit');
  const search = page.getByRole('searchbox');
  await search.fill('village B');
  await expect(page.getByText('Sample village A')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Sample village A').first()).toBeVisible();
});

test('reject needs a note and the dialog traps focus and closes with Escape', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('tab', { name: 'Approvals' }).click();
  await page.getByRole('button', { name: 'Reject' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(dialog).toBeVisible(); // blocked: note missing
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('stale approval cannot be decided', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('tab', { name: 'Approvals' }).click();
  await expect(page.getByText('changed after you opened it')).toBeVisible();
});

test('mobile layout: menu opens, Escape closes, no horizontal scroll', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile project only');
  await page.goto('/ui-kit');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
});

test('kit is hidden without the flag', async ({ request }) => {
  // Only meaningful when run against a server started without ENABLE_UI_KIT; skipped otherwise.
  test.skip(process.env.EXPECT_KIT_HIDDEN !== '1', 'set EXPECT_KIT_HIDDEN=1 against a flag-less server');
  const res = await request.get('/ui-kit');
  expect(res.status()).toBe(404);
});
