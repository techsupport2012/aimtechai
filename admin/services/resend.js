// backend/admin/services/resend.js
// Env-gated transactional email sender. Silently no-ops when RESEND_API_KEY
// or RESEND_TO_EMAIL is unset — callers can always call sendEmail without
// checking env themselves.

const API_KEY = process.env.RESEND_API_KEY || '';
const TO_EMAIL = process.env.RESEND_TO_EMAIL || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AIM Tech AI <no-reply@aimtechai.com>';

async function sendEmail({ subject, text }) {
  if (!API_KEY || !TO_EMAIL) {
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[resend]', res.status, detail);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('[resend]', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail };
