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

test('signed-out invite opens for client session setup while staff routes still require login', async ({ page, request }) => {
  const response = await page.goto('/management/invite');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.getByRole('heading', { name: /join the himalayan horizon team|टीम में शामिल हों/i })).toBeVisible();
  const dashboard = await request.get('/employee', { maxRedirects: 0 });
  expect(dashboard.status()).toBe(307);
  expect(dashboard.headers().location).toContain('/login?next=%2Femployee');
});

test('offline fallback is a static public page', async ({ request }) => {
  const offline = await request.get('/offline.html');
  expect(offline.status()).toBe(200);
  const body = await offline.text();
  expect(body).toContain('You are offline');
  expect(body).not.toContain('__next_f');
});
