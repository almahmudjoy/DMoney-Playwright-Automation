import { expect, Page } from '@playwright/test';
import { GmailClient } from '../utils/gmail';

export class PasswordResetPage {
  constructor(private readonly page: Page) {}

  async reset(email: string, newPassword: string, gmail: GmailClient) {
    const browser = this.page.context().browser();
    if (!browser) throw new Error('Cannot create an isolated browser context for password reset.');

    const context = await browser.newContext();
    const resetPage = await context.newPage();
    try {
      const forgotPasswordUrl = new URL('/forgot-password', this.page.url()).toString();
      for (let attempt = 0; attempt < 2; attempt++) {
        await resetPage.goto(forgotPasswordUrl);
        await resetPage.getByLabel(/email or phone number/i).fill(email);
        const requestedAt = Date.now();
        await resetPage.getByRole('button', { name: /send reset link/i }).click();

        const resetLink = await gmail.waitForPasswordResetLink(email, requestedAt);
        await resetPage.goto(resetLink);

        const passwordFields = resetPage.locator('input[type="password"], input[placeholder*="password" i], input[aria-label*="password" i], input[name*="password" i]');
        await passwordFields.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
        const invalidLink = resetPage.getByText(/invalid reset link|request a new password reset|need a new link/i).first();
        if (!(await passwordFields.first().isVisible().catch(() => false)) && await invalidLink.isVisible().catch(() => false)) {
          if (attempt === 1) throw new Error('Password reset link remained invalid after retry.');
          continue;
        }

        let firstPassword = passwordFields.first();

        if (!(await firstPassword.isVisible().catch(() => false))) {
          const fallback = resetPage.getByLabel(/new password|confirm password|password/i).first();
          if (await fallback.isVisible().catch(() => false)) {
            firstPassword = fallback;
          } else {
            const changePasswordLink = resetPage.getByRole('link', { name: /change password|reset password/i }).first();
            if (await changePasswordLink.isVisible().catch(() => false)) {
              await changePasswordLink.click();
            }
          }
        }

        await expect(firstPassword).toBeVisible();
        await firstPassword.fill(newPassword);
        const secondPassword = passwordFields.nth(1).or(resetPage.getByLabel(/confirm password|repeat password/i)).first();
        if (await secondPassword.isVisible().catch(() => false)) {
          await secondPassword.fill(newPassword);
        }

        const submitButton = resetPage.getByRole('button', { name: /reset|change|update password|submit/i }).last();
        await submitButton.click();
        await expect(resetPage.getByText(/success|updated|reset|password changed/i).first()).toBeVisible({ timeout: 15_000 });
        return;
      }
    } finally {
      await context.close();
    }
  }
}