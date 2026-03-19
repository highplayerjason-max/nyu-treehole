import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const FROM = process.env.SMTP_FROM || "NYU树洞 <noreply@nyutreehole.com>";

/** Generate a random 6-digit verification code */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Send a 6-digit verification code to the user's email */
export async function sendVerificationCode(
  to: string,
  displayName: string,
  code: string
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `【NYU树洞】你的验证码：${code}`,
    html: `
<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(87,6,140,0.08)">
    <div style="background:linear-gradient(135deg,#57068c,#7c3aed);padding:32px 40px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">NYU树洞</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">NYU学生匿名社区</p>
    </div>
    <div style="padding:40px">
      <p style="color:#111;font-size:16px;margin:0 0 8px">Hi，<strong>${displayName}</strong></p>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px">
        你的邮箱验证码如下，请在 10 分钟内输入完成验证：
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#f5f0fb;border:2px solid #7c3aed;border-radius:12px;padding:16px 40px;font-size:32px;font-weight:700;letter-spacing:8px;color:#57068c;font-family:monospace">
          ${code}
        </div>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6;margin:0">
        验证码 <strong>10 分钟</strong>内有效。若非本人操作，请忽略此邮件。
      </p>
    </div>
    <div style="background:#f5f0fb;padding:16px 40px;text-align:center">
      <p style="color:#aaa;font-size:11px;margin:0">NYU树洞 · 学生社区平台</p>
    </div>
  </div>
</body>
</html>`,
    text: `Hi ${displayName}，\n\n你的验证码是：${code}\n\n验证码10分钟内有效。若非本人操作，请忽略此邮件。\n\nNYU树洞`,
  });
}
