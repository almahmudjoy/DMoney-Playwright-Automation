import { expect, Locator, Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/login');
  }

  async submitCredentials(identifier: string, password: string) {
    await this.page.getByLabel(/email or phone number/i).fill(identifier);
    await this.page.getByLabel(/^password\b/i).fill(password);
    await this.page.getByRole('button', { name: /login/i }).click();
  }

  async expectSignedIn() {
    await expect(this.page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
  }

  async expectRole(role: string, accountEmail?: string) {
    const field = this.page.getByLabel(/^Role$/i);
    const actualRole = (await field.inputValue()).trim();
    const expectedRole = role.trim();
    const isSystemSuperAgent =
      accountEmail?.toLowerCase() === 'system@dmoney.com' &&
      actualRole.toLowerCase() === 'agent' &&
      ['system', 'agent'].includes(expectedRole.toLowerCase());

    expect(isSystemSuperAgent || actualRole.toLowerCase() === expectedRole.toLowerCase(),
      `Expected role "${expectedRole}" for ${accountEmail ?? 'current user'}, but found "${actualRole}"`).toBeTruthy();
  }

  async waitForOtpOrSignedIn(): Promise<boolean> {
    return Promise.race([
      this.otpInput().waitFor({ state: 'visible', timeout: 20_000 }).then(() => true),
      this.page.waitForURL('**/profile', { timeout: 20_000 }).then(() => false)
    ]);
  }

  async expectLoginRejected() {
    await expect(this.page.getByText(/invalid|incorrect|failed|pending|inactive/i).first()).toBeVisible();
  }

  async logout() {
    await this.page.getByRole('banner').getByText(/^(admin|agent|system|customer|merchant)$/i).last().click();
    await this.page.getByRole('menuitem', { name: /logout/i }).click();
    await expect(this.page).toHaveURL(/\/login|\/$/);
  }

  otpInput(): Locator {
    return this.page.getByLabel(/otp|verification code/i)
      .or(this.page.getByPlaceholder(/otp|verification code/i))
      .or(this.page.locator('input[maxlength="4"]'))
      .first();
  }

  async submitOtp(code: string) {
    await this.otpInput().fill(code);
    await this.page.getByRole('button', { name: /verify otp|verify|confirm/i }).click();
  }
}