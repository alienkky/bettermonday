const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"FranchiseSim" <${process.env.SMTP_USER || 'noreply@franchisesim.com'}>`;

async function sendPasswordReset(email, name, resetUrl) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '[FranchiseSim] 비밀번호 재설정 안내',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#1a1a1a;padding:24px;border-radius:12px 12px 0 0">
          <span style="color:#fff;font-weight:700;font-size:18px">FranchiseSim</span>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a1a1a;margin:0 0 16px">비밀번호 재설정</h2>
          <p style="color:#6b7280;line-height:1.6">${name}님, 비밀번호 재설정을 요청하셨습니다.<br>아래 버튼을 클릭하여 새 비밀번호를 설정하세요.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:24px 0;background:#0073ea;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">비밀번호 재설정하기</a>
          <p style="color:#9ca3af;font-size:12px">이 링크는 30분 후 만료됩니다.<br>요청하지 않으셨다면 이 이메일을 무시하세요.</p>
        </div>
      </div>`,
  });
}

async function sendEmailVerification(email, name, verifyUrl) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '[FranchiseSim] 이메일 인증 안내',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#1a1a1a;padding:24px;border-radius:12px 12px 0 0">
          <span style="color:#fff;font-weight:700;font-size:18px">FranchiseSim</span>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a1a1a;margin:0 0 16px">이메일 인증</h2>
          <p style="color:#6b7280;line-height:1.6">${name}님, 환영합니다!<br>아래 버튼을 클릭하여 이메일 주소를 인증하세요.</p>
          <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;background:#0073ea;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">이메일 인증하기</a>
          <p style="color:#9ca3af;font-size:12px">이 링크는 24시간 후 만료됩니다.</p>
        </div>
      </div>`,
  });
}

module.exports = { sendPasswordReset, sendEmailVerification };
