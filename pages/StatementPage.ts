import { expect, Page } from '@playwright/test';

export type StatementData = { headers: string[]; rows: string[][] };

export class StatementPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<StatementData> {
    let statementLink = this.page.getByRole('link', { name: /self statement|statement/i })
      .or(this.page.getByRole('button', { name: /self statement|statement/i }))
      .first();
    if (!(await statementLink.isVisible().catch(() => false))) {
      await this.page.getByRole('banner').getByRole('button').first().click();
      statementLink = this.page.getByRole('link', { name: /self statement|statement/i })
        .or(this.page.getByRole('button', { name: /self statement|statement/i }))
        .first();
    }
    await statementLink.click();
    const table = this.page.locator('table').first();
    await expect(table).toBeVisible();
    const headers = await table.locator('thead th').allTextContents();
    const rows: string[][] = [];
    while (true) {
      rows.push(...await table.locator('tbody tr').evaluateAll(elements => elements.map(row =>
        Array.from(row.querySelectorAll('th, td'), cell => cell.textContent?.trim() ?? '')
      )));
      const nextPage = this.page.getByRole('button', { name: /go to next page|next page/i }).last();
      if (!(await nextPage.isVisible().catch(() => false)) || await nextPage.isDisabled()) break;
      await nextPage.click();
    }
    return { headers: headers.map(value => value.trim()), rows };
  }

  async expectTransactionAmounts(rows: string[][], amounts: number[]) {
    const statementText = rows.flat().join(' ').replaceAll(',', '');
    for (const amount of amounts) {
      expect(statementText).toMatch(new RegExp(`(?:^|\\D)${amount}(?:\\D|$)`));
    }
  }

  async expectCustomerDeposit(rows: string[][], amount: number, customer: string) {
    const matchingRow = rows.find(row => {
      const rowText = row.join(' ').replaceAll(',', '');
      return new RegExp(`(?:^|\\D)${amount}(?:\\D|$)`).test(rowText) && rowText.includes(customer);
    });
    expect(matchingRow, `Expected Tk ${amount} deposit to ${customer} in Self Statement`).toBeDefined();
  }
}