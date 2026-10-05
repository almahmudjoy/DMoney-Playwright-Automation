import { APIRequestContext, expect } from '@playwright/test';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
type GmailPart = { body?: { data?: string }; headers?: Array<{ name?: string; value?: string }>; parts?: GmailPart[] };

function decodeParts(part?: GmailPart): string[] {
  if (!part) return [];
  const body = part.body?.data ? Buffer.from(part.body.data, 'base64url').toString('utf8') : '';
  return [body, ...(part.parts ?? []).flatMap(decodeParts)];
}

export class GmailClient {
  private oauthClient: OAuth2Client | undefined;

  constructor(private readonly request: APIRequestContext) {}

  private async authorizationHeaders(): Promise<{ Authorization: string }> {
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (refreshToken) {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to use GMAIL_REFRESH_TOKEN.');
      }

      if (!this.oauthClient) {
        this.oauthClient = new OAuth2Client(clientId, clientSecret);
        this.oauthClient.setCredentials({ refresh_token: refreshToken });
      }
      const { token } = await this.oauthClient.getAccessToken();
      if (!token) throw new Error('Google OAuth did not return an access token. Re-authorize Gmail access.');
      return { Authorization: `Bearer ${token}` };
    }

    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Set Gmail refresh credentials or a temporary GMAIL_ACCESS_TOKEN in .env.');
    }
    return { Authorization: `Bearer ${accessToken}` };
  }

  async waitForOtp(email: string, receivedAfter: number, timeoutMs = 180_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await this.request.get(GMAIL_API, {
        headers: await this.authorizationHeaders(),
        params: { q: `subject:"Your Login OTP" to:${email} newer_than:1d`, maxResults: 10 }
      });
      expect(response.status(), await response.text()).toBe(200);
      const { messages = [] } = await response.json() as { messages?: Array<{ id: string }> };

      for (const message of messages) {
        const mailResponse = await this.request.get(`${GMAIL_API}/${message.id}`, {
          headers: await this.authorizationHeaders()
        });
        expect(mailResponse.status(), await mailResponse.text()).toBe(200);
        const mail = await mailResponse.json() as {
          internalDate?: string;
          snippet?: string;
          payload?: GmailPart;
        };
        if (Number(mail.internalDate) <= receivedAfter) continue;

        const body = `${mail.snippet ?? ''} ${decodeParts(mail.payload).join(' ')}`;
        const labeledOtp = body.match(/(?:otp|one[\s-]?time (?:password|code)|verification code)[^\d]{0,32}(\d{4})/i)?.[1];
        const otp = labeledOtp ?? body.match(/\b\d{4}\b/)?.[0];
        if (otp) return otp;
      }

      await new Promise(resolve => setTimeout(resolve, 3_000));
    }

    throw new Error(`No new OTP for ${email} arrived within ${timeoutMs / 1000} seconds.`);
  }

  async waitForPasswordResetLink(email: string, receivedAfter: number, timeoutMs = 180_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await this.request.get(GMAIL_API, {
        headers: await this.authorizationHeaders(),
        params: { q: `to:${email} subject:"dMoney – Password Reset Request" newer_than:2d`, maxResults: 20 }
      });
      expect(response.status(), await response.text()).toBe(200);
      const { messages = [] } = await response.json() as { messages?: Array<{ id: string }> };

      if (!messages.length) {
        const fallbackResponse = await this.request.get(GMAIL_API, {
          headers: await this.authorizationHeaders(),
          params: { q: `to:${email} newer_than:2d`, maxResults: 20 }
        });
        if (fallbackResponse.status() === 200) {
          const fallback = await fallbackResponse.json() as { messages?: Array<{ id: string }> };
          messages.push(...(fallback.messages ?? []));
        }
      }

      for (const message of messages) {
        const mailResponse = await this.request.get(`${GMAIL_API}/${message.id}`, {
          headers: await this.authorizationHeaders()
        });
        expect(mailResponse.status(), await mailResponse.text()).toBe(200);
        const mail = await mailResponse.json() as {
          internalDate?: string;
          snippet?: string;
          payload?: GmailPart;
        };
        if (Number(mail.internalDate) < receivedAfter) continue;
        const recipient = mail.payload?.headers?.find(header => header.name?.toLowerCase() === 'to')?.value ?? '';
        if (!recipient.toLowerCase().includes(email.toLowerCase())) continue;

        const body = `${mail.snippet ?? ''} ${decodeParts(mail.payload).join(' ')}`.replaceAll('&amp;', '&');
        const links = (body.match(/https?:\/\/[^\s"'<>]+/g) ?? []).map(link => link.replace(/[),.;]+$/, ''));
        const resetLink = links.find(link => {
          try {
            const parsed = new URL(link);
            return parsed.hostname === 'dmoneyportal.roadtocareer.net' &&
              parsed.pathname === '/reset-password' && Boolean(parsed.searchParams.get('token'));
          } catch {
            return false;
          }
        });
        if (resetLink) return resetLink;

        const fallbackMatch = body.match(/https?:\/\/dmoneyportal\.roadtocareer\.net\/reset-password\?token=[^\s"'<>]+/i);
        if (fallbackMatch) return fallbackMatch[0].replace(/[),.;]+$/, '');
      }

      await new Promise(resolve => setTimeout(resolve, 3_000));
    }

    throw new Error(`No new password reset link for ${email} arrived within ${timeoutMs / 1000} seconds.`);
  }
}