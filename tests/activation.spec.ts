import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from '@playwright/test';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { LoginPage } from '../pages/LoginPage';
import { adminCredentials, AgentData } from '../utils/workflowData';

test('Point 5: Admin activates the registered Agent and status survives reload', async ({ page }) => {
  const statePath = path.resolve('.local-state/agent.json');
  const agent = JSON.parse(await readFile(statePath, 'utf8')) as AgentData;
  const loginPage = new LoginPage(page);
  await loginPage.open();
  const admin = adminCredentials();
  await loginPage.submitCredentials(admin.email, admin.password);
  await loginPage.expectSignedIn();

  const usersPage = new AdminUsersPage(page);
  await usersPage.open();
  await usersPage.expectAgentInactive(agent.email);
  await usersPage.activateAgent(agent.email);
});