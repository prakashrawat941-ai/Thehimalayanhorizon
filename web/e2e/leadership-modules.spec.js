import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Step 02 leadership modules, sample-data review route (/ui-kit/modules, ENABLE_UI_KIT=1).
 * NOT YET RUN in CI: written in a session without package installs. Codex: run with `npm run test:e2e`.
 * Real-route tests (auth, MFA, RLS, persistence) need staging accounts and belong to Codex's suite.
 */
const ROLES = { founder: 'Founder', ceo: 'CEO', co_founder: 'Co-Founder' };
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function asRole(page, role) {
  await page.goto('/ui-kit/modules');
  await page.getByLabel('Acting as').selectOption(role);
}
async function openModule(page, label) {
  const menu = page.getByRole('button', { name: /menu/i });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole('link', { name: label, exact: true }).click();
}

for (const [role, name] of Object.entries(ROLES)) {
  test(`${name}: every module tab renders, is labelled sample, has no axe violations or overflow`, async ({ page }) => {
    await asRole(page, role);
    const hrefs = await page.locator('nav a[href^="#"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
    for (const href of hrefs) {
      await page.locator(`nav a[href="${href}"]`).first().evaluate((a) => a.click());
      await expect(page.locator('.ui-demo-banner')).toBeVisible();
      const tabs = page.getByRole('tab');
      const n = Math.max(1, await tabs.count());
      for (let i = 0; i < n; i += 1) {
        if (await tabs.count()) await tabs.nth(i).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${role}${href} tab ${i}`).toBeLessThanOrEqual(1);
        const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(axe.violations.map((v) => `${role}${href}#${i} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    }
  });
}

test('CEO reviews a Co-Founder request with version comparison and approves', async ({ page }) => {
  await asRole(page, 'ceo');
  await openModule(page, 'Approval center');
  await page.getByRole('tab', { name: 'Waiting for me' }).click();
  await expect(page.getByText('Grant finance view to CEO')).toHaveCount(0); // no self-approval
  await page.getByRole('button', { name: /Open THH-APR-000001/ }).click();
  await expect(page.getByText('Version comparison')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog').first().getByText('Approved').first()).toBeVisible();
});

test('sensitive people action goes to approval and leaves status unchanged', async ({ page }) => {
  await asRole(page, 'ceo');
  await openModule(page, 'People');
  await page.getByRole('tab', { name: 'Employee directory' }).click();
  await page.getByRole('button', { name: /Open THH-EMP-0004/ }).click();
  await page.getByRole('button', { name: 'Request suspension' }).click();
  await page.getByRole('dialog').last().getByLabel('Note').fill('Repeated absence without notice');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Request suspension' }).click();
  await expect(page.getByText('Waiting for approval')).toBeVisible();
});

test('village office: offline submission keeps a local draft only', async ({ page, context }) => {
  await asRole(page, 'ceo');
  await openModule(page, 'Village Connect');
  await page.getByRole('tab', { name: 'Tourist registration' }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Register tourist' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Lead traveller name').fill('Offline Traveller');
  await d.getByLabel('Mobile').fill('9876543210');
  await d.getByLabel('Number of people').fill('2');
  await d.getByLabel('Arrival date').fill('2026-12-05');
  await d.getByLabel('Departure date').fill('2026-12-06');
  await d.getByRole('button', { name: 'Submit' }).click();
  await expect(d.getByText(/nothing is submitted/).first()).toBeVisible();
  await expect(page.getByText('THH-TRS-000002')).toHaveCount(0);
  await context.setOffline(false);
});

test('integrations are never shown as connected without the server', async ({ page }) => {
  await asRole(page, 'founder');
  await openModule(page, 'Notifications');
  await page.getByRole('tab', { name: 'Integrations' }).click();
  await expect(page.getByText('Connected', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Delivery preferences' }).click();
  await expect(page.getByLabel('Approval requests: Email')).toBeDisabled();
});

test('AI research cannot be submitted while a fact has no source', async ({ page }) => {
  await asRole(page, 'co_founder');
  await openModule(page, 'Destinations & research');
  await page.getByLabel('Place name').fill('Surmoli');
  await page.getByLabel('District').fill('Almora');
  await page.getByRole('button', { name: 'Research with AI' }).click();
  for (const box of await page.locator('.ui-facts input:enabled').all()) await box.check();
  await expect(page.getByRole('button', { name: /send for CEO approval/ })).toBeDisabled();
});
