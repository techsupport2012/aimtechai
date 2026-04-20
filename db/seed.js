const { get, all, insert } = require('./db');
const path = require('path');
const fs = require('fs');

async function seedPages() {
  const pageCount = await get('SELECT COUNT(*) as count FROM pages');
  if (pageCount && pageCount.count > 0) return;

  const slugs = ['index', 'about', 'ai', 'cloud', 'consulting', 'portfolio', 'qa', 'ui-ux', 'blog'];
  const publicDir = path.join(__dirname, '..', 'public');

  for (const slug of slugs) {
    const filePath = path.join(publicDir, `${slug}.html`);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, 'utf-8');
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : slug;
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
    const metaDescription = metaMatch ? metaMatch[1].trim() : '';

    try {
      await insert('pages', {
        slug, title,
        meta_description: metaDescription,
        content_html: html,
        status: 'published',
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      if (!/UNIQUE|Duplicate/i.test(e.message)) throw e;
    }
  }
}

async function seed() {
  const stageCount = await get('SELECT COUNT(*) as count FROM pipeline_stages');
  if (stageCount && stageCount.count === 0) {
    const stages = [
      { name: 'Lead',         position: 1, color: '#5eead4' },
      { name: 'Qualified',    position: 2, color: '#2dd4bf' },
      { name: 'Proposal',     position: 3, color: '#14b8a6' },
      { name: 'Negotiation',  position: 4, color: '#0d9488' },
      { name: 'Won',          position: 5, color: '#22c55e' },
      { name: 'Lost',         position: 6, color: '#ef4444' },
    ];
    for (const stage of stages) {
      try { await insert('pipeline_stages', stage); } catch {}
    }
  }

  const settingsCount = await get('SELECT COUNT(*) as count FROM settings');
  if (settingsCount && settingsCount.count === 0) {
    const defaults = {
      company_name: 'AIM Tech AI', company_phone: '', company_address: '',
      timezone: 'America/Los_Angeles',
      booking_days: '1,2,3,4,5', booking_start: '09:00', booking_end: '17:00',
      booking_duration: '30', booking_max_per_slot: '1', booking_buffer: '15',
      agent_max_tokens: '4096', agent_max_runs_hour: '20', agent_max_runs_day: '200',
      agent_scheduled_enabled: 'true', claude_api_key: '',
      notif_telegram_enabled: '0', notif_telegram_bot_token: '', notif_telegram_chat_id: '',
      notif_discord_enabled: '0', notif_discord_webhook_url: '',
      notif_whatsapp_enabled: '0', notif_whatsapp_phone: '', notif_whatsapp_api_key: '',
      notif_email_enabled: '0', notif_email_to: '',
      notif_email_smtp_host: '', notif_email_smtp_port: '587',
      notif_email_smtp_user: '', notif_email_smtp_pass: '', notif_email_from: '',
      notif_sms_enabled: '0', notif_sms_provider: 'twilio', notif_sms_to: '',
      notif_sms_twilio_sid: '', notif_sms_twilio_token: '', notif_sms_twilio_from: '',
    };
    for (const [key, value] of Object.entries(defaults)) {
      try { await insert('settings', { key, value }); } catch {}
    }
  }

  const notifDefaults = {
    notif_telegram_enabled: '0', notif_telegram_bot_token: '', notif_telegram_chat_id: '',
    notif_discord_enabled: '0', notif_discord_webhook_url: '',
    notif_whatsapp_enabled: '0', notif_whatsapp_phone: '', notif_whatsapp_api_key: '',
    notif_email_enabled: '0', notif_email_to: '', notif_email_smtp_host: '',
    notif_email_smtp_port: '587', notif_email_smtp_user: '', notif_email_smtp_pass: '', notif_email_from: ''
  };
  for (const [key, value] of Object.entries(notifDefaults)) {
    const exists = await get('SELECT `key` FROM settings WHERE `key` = ?', [key]);
    if (!exists) {
      try { await insert('settings', { key, value }); } catch {}
    }
  }

  await seedPages();
  await seedBlogPosts();
}

async function seedBlogPosts() {
  const postCount = await get('SELECT COUNT(*) as count FROM blog_posts');
  if (postCount && postCount.count > 0) return;

  const blogDir = path.join(__dirname, '..', 'public', 'blog');
  if (!fs.existsSync(blogDir)) return;

  const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));

  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    const filePath = path.join(blogDir, file);
    const html = fs.readFileSync(filePath, 'utf-8');

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    let title = '';
    if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, '').trim();
    else if (titleMatch) title = titleMatch[1].replace(/\s*\|.*$/, '').trim();
    if (!title) title = slug;

    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
    const metaDescription = metaMatch ? metaMatch[1].trim() : '';

    let category = 'Engineering';
    const sectionMatch = html.match(/"articleSection"\s*:\s*"([^"]+)"/);
    if (sectionMatch) category = sectionMatch[1].trim();

    let publishedAt = new Date().toISOString();
    const dateMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (dateMatch) publishedAt = dateMatch[1].trim();

    let tags = '';
    const keywordsMatch = html.match(/"keywords"\s*:\s*\[([\s\S]*?)\]/);
    if (keywordsMatch) tags = keywordsMatch[1].replace(/"/g, '').replace(/\s*,\s*/g, ', ').trim();

    try {
      await insert('blog_posts', {
        slug, title,
        excerpt: metaDescription.slice(0, 200),
        content_html: html, category, tags,
        meta_description: metaDescription,
        status: 'published',
        published_at: publishedAt,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      if (!/UNIQUE|Duplicate/i.test(e.message)) throw e;
    }
  }
}

module.exports = { seed };
