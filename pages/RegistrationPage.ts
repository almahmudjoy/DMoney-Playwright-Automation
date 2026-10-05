import { expect, Locator, Page } from '@playwright/test';
import { GmailClient } from '../utils/gmail';

export class RegistrationPage {
  constructor(private readonly page: Page) {}

  async registerAgent(email: string, name: string, phone: string, nid: string, password: string, gmail: GmailClient) {
    await this.page.goto('/register');
    await this.page.getByLabel(/full name/i).fill(name);
    await this.page.getByLabel(/email address/i).fill(email);
    await this.page.getByLabel(/^password\b/i).fill(password);
    await this.page.getByLabel(/phone number/i).fill(phone);
    await this.page.getByLabel(/national id/i).fill(nid);

    const roleSelect = this.page.getByRole('combobox').first();
    await roleSelect.click();
    await this.page.getByRole('option', { name: /agent/i }).click();

    const receivedAfter = Date.now();
    await this.page.getByRole('button', { name: /create account/i }).click();

    const hasOtpPrompt = await this.otpInput().isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasOtpPrompt) {
      await this.verifyOtp(await gmail.waitForOtp(email, receivedAfter));
      return;
    }

    const successVisible = await this.page.getByText(/success|successful|created|registered|account created/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!successVisible) {
      await expect(this.page).toHaveURL(/\/login$/);
    }
  }

  private otpInput(): Locator {
    return this.page.getByLabel(/otp|verification code/i)
      .or(this.page.getByPlaceholder(/otp|verification code/i))
      .or(this.page.locator('input[maxlength="4"]'))
      .first();
  }

  private async verifyOtp(code: string) {
    await this.otpInput().fill(code);
    await this.page.getByRole('button', { name: /verify|confirm|submit/i }).click();
  }
}