import { EmailService } from '../email/email.service';
import { InvitesService } from './invites.service';

const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as any;

describe('invite email result', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const send = (values?: Record<string, string>) =>
    new InvitesService({} as any, config(values), new EmailService(config(values))).send('a@example.com', 'School', 'token');

  it('says "not sent" when email is not set up, so the link is handed over by hand', async () => {
    expect(await send()).toBe(false);
  });

  it('says "sent" when the mail provider accepted it', async () => {
    global.fetch = jest.fn(async () => ({ ok: true })) as any;
    expect(await send({ RESEND_API_KEY: 'test-key' })).toBe(true);
  });

  it('says "not sent" when the mail provider refused it', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 422 })) as any;
    expect(await send({ RESEND_API_KEY: 'test-key' })).toBe(false);
  });
});
