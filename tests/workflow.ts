import { expect, Page, APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { LoginPage } from '../pages/LoginPage';
import { MoneyPage } from '../pages/MoneyPage';
import { PasswordResetPage } from '../pages/PasswordResetPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { StatementPage } from '../pages/StatementPage';
import { saveStatementCsv, serializeStatementCsv } from '../utils/csv';
import { GmailClient } from '../utils/gmail';
import { adminCredentials, createAgentData, systemCredentials } from '../utils/workflowData';

async function login(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
  expectedRole: string,
  requiresOtp = false
) {
  const loginPage = new LoginPage(page);
  await loginPage.open();
  const requestedAt = Date.now();
  await loginPage.submitCredentials(email, password);
  if (requiresOtp) {
    await loginPage.submitOtp(await new GmailClient(request).waitForOtp(email, requestedAt));
  } else if (await loginPage.waitForOtpOrSignedIn()) {
    await loginPage.submitOtp(await new GmailClient(request).waitForOtp(email, requestedAt));
  }
  await loginPage.expectSignedIn();
  await loginPage.expectRole(expectedRole, email);
}

export async function runAgentAssignment(page: Page, request: APIRequestContext, testNegativePassword = true) {
  const agent = createAgentData();
  const gmail = new GmailClient(request);
  const registration = new RegistrationPage(page);
  await registration.registerAgent(
    agent.email, agent.name, agent.phone, agent.nid, agent.initialPassword, gmail
  );

  await login(page, request, adminCredentials().email, adminCredentials().password, 'Admin');
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.open();
  await adminUsers.expectAgentInactive(agent.email);
  await adminUsers.activateAgent(agent.email);
  const customers = await adminUsers.findExistingCustomerAccounts();
  await new LoginPage(page).logout();

  await login(page, request, systemCredentials().email, systemCredentials().password, 'System');
  const systemMoney = new MoneyPage(page);
  await systemMoney.depositTo(agent.phone, 2000, /deposit/i);
  await systemMoney.expectTransaction(2000, agent.phone);
  await new LoginPage(page).logout();

  await login(page, request, agent.email, agent.initialPassword, 'Agent', true);
  const agentMoney = new MoneyPage(page);
  await agentMoney.expectBalance(2000);

  let customer: string | undefined;
  for (const candidate of customers) {
    try {
      await agentMoney.depositTo(candidate, 500, /deposit|cash in/i);
      customer = candidate;
      break;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('DEPOSIT_REJECTED:')) throw error;
      await page.reload();
    }
  }
  if (!customer) throw new Error('Every existing Customer candidate rejected the Tk 500 deposit.');

  await agentMoney.expectTransaction(500, customer);
  await agentMoney.expectBalance(1512.5);
  await new LoginPage(page).logout();

  const resetPage = new PasswordResetPage(page);
  await resetPage.reset(agent.email, agent.newPassword, gmail);

  if (testNegativePassword) {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.submitCredentials(agent.email, agent.initialPassword);
    await loginPage.expectLoginRejected();
  }

  await login(page, request, agent.email, agent.newPassword, 'Agent', true);
  const statement = await new StatementPage(page).open();
  const statementPage = new StatementPage(page);
  await statementPage.expectTransactionAmounts(statement.rows, [2000, 500]);
  await statementPage.expectCustomerDeposit(statement.rows, 500, customer);
  const csvPath = await saveStatementCsv(statement.headers, statement.rows);
  expect(statement.rows.length, 'Self Statement should contain transaction rows').toBeGreaterThan(0);
  const csv = await readFile(csvPath, 'utf8');
  expect(path.basename(csvPath)).toMatch(/^self_statement_\d{4}-\d{2}-\d{2}\.csv$/);
  expect(csv).toBe(serializeStatementCsv(statement.headers, statement.rows));
  console.log(`Self Statement CSV saved: ${csvPath}`);
}