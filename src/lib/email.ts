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
  const appName = "NYU树洞";

  await transport.sendMail({
    from,
    to,
    subject: `${appName} 邮箱验证`,
    text: [
      `你好，${displayName}：`,
      "",
      `请点击下面的链接完成邮箱验证（${expiresInHours} 小时内有效）：`,
      verificationUrl,
      "",
      "如果这不是你的操作，请忽略这封邮件。",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>你好，${displayName}：</p>
        <p>请点击下面的按钮完成邮箱验证（${expiresInHours} 小时内有效）：</p>
        <p>
          <a
            href="${verificationUrl}"
            style="display:inline-block;padding:12px 20px;background:#57068c;color:#ffffff;text-decoration:none;border-radius:8px;"
          >
            验证邮箱
          </a>
        </p>
        <p>如果按钮无法点击，也可以复制下面这个链接到浏览器打开：</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p>如果这不是你的操作，请忽略这封邮件。</p>
      </div>
    `,
  });
}
