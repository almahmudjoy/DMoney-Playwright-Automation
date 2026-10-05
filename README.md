# DMoney Portal Playwright Assignment

Batch 19 individual assignment, organized using the mentor repositories' TypeScript, Playwright, Page Object Model, and tagged-suite conventions.

## Workflow Coverage

The regression scenario registers a new Agent, confirms the pending status in the Admin user list, activates the Agent and checks persistence after reload, deposits Tk 2,000 from System, verifies the Agent balance, cashes in Tk 500 to an existing Customer, verifies the resulting Tk 1,512.50 balance, resets the Agent password, checks the old password is rejected, signs in with the new password, and exports every Self Statement table page to CSV. If a Customer rejects the deposit because of an account limit, the workflow tries another existing Customer.

The positive-only smoke scenario runs the successful workflow without the deliberate old-password rejection check. Select it with `npm run test:smoke`.

## Setup

1. Install Node.js 20 or newer.
2. Run `npm install` and `npx playwright install chromium`.
3. Copy `.env.example` to `.env`, set `AGENT_EMAIL` to a Gmail inbox you control, and configure `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` for that same inbox with Gmail read-only scope and offline access. The workflow finds an existing Customer from the Admin user list; set optional `CUSTOMER_ACCOUNT` only if you want to target a specific one.
4. Adjust `AGENT_INITIAL_PASSWORD` and `AGENT_NEW_PASSWORD` if the portal's password policy requires it.

The Admin and System defaults are the assignment credentials. With refresh credentials, Google's OAuth client renews expired access tokens during later test runs. `GMAIL_ACCESS_TOKEN` is supported only as a temporary fallback and expires; the OAuth Playground's auto-refresh option does not update the token copied into this project's `.env`. When using OAuth Playground, use your own OAuth client and retain its refresh token, client ID, and client secret. Keep all OAuth credentials in `.env`; do not commit them.

## Run

```sh
npm test
npm run test:regression
npm run test:smoke
npm run test:headed
npm run report
```

Tests use headed Chromium and record video. Playwright reports and videos are written under ignored `playwright-report/` and `test-results/` folders. Extracted statements are written to `output/self_statement_YYYY-MM-DD.csv`.

Last successful extracted statement: [output/self_statement_2026-10-05.csv](output/self_statement_2026-10-05.csv).

## Evidence for Submission

The passing regression and smoke evidence below was captured on 2026-10-05.

### Regression Test Result

![Passing regression Playwright report](docs/evidence/regression-test-result.png)

### Smoke Test Result

![Passing positive-only smoke Playwright report](docs/evidence/smoke-test-result.png)

### Headed Run Video

[Regression video](docs/evidence/regression-video.webm) · [Positive-only smoke video](docs/evidence/smoke-video.webm)

The selected evidence is kept in `docs/evidence/`. Temporary Playwright reports and run artifacts remain ignored.

An Oct 6 verification attempt was blocked at Gmail OTP retrieval with HTTP 401. The local environment has an expired `GMAIL_ACCESS_TOKEN` and no Gmail OAuth refresh credentials configured. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in `.env` before recording fresh runs.

## Notes

The live portal requires a mailbox-controlled Gmail address for Agent login OTPs and password reset links, plus an existing Customer account for the Tk 500 deposit. The workflow creates a Gmail plus-alias for unique Agent registration and tries Customer accounts from the Admin user list until one accepts the deposit; set optional `CUSTOMER_ACCOUNT` to target one account explicitly.