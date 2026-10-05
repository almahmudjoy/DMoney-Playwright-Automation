import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';
import { GmailClient } from '../utils/gmail';
import { createAgentData } from '../utils/workflowData';

test('Point 3: register a new Agent and verify pending approval', async ({ page, request }) => {
  const agent = createAgentData();
  const stateDirectory = path.resolve('.local-state');
  await mkdir(stateDirectory, { recursive: true });
  await writeFile(path.join(stateDirectory, 'agent.json'), JSON.stringify(agent, null, 2), 'utf8');

  await new RegistrationPage(page).registerAgent(
    agent.email,
    agent.name,
    agent.phone,
    agent.nid,
    agent.initialPassword,
    new GmailClient(request)
  );
  await expect(page).toHaveURL(/\/login$/);
  console.log('Point 3 Agent account details saved locally for the next checkpoint.');
});