const express = require('express');
const { insert } = require('../../db/db');
const { dispatchNotification } = require('../services/notify');
const { checkRateLimit } = require('../../lib/rate-limit');
const { sendEmail } = require('../services/resend');

const router = express.Router();

router.use(express.json({ limit: '32kb' }));

// Rate limiter: 5 submissions per minute per IP
async function submitLimiter(req, res, next) {
  try {
    const ip =
      (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || 'unknown';
    const gate = await checkRateLimit(`contacts:${ip}`, 5, 60_000);
    if (!gate.ok) return res.status(429).json({ error: 'rate_limited' });
    next();
  } catch (err) {
    console.error('[contacts-public] rate-limit error:', err);
    // On error, fail open (let the request through) — same policy as the Upstash adapter
    next();
  }
}

// POST /api/admin/contacts-public
// Unauthenticated contact/newsletter submit. Creates a row in `contacts` and
// dispatches an admin notification.
router.post('/contacts-public', submitLimiter, (req, res) => {
  try {
    const {
      name = '',
      email = '',
      company = '',
      source = 'contact_form',
      notes = '',
      phone = '',
    } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const safeName = ((name || email.split('@')[0]) + '').slice(0, 200);
    const safeEmail = (email + '').slice(0, 200);
    const safePhone = (phone + '').slice(0, 50);
    const safeCompany = (company + '').slice(0, 200);
    const safeSource = (source + '').slice(0, 50);
    const safeNotes = (notes + '').slice(0, 5000);

    const now = new Date().toISOString();
    const result = insert('contacts', {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      company: safeCompany,
      source: safeSource,
      status: 'new',
      notes: safeNotes,
      created_at: now,
      updated_at: now,
    });

    const id = result.lastInsertRowid;

    try {
      dispatchNotification(
        `New ${safeSource.replace(/_/g, ' ')}: ${safeEmail}`,
        safeNotes.slice(0, 200),
        'contact',
      );
    } catch (notifyErr) {
      console.error('[contacts-public] notification dispatch failed:', notifyErr.message);
      // Don't fail the request — the row was saved.
    }

    sendEmail({
      subject: `New ${safeSource.replace(/_/g, ' ')}: ${safeEmail}`,
      text: [
        `Email: ${safeEmail}`,
        safeCompany ? `Organisation: ${safeCompany}` : null,
        `Source: ${safeSource}`,
        '',
        safeNotes || '(no message)',
      ]
        .filter(Boolean)
        .join('\n'),
    }).catch(() => {});

    res.json({ ok: true, id });
  } catch (err) {
    console.error('POST /contacts-public error:', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
