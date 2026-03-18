import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || "NYU树洞 <noreply@nyutreehole.com>";
const APP_URL = process.env.AUTH_URL || "http://localhost:3000";

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string
) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "【NYU树洞】请验证你的邮箱",
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
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 28px">
        感谢注册 NYU树洞！点击下方按钮验证你的邮箱，完成账号激活。
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${verifyUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#57068c,#7c3aed);color:#fff;text-decoration:none;padding:14px 36px;border-radius:100px;font-size:15px;font-weight:600;letter-spacing:0.2px">
          验证邮箱
        </a>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6;margin:0">
        此链接 <strong>24小时</strong> 内有效。若非本人操作，请忽略此邮件。<br>
        无法点击按钮？复制下方链接粘贴到浏览器：<br>
        <span style="color:#7c3aed;word-break:break-all">${verifyUrl}</span>
      </p>
    </div>
    <div style="background:#f5f0fb;padding:16px 40px;text-align:center">
      <p style="color:#aaa;font-size:11px;margin:0">NYU树洞 · 学生社区平台</p>
    </div>
  </div>
</body>
</html>`,
    text: `Hi ${displayName}，\n\n请访问以下链接验证你的邮箱（24小时有效）：\n${verifyUrl}\n\n若非本人操作，请忽略此邮件。\n\nNYU树洞`,
  });
}
