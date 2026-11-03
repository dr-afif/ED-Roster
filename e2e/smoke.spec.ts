import { expect, test } from '@playwright/test';

test('renders operations overview shell and navigates to January 2027 roster route', async ({
  page,
}) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Operations Overview' })).toBeVisible();

  await page.getByRole('link', { name: /Open Jan 2027 Roster Shell/i }).click();
  await expect(page).toHaveURL(/#\/rosters\/2027\/01$/);
  await expect(page.getByRole('heading', { level: 1, name: 'January 2027 Roster' })).toBeVisible();
});
