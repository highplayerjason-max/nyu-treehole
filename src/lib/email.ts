import nodemailer from "nodemailer";

type VerificationEmailInput = {
  to: string;
  displayName: string;
  verificationUrl: string;
  expiresInHours: number;
};

function getDeliveryMode() {
  if (process.env.EMAIL_DELIVERY_MODE) {
    return process.env.EMAIL_DELIVERY_MODE;
  }

  return process.env.NODE_ENV === "production" ? "smtp" : "log";
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendVerificationEmail({
  to,
  displayName,
  verificationUrl,
  expiresInHours,
}: VerificationEmailInput) {
  const deliveryMode = getDeliveryMode();

  if (deliveryMode === "log") {
    console.info("[email verification]", { to, verificationUrl });
    return;
  }

  const from = process.env.SMTP_FROM;
  if (!from) {
    throw new Error("SMTP_FROM is not configured");
  }

  const transport = getTransport();
  const appName = "NYU Treehole";

  await transport.sendMail({
    from,
    to,
    subject: `${appName} email verification`,
    text: [
      `Hi ${displayName},`,
      "",
      `Please verify your email address by opening the link below. This link will expire in ${expiresInHours} hours:`,
      verificationUrl,
      "",
      "If you did not create this account, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hi ${displayName},</p>
        <p>Please confirm your email address by clicking the button below. This link will expire in ${expiresInHours} hours.</p>
        <p>
          <a
            href="${verificationUrl}"
            style="display:inline-block;padding:12px 20px;background:#57068c;color:#ffffff;text-decoration:none;border-radius:8px;"
          >
            Verify email
          </a>
        </p>
        <p>If the button does not work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
      </div>
    `,
  });
}
