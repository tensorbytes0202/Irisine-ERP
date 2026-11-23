/** Branded OTP email (Irisine Classrooms, green theme). */
export function otpEmail(opts: { code: string; purpose: 'SIGNUP' | 'RESET'; minutes: number }) {
  const title = opts.purpose === 'SIGNUP' ? 'Verify your email' : 'Reset your password';
  const intro =
    opts.purpose === 'SIGNUP'
      ? 'Use this code to verify your email address and finish creating your account.'
      : 'Use this code to reset your password.';
  const html = `
<div style="background:#F8FAF8;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2eae4;">
    <div style="background:#065F46;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;">
      Irisine <span style="color:#86efac;font-weight:500;">Classrooms</span>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 8px;color:#064E3B;font-size:22px;">${title}</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.5;">${intro}</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;letter-spacing:10px;font-size:34px;font-weight:700;color:#065F46;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:14px 22px;">${opts.code}</span>
      </div>
      <p style="margin:0 0 8px;color:#475569;font-size:14px;">This code expires in <strong>${opts.minutes} minutes</strong>.</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;">If you did not request this, you can safely ignore this email. Never share this code with anyone.</p>
    </div>
  </div>
</div>`;
  return { subject: "Your Irisine Classrooms verification code", html };
}
