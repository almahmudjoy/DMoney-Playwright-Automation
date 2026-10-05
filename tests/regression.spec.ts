import { test } from '@playwright/test';
import { runAgentAssignment } from './workflow';

test.describe('DMoney Agent end-to-end regression', () => {
  test.describe.configure({ mode: 'serial' });

  test('register, activate, deposit, reset password, and export self statement', async ({ page, request }) => {
    await runAgentAssignment(page, request, true);
  });
});