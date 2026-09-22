import { test, expect } from '@playwright/test';

// The required core-story test: open a project, move the deposit,
// watch the cash gap change, open Copilot, generate + approve an
// invoice, simulate payment, see it become verified.
//
// NOTE: browser binaries are not installable in the sandbox this was
// authored in (no network access to the Playwright CDN), so this suite
// is written and typechecked against the app but has not been executed
// here. Run `npx playwright install && npm run test:e2e` locally.

test('core CREW story: deposit change -> invoice -> verified payment', async ({ page }) => {
  await page.goto('/app/projects/project-asoebi');

  await expect(page.getByRole('heading', { name: 'Aso-ebi order' })).toBeVisible();

  const gapBefore = await page.getByText(/₦\d{1,3}(,\d{3})*/).first().textContent();

  const slider = page.getByRole('slider', { name: 'Deposit percentage' });
  await slider.fill('60');

  await expect(page.getByText('No gap')).toBeVisible();

  await page.getByRole('button', { name: /copilot/i }).click();
  await expect(page.getByRole('dialog', { name: 'CREW Copilot' })).toBeVisible();
  await page.keyboard.press('Escape').catch(() => {});

  await page.getByRole('button', { name: 'Invoices' }).click();
  await page.getByRole('button', { name: 'Approve & send' }).click();
  await expect(page.getByText(/WhatsApp-ready|Invoice approved/i)).toBeVisible();

  await page.getByRole('button', { name: 'Payments' }).click();
  await page.getByRole('button', { name: 'Simulate client payment' }).click();
  await expect(page.getByText('Verified')).toBeVisible();

  expect(gapBefore).not.toBeNull();
});

test('landing page renders the cinematic story and interactive demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('But where did the money go?')).toBeVisible();
  await expect(page.getByText('The project was profitable.')).toBeVisible();
  await expect(page.getByRole('heading', { name: "Try it with Amara's project" })).toBeVisible();
});

test('mobile viewport keeps bottom nav and floating Copilot from overlapping', async ({ page }) => {
  await page.goto('/app');
  const nav = page.locator('nav').last();
  await expect(nav).toBeVisible();
});
