import { randomInt } from 'node:crypto';

export type AgentData = {
  name: string;
  email: string;
  phone: string;
  nid: string;
  initialPassword: string;
  newPassword: string;
};

export function createAgentData(): AgentData {
  const email = process.env.AGENT_EMAIL;
  if (!email || email === 'your-owned-gmail@gmail.com') {
    throw new Error('Set AGENT_EMAIL in .env to a Gmail inbox you control.');
  }

  const suffix = `${Date.now()}${randomInt(100, 999)}`;
  const [mailbox, domain] = email.split('@');
  const uniqueEmail = `${mailbox}+pw${suffix.slice(-6)}@${domain}`;
  return {
    name: `Playwright Agent ${suffix.slice(-6)}`,
    email: uniqueEmail,
    phone: `017${suffix.slice(-8)}`,
    nid: `${Date.now()}${randomInt(1, 9)}`.slice(-10),
    initialPassword: process.env.AGENT_INITIAL_PASSWORD ?? '1234',
    newPassword: process.env.AGENT_NEW_PASSWORD ?? '5678'
  };
}

export function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL ?? 'admin@dmoney.com',
    password: process.env.ADMIN_PASSWORD ?? '1234'
  };
}

export function systemCredentials() {
  return {
    email: process.env.SYSTEM_EMAIL ?? 'system@dmoney.com',
    password: process.env.SYSTEM_PASSWORD ?? '1234'
  };
}