import { test } from '@playwright/test';
import { SUITES } from '../utils/suites';
import { runAgentAssignment } from './workflow';

test.describe('DMoney positive smoke suite', () => {
  test.describe.configure({ mode: 'serial' });

  test('complete the positive Agent money workflow', { tag: SUITES.smoke }, async ({ page, request }) => {
    await runAgentAssignment(page, request, false);
  });
});