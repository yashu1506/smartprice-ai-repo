import nodemailer from "nodemailer";

// Defaults mirror `server/.env.example`.
// Note: embedding SMTP_PASS as a fallback is not recommended for production.
const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER ?? "prajapatiabhi8055@gmail.com";
const pass =
  process.env.SMTP_PASS ?? "ofrimbfbnlbjbfad";
const from = process.env.SMTP_FROM ?? "prajapatiabhi8055@gmail.com";

let transport:
  | ReturnType<typeof nodemailer.createTransport>
  | null = null;

function getTransport() {
  if (transport) return transport;

  const hasAuth = Boolean(user && pass);
  if (!host || !from || !hasAuth) {
    return null;
  }

  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transport;
}

export async function sendPriceChangeEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const t = getTransport();
  if (!t) {
    // If SMTP isn't configured, fail silently to avoid breaking the cron job.
    console.log("Email not sent (SMTP not configured).", params.to);
    return;
  }

  await t.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

