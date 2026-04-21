/* ============================================================
   AIM Tech AI — Hero AI Chat Widget (vanilla JS, no deps)
   Mounts inside #hero-ai-chat and talks to /api/public/chat.
   ============================================================ */

const ENDPOINT = '/api/public/chat';
const MAX_INPUT = 500;

const QUICK_PROMPTS = [
  'What services do you offer?',
  'Show me your portfolio',
  'How do I book a call?',
  'What technologies do you use?'
];

/* ---------- helpers ---------- */

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    } else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) {
      node.setAttribute(k, attrs[k]);
    }
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

const SEND_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 2 11 13"></path>
    <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
  </svg>`;

const ARROW_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
       stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12h14"></path>
    <path d="m12 5 7 7-7 7"></path>
  </svg>`;

/* ---------- main widget ---------- */

export function initHeroAiChat() {
  const root = document.getElementById('hero-ai-chat');
  if (!root) return;
  if (root.dataset.heroChatReady === '1') return;
  root.dataset.heroChatReady = '1';

  /* ---- structure ---- */
  const header = el('div', { class: 'chat-header' }, [
    el('div', { class: 'chat-title', text: 'Ask Anything' }),
    el('div', { class: 'chat-subtitle', text: 'AI assistant by AIM Tech AI' })
  ]);

  const messages = el('div', {
    class: 'chat-messages',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions'
  });

  const quickPrompts = el('div', { class: 'chat-quick-prompts' });
  QUICK_PROMPTS.forEach((q) => {
    const btn = el('button', {
      type: 'button',
      class: 'chat-quick-btn',
      text: q
    });
    btn.addEventListener('click', () => {
      input.value = q;
      send();
    });
    quickPrompts.appendChild(btn);
  });

  const input = el('input', {
    type: 'text',
    class: 'chat-input',
    placeholder: 'Type your question...',
    maxlength: String(MAX_INPUT),
    'aria-label': 'Chat message'
  });

  const sendBtn = el('button', {
    type: 'button',
    class: 'chat-send-btn',
    'aria-label': 'Send message',
    html: SEND_ICON_SVG
  });

  const inputRow = el('div', { class: 'chat-input-row' }, [input, sendBtn]);

  root.innerHTML = '';
  // Close button (only visible in fullscreen mode via CSS)
  const closeBtn = el('button', {
    type: 'button',
    class: 'chat-fs-close',
    'aria-label': 'Exit fullscreen',
    title: 'Close',
    html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  });

  root.appendChild(closeBtn);
  root.appendChild(header);
  root.appendChild(messages);
  root.appendChild(quickPrompts);
  root.appendChild(inputRow);

  /* ---- fullscreen toggle (mobile-only — desktop stays inline) ---- */
  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches ||
           /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  }
  function enterFullscreen() {
    if (!isMobileViewport()) return;
    if (root.classList.contains('is-fullscreen')) return;
    root.classList.add('is-fullscreen');
    document.body.classList.add('chat-fs-open');
    setTimeout(scrollToBottom, 50);
  }
  function exitFullscreen() {
    root.classList.remove('is-fullscreen');
    document.body.classList.remove('chat-fs-open');
    input.blur();
  }
  input.addEventListener('focus', enterFullscreen);
  closeBtn.addEventListener('click', exitFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-fullscreen')) exitFullscreen();
  });

  /* ---- restore prior conversation (persists across SPA navigation,
     resets on real browser refresh because window state is fresh) ---- */
  if (Array.isArray(window.__heroChatHistory) && window.__heroChatHistory.length > 0) {
    for (const m of window.__heroChatHistory) {
      appendMessage(m.role, m.text, m.link, /*skipPersist*/ true);
    }
  } else {
    window.__heroChatHistory = [];
    appendMessage('ai', 'Hi! Ask me about our services, work, or how to get started.');
  }

  /* ---- behaviour ---- */
  let busy = false;

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function appendMessage(role, text, link, skipPersist) {
    if (!skipPersist) {
      if (!Array.isArray(window.__heroChatHistory)) window.__heroChatHistory = [];
      window.__heroChatHistory.push({ role, text, link: link || null });
      // Cap history at 100 messages so memory doesn't grow unbounded
      if (window.__heroChatHistory.length > 100) {
        window.__heroChatHistory.splice(0, window.__heroChatHistory.length - 100);
      }
    }
    const bubble = el('div', { class: `chat-message ${role}` });
    bubble.appendChild(el('div', { class: 'chat-bubble-text', text: text }));

    if (link && link.url) {
      const linkBtn = el('a', {
        class: 'chat-link-btn',
        href: link.url,
        target: link.url.startsWith('http') ? '_blank' : '_self',
        rel: 'noopener'
      });
      const label = link.label || `Visit ${link.url}`;
      linkBtn.appendChild(document.createTextNode(label + ' '));
      const arrow = el('span', { class: 'chat-link-arrow', html: ARROW_ICON_SVG });
      linkBtn.appendChild(arrow);
      bubble.appendChild(linkBtn);
    }

    messages.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function showTyping() {
    const wrap = el('div', { class: 'chat-message ai chat-typing-wrap' });
    const dots = el('div', { class: 'chat-typing', 'aria-label': 'Assistant is typing' }, [
      el('span'),
      el('span'),
      el('span')
    ]);
    wrap.appendChild(dots);
    messages.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    input.disabled = b;
    sendBtn.classList.toggle('is-busy', b);
  }

  function normalizeLink(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const url = raw.trim();
      if (!url) return null;
      const label = url.startsWith('http')
        ? `Visit ${new URL(url, window.location.origin).pathname || url}`
        : `Visit ${url}`;
      return { url, label };
    }
    if (typeof raw === 'object' && raw.url) {
      return { url: raw.url, label: raw.label || `Visit ${raw.url}` };
    }
    return null;
  }

  async function send() {
    if (busy) return;
    const query = input.value.trim();
    if (!query) return;
    if (query.length > MAX_INPUT) return;

    appendMessage('user', query);
    input.value = '';
    setBusy(true);

    const typing = showTyping();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      typing.remove();

      const answer =
        (data && (data.answer || data.message)) ||
        'I could not generate a response. Please try again.';
      const link = normalizeLink(data && data.link);
      appendMessage('ai', answer, link);
    } catch (err) {
      typing.remove();
      appendMessage('ai', 'Sorry, something went wrong. Please try again.');
      // eslint-disable-next-line no-console
      console.error('[hero-ai-chat]', err);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  input.addEventListener('input', () => {
    if (input.value.length > MAX_INPUT) {
      input.value = input.value.slice(0, MAX_INPUT);
    }
  });
}

/* ---------- auto-init ---------- */

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroAiChat, { once: true });
  } else {
    initHeroAiChat();
  }
}

export default initHeroAiChat;
