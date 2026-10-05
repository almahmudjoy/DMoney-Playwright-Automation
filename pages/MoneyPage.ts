import { expect, Page } from '@playwright/test';

export class MoneyPage {
  constructor(private readonly page: Page) {}

  async depositTo(recipient: string, amount: number, actionName: RegExp) {
    const editableInputs = this.page.locator('input:not([disabled]):not([readonly])');
    const recipientInput = this.page.getByLabel(/customer phone number|recipient|phone|account|customer|agent/i)
      .or(this.page.getByPlaceholder(/customer phone number|recipient|phone|account|customer|agent/i))
      .or(editableInputs.first())
      .first();

    if (!(await recipientInput.isVisible().catch(() => false))) {
      let action = this.page.getByRole('link', { name: actionName })
        .or(this.page.getByRole('button', { name: actionName }))
        .or(this.page.getByRole('link', { name: /cash in|deposit/i }))
        .or(this.page.getByRole('button', { name: /cash in|deposit/i }))
        .first();

      if (!(await action.isVisible().catch(() => false))) {
        await this.page.getByRole('banner').getByRole('button').first().click();
        action = this.page.getByRole('link', { name: actionName })
          .or(this.page.getByRole('button', { name: actionName }))
          .or(this.page.getByRole('link', { name: /cash in|deposit/i }))
          .or(this.page.getByRole('button', { name: /cash in|deposit/i }))
          .first();
      }

      await expect(action, `Expected a portal action matching ${actionName}`).toBeVisible();
      await action.click();
    }

    await recipientInput.fill(recipient);

    const amountInput = this.page.getByLabel(/amount/i)
      .or(this.page.getByPlaceholder(/amount/i))
      .or(this.page.locator('input[type="number"]'))
      .or(editableInputs.nth(1))
      .first();
    await amountInput.fill(String(amount));

    const submit = this.page.getByRole('button', { name: /deposit|cash in|submit|confirm|send/i }).last();
    await submit.click();
    const outcome = this.page.getByText(/success|completed|successful|limit exceeded|cannot deposit/i).first();
    await expect(outcome).toBeVisible();
    const outcomeText = await outcome.innerText();
    if (/limit exceeded|cannot deposit/i.test(outcomeText)) {
      throw new Error(`DEPOSIT_REJECTED: ${outcomeText}`);
    }
  }

  async expectBalance(expected: number) {
    await expect.poll(() => this.readBalance()).toBe(expected);
  }

  async expectTransaction(amount: number, recipient?: string) {
    const successCard = this.page.getByText(/success|successful|completed/i).first();
    if (await successCard.isVisible().catch(() => false)) {
      const pageText = await this.page.locator('body').textContent() ?? '';
      expect(pageText, `Expected a successful transaction message for Tk ${amount}${recipient ? ` to ${recipient}` : ''}`).toContain(String(amount));
      if (!recipient || pageText.toLowerCase().includes(recipient.toLowerCase())) return;
    }

    const findTransactionRow = () => {
      let rows = this.page.locator('tbody tr').filter({ hasText: new RegExp(`\\b${amount}\\b`) });
      if (recipient) rows = rows.filter({ hasText: recipient });
      return rows.first();
    };

    let transactionRow = findTransactionRow();
    if (!(await transactionRow.isVisible().catch(() => false))) {
      const historyLink = this.page.getByRole('link', { name: /transactions?|history/i })
        .or(this.page.getByRole('button', { name: /transactions?|history/i }))
        .first();
      if (!(await historyLink.isVisible().catch(() => false))) {
        await this.page.getByRole('banner').getByRole('button').first().click();
      }
      if (await historyLink.isVisible().catch(() => false)) await historyLink.click();
      transactionRow = findTransactionRow();
    }
    await expect(transactionRow, `Expected a transaction history row for Tk ${amount}${recipient ? ` to ${recipient}` : ''}`).toBeVisible();
  }

  private async readBalance(): Promise<number | null> {
    const candidateLocators = [
      this.page.getByLabel(/current balance/i),
      this.page.getByText(/current balance/i).first(),
      this.page.getByText(/current balance \(bdt\)/i).first(),
      this.page.getByText(/balance \(bdt\)/i).first()
    ];

    for (const locator of candidateLocators) {
      if (await locator.isVisible().catch(() => false)) {
        const raw = await locator.inputValue().catch(() => locator.textContent()).catch(() => '');
        const text = String(raw ?? '');
        const directMatch = text.match(/([\d,]+(?:\.\d{1,2})?)/i);
        if (directMatch) return Number(directMatch[1].replaceAll(',', ''));

        const parentText = await locator.locator('xpath=..').textContent().catch(() => '');
        const parentMatch = parentText.match(/current balance(?:\s*\(bdt\))?[\s\S]*?([\d,]+(?:\.\d{1,2})?)/i)
          ?? parentText.match(/balance(?:\s*\(bdt\))?[\s\S]*?([\d,]+(?:\.\d{1,2})?)/i);
        if (parentMatch) return Number(parentMatch[1].replaceAll(',', ''));
      }
    }

    const pageText = await this.page.locator('body').textContent() ?? '';
    const balanceMatch = pageText.match(/current balance(?:\s*\(bdt\))?[\s\S]{0,40}?([\d,]+(?:\.\d{1,2})?)/i)
      ?? pageText.match(/balance(?:\s*\(bdt\))?[\s\S]{0,40}?([\d,]+(?:\.\d{1,2})?)/i);

    return balanceMatch ? Number(balanceMatch[1].replaceAll(',', '')) : null;
  }
}