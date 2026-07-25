import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { emailLog, emailSuppressions } from '../db/schema.js';

let client: SESv2Client | null = null;

function sesClient(): SESv2Client {
  if (!client) client = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-west-2' });
  return client;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const rows = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.email, email))
    .limit(1);
  return rows.length > 0;
}

export interface OutgoingEmail {
  userId: string | null;
  to: string;
  kind: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Extra MIME headers. Bulk mail needs `List-Unsubscribe` /
   * `List-Unsubscribe-Post` so Gmail and friends render a native unsubscribe
   * control instead of teaching people to hit "report spam".
   */
  headers?: { name: string; value: string }[];
}

/** RFC 8058 one-click unsubscribe headers for a bulk send. */
export function unsubscribeHeaders(unsubscribeUrl: string): { name: string; value: string }[] {
  return [
    { name: 'List-Unsubscribe', value: `<${unsubscribeUrl}>, <mailto:matching@ridefinder.site?subject=unsubscribe>` },
    { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
  ];
}

export async function sendEmail(mail: OutgoingEmail): Promise<{ sent: boolean; messageId: string | null }> {
  if (await isSuppressed(mail.to)) {
    return { sent: false, messageId: null };
  }

  let messageId: string | null;
  if (process.env.EMAIL_DRY_RUN === '1') {
    console.log(`[email dry-run] to=${mail.to} kind=${mail.kind} subject="${mail.subject}"`);
    console.log(`[email dry-run] text body:\n${mail.text}`);
    messageId = 'dry-run';
  } else {
    const res = await sesClient().send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM ?? 'RideFinder <matching@ridefinder.site>',
        Destination: { ToAddresses: [mail.to] },
        Content: {
          Simple: {
            Subject: { Data: mail.subject },
            Body: { Html: { Data: mail.html }, Text: { Data: mail.text } },
            ...(mail.headers?.length ? { Headers: mail.headers.map((h) => ({ Name: h.name, Value: h.value })) } : {}),
          },
        },
      }),
    );
    messageId = res.MessageId ?? null;
  }

  await db.insert(emailLog).values({
    userId: mail.userId,
    toEmail: mail.to,
    kind: process.env.EMAIL_DRY_RUN === '1' ? `${mail.kind}-dry` : mail.kind,
    subject: mail.subject,
    sesMessageId: messageId,
  });
  return { sent: true, messageId };
}
