const express = require('express');
const { get, all, run } = require('../../db/db');
const { requireAuth, validateCsrf } = require('../middleware/auth');

const router = express.Router();

// GET / — list notifications (with optional ?unread=true shortcut)
router.get('/', requireAuth, (req, res) => {
  try {
    // Quick unread summary for bell dropdown
    if (req.query.unread === 'true') {
      const unreadCount = (get(`SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`) || {}).c || 0;
      const recent = all(
        `SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 10`
      );
      return res.json({ unreadCount, recent });
    }

    // Full listing with optional type filter + pagination
    const type = req.query.type || null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let where = '';
    const params = [];
    if (type) {
      where = 'WHERE type = ?';
      params.push(type);
    }

    const total = (get(`SELECT COUNT(*) AS c FROM notifications ${where}`, params) || {}).c || 0;
    const notifications = all(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ total, limit, offset, notifications });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /:id/read — mark single notification as read
router.patch('/:id/read', requireAuth, validateCsrf, (req, res) => {
  try {
    const { id } = req.params;
    const notif = get(`SELECT id FROM notifications WHERE id = ?`, [id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/:id/read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// POST /read-all — mark all notifications as read
router.post('/read-all', requireAuth, validateCsrf, (req, res) => {
  try {
    run(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /notifications/read-all error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /:id — delete notification
router.delete('/:id', requireAuth, validateCsrf, (req, res) => {
  try {
    const { id } = req.params;
    const notif = get(`SELECT id FROM notifications WHERE id = ?`, [id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    run(`DELETE FROM notifications WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /notifications/:id error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// POST /clear-old — delete notifications older than 30 days
router.post('/clear-old', requireAuth, validateCsrf, (req, res) => {
  try {
    const result = run(`DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')`);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    console.error('POST /notifications/clear-old error:', err);
    res.status(500).json({ error: 'Failed to clear old notifications' });
  }
});

// PUT /channel-settings — save notification channel settings
router.put('/channel-settings', requireAuth, validateCsrf, (req, res) => {
  try {
    const allowedKeys = [
      'notif_telegram_enabled', 'notif_telegram_bot_token', 'notif_telegram_chat_id',
      'notif_discord_enabled', 'notif_discord_webhook_url',
      'notif_whatsapp_enabled', 'notif_whatsapp_phone', 'notif_whatsapp_api_key',
      'notif_email_enabled', 'notif_email_to', 'notif_email_from',
      'notif_email_smtp_host', 'notif_email_smtp_port', 'notif_email_smtp_user', 'notif_email_smtp_pass',
      'notif_sms_enabled', 'notif_sms_provider', 'notif_sms_to',
      'notif_sms_twilio_sid', 'notif_sms_twilio_token', 'notif_sms_twilio_from'
    ];
    const body = req.body || {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        const value = String(body[key]);
        const existing = get('SELECT key FROM settings WHERE key = ?', [key]);
        if (existing) {
          run("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [value, key]);
        } else {
          run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", [key, value]);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /notifications/channel-settings error:', err);
    res.status(500).json({ error: 'Failed to save channel settings' });
  }
});

// PUT /trigger-settings — save notification trigger enable/disable list
router.put('/trigger-settings', requireAuth, validateCsrf, (req, res) => {
  try {
    const body = req.body || {};
    const raw = Array.isArray(body.disabled) ? body.disabled : [];
    const VALID = new Set([
      // Visitors & Engagement
      'visitor_new', 'visitor_return', 'visitor_returning_long',
      'visitor_long_session', 'visitor_high_intent', 'visitor_new_country',
      'visitor_after_hours', 'visitor_pages_5plus',
      'visitor_mobile', 'visitor_desktop', 'visitor_tablet',
      'visitor_chat_engaged', 'visitor_chat_long',
      'visitor_form_abandoned', 'visitor_video_played',
      'traffic_spike', 'bot_detected',
      // Marketing & Acquisition
      'shared_on_social', 'new_backlink', 'seo_query_logged',
      'newsletter_signup', 'direct_visit_spike',
      // Leads & Bookings
      'contact', 'booking', 'booking_cancel', 'booking_rescheduled',
      'booking_reminder_24h', 'booking_no_show',
      // Content & SEO
      'blog', 'page', 'error_404', 'slow_page', 'seo_search',
      // Account & Security
      'user_new', 'login', 'login_failed', 'login_new_ip',
      'emergency_login_used', 'password_changed', 'settings_changed',
      'api_key_added', 'api_key_removed', 'security', 'rate_limit_hit',
      // AI & KB
      'agent_run', 'agent_fail', 'kb', 'chat_query',
      'chat_off_topic_streak', 'chat_llm_error', 'chat_high_volume',
      // System & Operational
      'system', 'daily_digest', 'weekly_digest',
      'backup_completed', 'backup_failed',
      // Server & Infrastructure
      'server_started', 'server_crash', 'memory_high', 'disk_low',
      'db_size_warning', 'ssl_expiring', 'domain_expiring', 'uptime_check_failed',
      // API & Integrations
      'api_quota_warning', 'third_party_outage',
      'webhook_received', 'webhook_failed', 'mcp_server_connected',
      // Compliance & Privacy
      'gdpr_request', 'cookie_consent_declined'
    ]);
    const disabled = [...new Set(raw.filter(k => typeof k === 'string' && VALID.has(k)))];
    const value = JSON.stringify(disabled);
    const existing = get('SELECT key FROM settings WHERE key = ?', ['notification_triggers_disabled']);
    if (existing) {
      run("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [value, 'notification_triggers_disabled']);
    } else {
      run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", ['notification_triggers_disabled', value]);
    }
    res.json({ ok: true, disabled });
  } catch (err) {
    console.error('PUT /notifications/trigger-settings error:', err);
    res.status(500).json({ error: 'Failed to save trigger settings' });
  }
});

// POST /test-channel — send a test notification to a specific channel
router.post('/test-channel', requireAuth, validateCsrf, async (req, res) => {
  try {
    const { channel } = req.body || {};
    const { dispatchNotification } = require('../services/notify');

    // Temporarily enable the channel, send test, relies on current DB state
    const title = 'Test Notification';
    const message = 'This is a test from AIM Tech AI Admin Panel (' + new Date().toISOString() + ')';

    if (channel === 'telegram') {
      const gs = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? r.value : ''; };
      const token = gs('notif_telegram_bot_token');
      const chatId = gs('notif_telegram_chat_id');
      if (!token || !chatId) return res.json({ success: false, error: 'Bot token and chat ID are required' });
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const body = JSON.stringify({ chat_id: chatId, text: `${title}\n${message}`, parse_mode: 'HTML' });
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!resp.ok) return res.json({ success: false, error: 'Telegram API error: ' + resp.status });
      return res.json({ success: true });
    }

    if (channel === 'discord') {
      const gs = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? r.value : ''; };
      const webhook = gs('notif_discord_webhook_url');
      if (!webhook) return res.json({ success: false, error: 'Webhook URL is required' });
      const body = JSON.stringify({ content: `**${title}**\n${message}` });
      const resp = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!resp.ok && resp.status !== 204) return res.json({ success: false, error: 'Discord API error: ' + resp.status });
      return res.json({ success: true });
    }

    if (channel === 'whatsapp') {
      const gs = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? r.value : ''; };
      const phone = gs('notif_whatsapp_phone');
      const apiKey = gs('notif_whatsapp_api_key');
      if (!phone || !apiKey) return res.json({ success: false, error: 'Phone and API key are required' });
      const text = encodeURIComponent(`${title}\n${message}`);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${text}&apikey=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url);
      if (!resp.ok) return res.json({ success: false, error: 'WhatsApp API error: ' + resp.status });
      return res.json({ success: true });
    }

    if (channel === 'email') {
      const gs = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? r.value : ''; };
      const to = gs('notif_email_to');
      const from = gs('notif_email_from');
      const host = gs('notif_email_smtp_host');
      const port = parseInt(gs('notif_email_smtp_port') || '587', 10);
      const user = gs('notif_email_smtp_user');
      const pass = gs('notif_email_smtp_pass');
      if (!to || !host) return res.json({ success: false, error: 'Recipient and SMTP host are required' });
      try {
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
        await transport.sendMail({ from: from || user || 'noreply@aimtechai.com', to, subject: title, text: message });
        return res.json({ success: true });
      } catch (emailErr) {
        return res.json({ success: false, error: emailErr.message });
      }
    }

    if (channel === 'sms') {
      const gs = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? r.value : ''; };
      const provider = gs('notif_sms_provider') || 'twilio';
      const to = gs('notif_sms_to');
      const sid = gs('notif_sms_twilio_sid');
      const token = gs('notif_sms_twilio_token');
      const from = gs('notif_sms_twilio_from');
      if (!to || !sid || !token || !from) return res.json({ success: false, error: 'Phone, SID, Token, and From number are required' });

      const smsBody = `${title}\n${message}`;

      if (provider === 'twilio') {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
        const params = new URLSearchParams({ To: to, From: from, Body: smsBody });
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
          body: params.toString()
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'Twilio error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'vonage') {
        const url = 'https://rest.nexmo.com/sms/json';
        const body = JSON.stringify({ api_key: sid, api_secret: token, to: to.replace(/\+/g, ''), from: from, text: smsBody });
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!resp.ok) return res.json({ success: false, error: 'Vonage error: ' + resp.status });
        const data = await resp.json();
        if (data.messages && data.messages[0] && data.messages[0].status !== '0') return res.json({ success: false, error: 'Vonage: ' + data.messages[0]['error-text'] });
        return res.json({ success: true });
      }

      if (provider === 'plivo') {
        const url = `https://api.plivo.com/v1/Account/${sid}/Message/`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
          body: JSON.stringify({ src: from, dst: to.replace(/\+/g, ''), text: smsBody })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'Plivo error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'sinch') {
        const url = `https://us.sms.api.sinch.com/xms/v1/${sid}/batches`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ from, to: [to], body: smsBody })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'Sinch error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'messagebird') {
        const resp = await fetch('https://rest.messagebird.com/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'AccessKey ' + token },
          body: JSON.stringify({ originator: from, recipients: [to], body: smsBody })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'MessageBird error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'clicksend') {
        const resp = await fetch('https://rest.clicksend.com/v3/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
          body: JSON.stringify({ messages: [{ source: 'admin', from, to, body: smsBody }] })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'ClickSend error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'textmagic') {
        const resp = await fetch('https://rest.textmagic.com/api/v2/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TM-Username': sid, 'X-TM-Key': token },
          body: JSON.stringify({ phones: to, text: smsBody })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'TextMagic error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'telnyx') {
        const resp = await fetch('https://api.telnyx.com/v2/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ from, to, text: smsBody, type: 'SMS' })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'Telnyx error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'infobip') {
        const resp = await fetch('https://' + sid + '.api.infobip.com/sms/2/text/advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'App ' + token },
          body: JSON.stringify({ messages: [{ from, destinations: [{ to }], text: smsBody }] })
        });
        if (!resp.ok) { const err = await resp.text(); return res.json({ success: false, error: 'Infobip error ' + resp.status + ': ' + err.slice(0, 200) }); }
        return res.json({ success: true });
      }

      if (provider === 'aws_sns') {
        // AWS SNS uses Signature V4 — simplified with just the publish API
        // SID = Access Key, Token = Secret Key, region extracted from From or default us-east-1
        const region = 'us-east-1';
        const endpoint = `https://sns.${region}.amazonaws.com/`;
        const params = new URLSearchParams({ Action: 'Publish', PhoneNumber: to, Message: smsBody, Version: '2010-03-31' });
        // AWS Sig V4 is complex; for simplicity use the AWS SDK if available, otherwise raw
        try {
          const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
          const client = new SNSClient({ region, credentials: { accessKeyId: sid, secretAccessKey: token } });
          await client.send(new PublishCommand({ PhoneNumber: to, Message: smsBody }));
          return res.json({ success: true });
        } catch (awsErr) {
          return res.json({ success: false, error: 'AWS SNS: ' + awsErr.message + ' (install @aws-sdk/client-sns for AWS support)' });
        }
      }

      return res.json({ success: false, error: 'Unknown SMS provider: ' + provider });
    }

    res.json({ success: false, error: 'Unknown channel: ' + channel });
  } catch (err) {
    console.error('POST /notifications/test-channel error:', err);
    res.status(500).json({ error: 'Failed to send test' });
  }
});

module.exports = router;
