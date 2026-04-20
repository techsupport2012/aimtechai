/**
 * Multi-channel notification dispatcher
 * Sends notifications to Telegram, Discord, WhatsApp, and Email
 * Never throws — catches all errors and logs them
 */

const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');
const { get } = require('../../db/db');

// ---------------------------------------------------------------------------
// Helper: read a single setting from the DB
// ---------------------------------------------------------------------------
function getSetting(key) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : '';
}

// ---------------------------------------------------------------------------
// Helper: make an HTTPS/HTTP request (returns a Promise)
// ---------------------------------------------------------------------------
function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Channel: Telegram
// ---------------------------------------------------------------------------
async function sendTelegram(title, message) {
  const enabled = getSetting('notif_telegram_enabled');
  const token = getSetting('notif_telegram_bot_token');
  const chatId = getSetting('notif_telegram_chat_id');

  if (enabled !== '1' || !token || !chatId) return;

  const text = `\u{1F514} ${title}\n${message}`;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = JSON.stringify({ chat_id: chatId, text });

  const resp = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, payload);

  if (resp.status >= 400) {
    console.error('[notify:telegram] Error:', resp.status, resp.body);
  }
}

// ---------------------------------------------------------------------------
// Channel: Discord
// ---------------------------------------------------------------------------
async function sendDiscord(title, message) {
  const enabled = getSetting('notif_discord_enabled');
  const webhookUrl = getSetting('notif_discord_webhook_url');

  if (enabled !== '1' || !webhookUrl) return;

  const content = `\u{1F514} **${title}**\n${message}`;
  const payload = JSON.stringify({ content, username: 'AIM Tech AI' });

  const resp = await request(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, payload);

  if (resp.status >= 400) {
    console.error('[notify:discord] Error:', resp.status, resp.body);
  }
}

// ---------------------------------------------------------------------------
// Channel: WhatsApp (CallMeBot)
// ---------------------------------------------------------------------------
async function sendWhatsApp(title, message) {
  const enabled = getSetting('notif_whatsapp_enabled');
  const phone = getSetting('notif_whatsapp_phone');
  const apiKey = getSetting('notif_whatsapp_api_key');

  if (enabled !== '1' || !phone || !apiKey) return;

  const text = `\u{1F514} ${title}\n${message}`;
  const encodedMessage = encodeURIComponent(text);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodedMessage}&apikey=${encodeURIComponent(apiKey)}`;

  const resp = await request(url, { method: 'GET' });

  if (resp.status >= 400) {
    console.error('[notify:whatsapp] Error:', resp.status, resp.body);
  }
}

// ---------------------------------------------------------------------------
// Channel: Email (SMTP via nodemailer)
// ---------------------------------------------------------------------------
async function sendEmail(title, message) {
  const enabled = getSetting('notif_email_enabled');
  const to = getSetting('notif_email_to');
  const host = getSetting('notif_email_smtp_host');
  const port = getSetting('notif_email_smtp_port') || '587';
  const user = getSetting('notif_email_smtp_user');
  const pass = getSetting('notif_email_smtp_pass');
  const fromNotif   = getSetting('notif_email_from');
  const fromDefault = getSetting('email_default_from');
  const from        = fromNotif || fromDefault;
  const replyTo     = getSetting('email_default_reply_to');
  const footerText  = getSetting('email_footer_text', 'Sent by AIM Tech AI Admin Panel');

  if (enabled !== '1' || !to || !host || !user || !pass || !from) return;

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass }
  });

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#14b8a6;margin-bottom:0.5rem;">\u{1F514} ${title}</h2>
      <p style="color:#333;line-height:1.6;white-space:pre-wrap;">${message}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;">
      <p style="color:#999;font-size:0.8rem;">${footerText}</p>
    </div>
  `;

  const mailOpts = { from, to, subject: title, text: message, html };
  if (replyTo) mailOpts.replyTo = replyTo;

  await transporter.sendMail(mailOpts);
}

// ---------------------------------------------------------------------------
// Main dispatcher — sends to all enabled channels in parallel, never throws
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SMS (Twilio / Vonage / Plivo)
// ---------------------------------------------------------------------------
async function sendSms(title, message) {
  const enabled = getSetting('notif_sms_enabled');
  if (enabled !== '1') return;

  const provider = getSetting('notif_sms_provider') || 'twilio';
  const to = getSetting('notif_sms_to');
  const sid = getSetting('notif_sms_twilio_sid');
  const token = getSetting('notif_sms_twilio_token');
  const from = getSetting('notif_sms_twilio_from');
  if (!to || !sid || !token || !from) return;

  const body = `${title}\n${message}`;

  const basicAuth = 'Basic ' + Buffer.from(sid + ':' + token).toString('base64');

  if (provider === 'twilio') {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    await request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': basicAuth } },
      new URLSearchParams({ To: to, From: from, Body: body }).toString());
  } else if (provider === 'vonage') {
    await request('https://rest.nexmo.com/sms/json', { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify({ api_key: sid, api_secret: token, to: to.replace(/\+/g, ''), from, text: body }));
  } else if (provider === 'plivo') {
    await request(`https://api.plivo.com/v1/Account/${sid}/Message/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': basicAuth } },
      JSON.stringify({ src: from, dst: to.replace(/\+/g, ''), text: body }));
  } else if (provider === 'sinch') {
    await request(`https://us.sms.api.sinch.com/xms/v1/${sid}/batches`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } },
      JSON.stringify({ from, to: [to], body }));
  } else if (provider === 'messagebird') {
    await request('https://rest.messagebird.com/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'AccessKey ' + token } },
      JSON.stringify({ originator: from, recipients: [to], body }));
  } else if (provider === 'clicksend') {
    await request('https://rest.clicksend.com/v3/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': basicAuth } },
      JSON.stringify({ messages: [{ source: 'admin', from, to, body }] }));
  } else if (provider === 'textmagic') {
    await request('https://rest.textmagic.com/api/v2/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TM-Username': sid, 'X-TM-Key': token } },
      JSON.stringify({ phones: to, text: body }));
  } else if (provider === 'telnyx') {
    await request('https://api.telnyx.com/v2/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } },
      JSON.stringify({ from, to, text: body, type: 'SMS' }));
  } else if (provider === 'infobip') {
    await request('https://' + sid + '.api.infobip.com/sms/2/text/advanced', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'App ' + token } },
      JSON.stringify({ messages: [{ from, destinations: [{ to }], text: body }] }));
  } else if (provider === 'aws_sns') {
    try { const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
      await new SNSClient({ region: 'us-east-1', credentials: { accessKeyId: sid, secretAccessKey: token } }).send(new PublishCommand({ PhoneNumber: to, Message: body }));
    } catch (e) { console.error('[notify:sms:aws]', e.message); }
  }
}

// ---------------------------------------------------------------------------
// Trigger gating — admins can disable specific notification types from the
// admin panel (Notifications → Triggers tab). Disabled triggers still get
// inserted into the inbox table (callers do that separately), but won't
// fan-out to external channels.
// Stored as JSON array of disabled type strings in the settings table:
//   key: 'notification_triggers_disabled'
//   value: '["chat_query","agent_run"]'
// Default = empty array = all enabled.
// ---------------------------------------------------------------------------
function isTriggerEnabled(type) {
  if (!type) return true;
  try {
    const raw = getSetting('notification_triggers_disabled');
    if (!raw) return true;
    const disabled = JSON.parse(raw);
    if (!Array.isArray(disabled)) return true;
    return !disabled.includes(type);
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher — sends to all enabled channels in parallel, never throws
// ---------------------------------------------------------------------------
async function dispatchNotification(title, message, type) {
  try {
    if (!isTriggerEnabled(type)) return; // disabled trigger — skip channels
    await Promise.allSettled([
      sendTelegram(title, message).catch(err => console.error('[notify:telegram]', err.message)),
      sendDiscord(title, message).catch(err => console.error('[notify:discord]', err.message)),
      sendWhatsApp(title, message).catch(err => console.error('[notify:whatsapp]', err.message)),
      sendEmail(title, message).catch(err => console.error('[notify:email]', err.message)),
      sendSms(title, message).catch(err => console.error('[notify:sms]', err.message))
    ]);
  } catch (err) {
    console.error('[notify] Unexpected dispatch error:', err.message);
  }
}

module.exports = { dispatchNotification, isTriggerEnabled };
