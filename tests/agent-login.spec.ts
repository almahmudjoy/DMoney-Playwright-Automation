import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GmailClient } from '../utils/gmail';
import { AgentData } from '../utils/workflowData';

test('Agent logs in with Gmail OTP', async ({ page, request }) => {
  test.setTimeout(240_000);
  const statePath = path.resolve('.local-state/agent.json');
  const agent = JSON.parse(await readFile(statePath, 'utf8')) as AgentData;
  const loginPage = new LoginPage(page);

  await loginPage.open();
  const requestedAt = Date.now();
  await loginPage.submitCredentials(agent.email, agent.initialPassword);
  await expect(loginPage.otpInput()).toBeVisible();
  await loginPage.submitOtp(await new GmailClient(request).waitForOtp(agent.email, requestedAt));
  await expect(page).toHaveURL(/\/profile$/);
});