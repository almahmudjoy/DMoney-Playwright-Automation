import { expect, Locator, Page } from '@playwright/test';

export class AdminUsersPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/admin/users');
    await expect(this.page.locator('table')).toBeVisible();
  }

  async findUserRow(email: string): Promise<Locator> {
    let row = this.page.locator('tbody tr').filter({ hasText: email }).first();
    if (!(await row.isVisible().catch(() => false))) {
      await this.page.getByRole('combobox').first().click();
      await this.page.getByRole('option', { name: /search by email/i }).click();
      await this.page.getByLabel(/enter email/i).fill(email);
      await this.page.getByRole('button', { name: /^search$/i }).click();
      row = this.page.locator('tbody tr').filter({ hasText: email }).first();
    }
    await expect(row, `Expected ${email} to appear in the Admin user list`).toBeVisible();
    return row;
  }

  async expectAgentInactive(email: string) {
    const row = await this.findUserRow(email);
    await expect(row.locator('td').nth(6)).toHaveText(/^PENDING$/i);
  }

  async findExistingCustomerAccounts(): Promise<string[]> {
    if (process.env.CUSTOMER_ACCOUNT) return [process.env.CUSTOMER_ACCOUNT];

    const searchType = this.page.getByRole('combobox').first();
    await searchType.click();
    await this.page.getByRole('option', { name: /search by role/i }).click();
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: /^customer$/i }).click();
    const totalHeading = this.page.getByRole('heading', { name: /total:/i });
    const totalBeforeSearch = await totalHeading.innerText();
    await this.page.getByRole('button', { name: /^search$/i }).click();
    await expect.poll(async () => totalHeading.innerText()).not.toBe(totalBeforeSearch);

    const rows = this.page.locator('tbody tr');
    const firstPage = this.page.getByRole('button', { name: /go to first page/i }).first();
    if (await firstPage.isVisible().catch(() => false) && !(await firstPage.isDisabled())) {
      await firstPage.click();
    }

    const accounts = new Set<string>();
    const pagination = this.page.getByRole('navigation', { name: /pagination navigation/i });
    while (true) {
      await expect(rows.first()).toBeVisible();

      const rowCount = await rows.count();
      for (let index = 0; index < rowCount; index++) {
        const row = rows.nth(index);
        const cells = row.locator('td');
        if (await cells.count() < 7) continue;
        const role = (await row.locator('td').nth(5).innerText()).trim();
        if (role.toLowerCase() !== 'customer') continue;

        const rowText = await row.innerText();
        const phone = rowText.match(/\b01\d{9}\b/)?.[0];
        const email = rowText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
        const account = phone ?? email;
        if (account) accounts.add(account);
      }

      const nextPage = this.page.getByRole('button', { name: /go to next page/i }).last();
      if (!(await nextPage.isVisible().catch(() => false)) || await nextPage.isDisabled()) break;
      const activePage = pagination.getByRole('button', { name: /^page \d+$/i }).last();
      const currentPage = await activePage.getAttribute('aria-label') ?? await activePage.innerText();
      await nextPage.click();
      await expect.poll(async () => {
        const pageButton = pagination.getByRole('button', { name: /^page \d+$/i }).last();
        return await pageButton.getAttribute('aria-label') ?? await pageButton.innerText();
      }).not.toBe(currentPage);
    }
    if (!accounts.size) throw new Error('No existing Customer account could be extracted from the Admin user list.');
    return [...accounts];
  }

  async activateAgent(email: string) {
    const row = await this.findUserRow(email);
    await row.getByRole('button', { name: /^view$/i }).click();
    await expect(this.page).toHaveURL(/\/admin\/users\/\d+$/);
    await this.page.getByRole('button', { name: /edit user/i }).click();
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: /^active$/i }).click();
    await this.page.getByRole('button', { name: /save changes/i }).click();
    await expect(this.page.getByRole('button', { name: /edit user/i })).toBeVisible();
    await expect(this.page.getByText('ACTIVE', { exact: true }).first()).toBeVisible();
    await this.page.getByRole('button', { name: /back to user list/i }).click();
    await this.page.reload();
    const activeRow = await this.findUserRow(email);
    await expect(activeRow.locator('td').nth(6)).toHaveText(/^ACTIVE$/i);
  }
}