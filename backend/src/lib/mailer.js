import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const transport = config.mail.host
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
  : null;

export const mailEnabled = Boolean(transport);

/**
 * Send an email without blocking the request. Never throws.
 * If SMTP isn't configured the message is only logged (dev mode).
 */
export function sendMail({ to, subject, text, replyTo }) {
  if (!to) return;
  const recipients = Array.isArray(to) ? to : [to];
  (async () => {
    let delivered = false;
    for (const r of recipients) {
      // one message per person, so recipients never see each other's addresses
      if (transport) {
        try {
          await transport.sendMail({ from: config.mail.from, to: r, subject, text, replyTo });
          delivered = true;
        } catch (e) {
          delivered = false;
          console.error('[mail] failed:', e.message);
        }
      } else if (config.env !== 'test') {
        console.log(`[mail:dev] to=${r} subject="${subject}"\n${text}\n`);
      }
      await query('INSERT INTO email_log(sender, recipient, subject, delivered) VALUES ($1,$2,$3,$4)', [
        replyTo || config.mail.from, r, subject, delivered,
      ]).catch(() => {});
    }
  })();
}
