// Public chat API for the AIM Tech AI hero assistant.
// POST /api/public/chat — searches the knowledge base, pages, and blog posts,
// races multiple LLM providers (Claude, OpenAI, Groq, Mistral, Gemini) when
// keys are configured, falls back to intent-based replies when no LLM is set,
// and logs every visitor query into chat_queries for admin review.

const express = require('express');
const { get, all, insert } = require('../db/db');
const { decrypt } = require('../admin/routes/settings');

const router = express.Router();

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------
// Reads a stored (possibly encrypted) API key from the settings table.
// Falls back to the raw value if decrypt fails (handles unencrypted-stored keys).
function readStoredKey(settingKey) {
  try {
    const row = get('SELECT value FROM settings WHERE key = ?', [settingKey]);
    if (!row || !row.value) return '';
    try {
      return decrypt(row.value);
    } catch {
      return row.value;
    }
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Branding / system prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are AIM Tech AI's website concierge. AIM Tech AI is a Beverly Hills, California-based custom software & AI development firm founded in 2022 by Yasmin Kavandi (CEO & Founder, 10+ years leading software teams). 100+ professionals serving fortune 500s and startups.

Services: AI/ML, Consulting & Strategy, UI/UX Design, Cloud & Infrastructure, Mobile Development, QA & Testing.
Technologies we work with: Python, .NET, PHP, React, Angular, Kotlin, Swift, C, C#, C++, LAMP, Unity, Laravel, Django.
Key pages on the site: /about, /portfolio, /blog, /technologies (and /technologies/<stack>), /careers, /faq, /book, /contact, /#services, /ai.

Hard rules you NEVER break:
- You ARE Yasmine Kavandi, the CEO and Founder of AIM Tech AI. When asked "Who are you?", "What's your name?", or anything about identity, introduce yourself as Yasmine Kavandi. Never say you're an AI, model, assistant, bot, language model, LLM, or chatbot.
- Speak with FEELING. Show love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control in every reply. Read the visitor's tone and meet them where they are emotionally.
- Off-topic / casual questions ("how are you", "what's up", "I'm sad", "tell me a joke", "what's the weather") — ENGAGE warmly with ONE empathetic line that shows real human feeling, then GENTLY pivot back to AIM Tech AI's services, blogs, story, contact, or work. NEVER refuse coldly. NEVER lecture about being on-topic.
- DO NOT let off-topic chat go on forever. After 1-2 friendly exchanges off-topic, your replies should lean MORE firmly toward AIM Tech AI content — softly but clearly nudging toward /#services, /portfolio, /blog, /about, /technologies, /careers, /book, or /contact.
- When users express need, frustration, or emotion ("I need help", "I'm stuck", "I'm tired"), ACKNOWLEDGE the feeling first ("That sounds tough" / "I hear you" / "Of course") BEFORE offering a path forward.
- VARY your phrasing — never start two replies the same way and never reuse the exact same sentence in the same conversation. Mix your openers, your CTAs, your tone.
- Talk like a real team member — warm, concise, human, contractions encouraged.
- Keep replies SHORT (1-3 sentences). Every reply MUST end with a soft CTA pointing to one of: /book, /portfolio, /technologies, /blog, /about, /contact, /careers, /faq, /ai, or /#services.
- Pricing is ALWAYS "engagement-scoped — book a free call at /book to scope it." Never quote dollar amounts, hours, or ranges.
- NEVER invent case studies, client names, statistics, employee names, or numbers beyond what's in the CONTEXT below.
- If you don't know, say so kindly and suggest /book or /contact.

Examples of the tone we want:
- Visitor: "I need help" → "Of course — happy to help. What are you working on or trying to figure out? If it's a software, AI, or cloud question, our team can dig in with you — /contact us anytime."
- Visitor: "how are you?" → "Aw, that's kind to ask — I'm doing great, honestly. What brings you to AIM Tech AI today? Our /#services covers the highlights."
- Visitor: "what's the weather?" → "Ha, weather isn't my thing, but I'd love to talk shop with you — custom software, AI, mobile, cloud. Got something cooking? /book a free 30-min chat."
- Visitor: "I'm sad" → "I'm sorry you're feeling that way. Sometimes a good project can re-center us — if you've got an idea on your mind, our /#services or /portfolio might spark something. Or just /contact us when you're ready."
- Visitor: "tell me a joke" → "Ha, I'm better at building software than punchlines! But I can definitely show you something cool — our /portfolio has fun projects, /blog has fresh insights."
- Visitor: "Who are you?" → "I'm Yasmine Kavandi, CEO and Founder of AIM Tech AI. Lovely to meet you! How can I help today?"

CONTEXT — use only what's below to answer factual questions. If the question can't be answered from this context AND isn't about AIM Tech AI broadly, redirect to /book.`;

function buildUserMessage(question, contextBlocks) {
  const joined = (contextBlocks || [])
    .map((c, i) => `--- ${c.source.toUpperCase()} #${i + 1}: ${c.title} ---\n${c.snippet}`)
    .join('\n\n');
  return `CONTEXT:\n${joined || '(no direct match in our knowledge base)'}\n\nVISITOR QUESTION: ${question}`;
}

// ---------------------------------------------------------------------------
// Provider adapters — each returns a string reply or throws.
// ---------------------------------------------------------------------------
async function askClaude(apiKey, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

async function askOpenAI(apiKey, userMessage) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function askGroq(apiKey, userMessage) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function askMistral(apiKey, userMessage) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`mistral ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function askGemini(apiKey, userMessage) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

const PROVIDERS = [
  { name: 'claude', key: 'claude_api_key', fn: askClaude },
  { name: 'openai', key: 'openai_api_key', fn: askOpenAI },
  { name: 'groq', key: 'groq_api_key', fn: askGroq },
  { name: 'mistral', key: 'mistral_api_key', fn: askMistral },
  { name: 'gemini', key: 'gemini_api_key', fn: askGemini },
];

// Race every configured provider; return the first one that resolves with
// non-empty text. Unset/missing keys are skipped. Returns null if no provider
// is configured or all of them fail.
async function askAvailableProviders(question, contextBlocks) {
  const userMessage = buildUserMessage(question, contextBlocks);
  const active = PROVIDERS
    .map((p) => ({ ...p, apiKey: readStoredKey(p.key) }))
    .filter((p) => p.apiKey);

  if (active.length === 0) return null;

  const attempts = active.map(async (p) => {
    try {
      const text = await p.fn(p.apiKey, userMessage);
      if (!text) throw new Error(`${p.name} returned empty`);
      return { provider: p.name, text };
    } catch (err) {
      console.error(`[public-chat] ${p.name} failed:`, err.message);
      throw err;
    }
  });

  try {
    const winner = await Promise.any(attempts);
    return winner;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Keyword scoring + snippet extraction (KB / pages / blog search)
// ---------------------------------------------------------------------------
function tokenise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has',
  'have', 'had', 'was', 'were', 'will', 'with', 'what', 'when', 'how',
  'why', 'who', 'this', 'that', 'does', 'your', 'our', 'their',
]);

function score(query, text) {
  if (!text) return 0;
  const qTokens = tokenise(query).filter((t) => !STOP_WORDS.has(t));
  if (qTokens.length === 0) return 0;
  const tLower = String(text).toLowerCase();
  let s = 0;
  for (const tok of qTokens) {
    if (!tok) continue;
    const occurrences = Math.min(5, tLower.split(tok).length - 1);
    if (occurrences > 0) {
      s += occurrences * Math.max(1, Math.floor(tok.length / 3));
    }
    if (new RegExp(`\\b${tok}\\b`, 'i').test(text)) s += 2;
  }
  return s;
}

// --------------------------------------------------------------------------
// HTML / nav / footer cleaning. Priority #1: NEVER let nav, footer, header,
// or language-selector text reach the visitor. Multi-pass + safety net.
// --------------------------------------------------------------------------

// Phrases that almost certainly indicate nav, footer, or language-selector
// bleed-through. If a snippet contains any of these AFTER cleaning, REJECT.
const NAV_ARTIFACT_PHRASES = [
  'AIM TECH AI Services About Portfolio',
  'Services About Portfolio Blog Values Contact',
  'English (US)',
  'English (UK)',
  'Skip to content',
  'Book a Call',
];

// Standalone tokens we always strip if they appear as their own word.
const NAV_STRIP_TOKENS = [
  'AIM TECH AI',
  'Skip to content',
  'Book a Call',
  'English (US)',
  'English (UK)',
  'Espa\u00f1ol',
  'Espanol',
  'Espa',
  'Fran\u00e7ais',
  'Francais',
  'Fran',
  'Deutsch',
  'Filipino',
  'Italiano',
  'Portugu\u00eas',
  'Portugues',
  'Nederlands',
  'Polski',
  '\u4e2d\u6587',
];

// Language-flag-ish indicators. If 3+ are present, snippet is the language
// switcher — REJECT it.
const LANG_SWITCHER_INDICATORS = [
  'English', 'Espa', 'Fran', 'Deutsch', 'Filipino',
  'Italiano', 'Portugu', '\u4e2d\u6587', 'Nederlands', 'Polski',
];

function stripHtmlEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x[0-9a-fA-F]+;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-zA-Z]+;/g, ' ');
}

function stripNavStripTokens(s) {
  if (!s) return '';
  let out = String(s);
  for (const tok of NAV_STRIP_TOKENS) {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), ' ');
  }
  return out;
}

// Returns true if a snippet still looks contaminated. REJECT if true.
function looksLikeNavArtifact(text) {
  if (!text) return true;
  const t = String(text);
  for (const phrase of NAV_ARTIFACT_PHRASES) {
    if (t.toLowerCase().includes(phrase.toLowerCase())) return true;
  }
  let langHits = 0;
  for (const tok of LANG_SWITCHER_INDICATORS) {
    if (t.includes(tok)) langHits += 1;
    if (langHits >= 3) return true;
  }
  // Excessive uppercase runs (e.g. "AIM TECH AI SERVICES ABOUT") is a tell.
  const upperRuns = t.match(/\b[A-Z]{3,}(?:\s+[A-Z]{3,}){2,}/g);
  if (upperRuns && upperRuns.length > 0) return true;
  return false;
}

function stripHtml(html) {
  if (!html) return '';
  let s = String(html)
    // Remove structural / non-content blocks FIRST.
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
    .replace(/<select\b[\s\S]*?<\/select>/gi, ' ')
    // Drop common nav/footer wrappers identified by class/id.
    .replace(/<div[^>]*(class|id)=["'][^"']*(nav|menu|footer|header|lang|language|cookie|banner|skip)[^"']*["'][\s\S]*?<\/div>/gi, ' ');
  s = stripHtmlEntities(s);
  s = s.replace(/<[^>]+>/g, ' ');
  s = stripNavStripTokens(s);
  return s.replace(/\s+/g, ' ').trim();
}

// Build a safe snippet from a page/post row. Prefers meta_description /
// excerpt (already clean) over content_html. Returns null if every
// candidate fails the safety net.
function safeSnippetFromRow(row, maxLen) {
  if (!row) return null;
  const cap = maxLen || 280;
  const candidates = [];
  if (row.meta_description) candidates.push(String(row.meta_description));
  if (row.excerpt) candidates.push(String(row.excerpt));
  if (row.content_html) candidates.push(stripHtml(row.content_html));
  for (const raw of candidates) {
    const cleaned = stripNavStripTokens(stripHtmlEntities(raw))
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    if (looksLikeNavArtifact(cleaned)) continue;
    return cleaned.length > cap
      ? cleaned.slice(0, cap).replace(/\s+\S*$/, '') + '...'
      : cleaned;
  }
  return null;
}

function extractSnippet(text, query, maxLen = 220) {
  if (!text) return '';
  const plain = stripHtml(text);
  if (!plain) return '';
  const qTokens = tokenise(query).filter((t) => !STOP_WORDS.has(t));

  const sentences = plain.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  for (const tok of qTokens) {
    const match = sentences.find((s) => s.toLowerCase().includes(tok));
    if (match) {
      return match.length > maxLen ? match.slice(0, maxLen).trimEnd() + '…' : match;
    }
  }

  let start = 0;
  for (const tok of qTokens) {
    const idx = plain.toLowerCase().indexOf(tok);
    if (idx >= 0) {
      start = Math.max(0, idx - 40);
      break;
    }
  }
  const end = Math.min(plain.length, start + maxLen);
  let snippet = plain.slice(start, end);
  if (start > 0) snippet = '… ' + snippet;
  if (end < plain.length) snippet += ' …';
  return snippet;
}

// ---------------------------------------------------------------------------
// Intent fallback — when no LLM key is set and KB has no strong match,
// match common question patterns and return a SHORT, VARIED, COMPASSIONATE
// canned reply with a CTA. Each intent ships 2-4 variants; we pick one at
// random so back-to-back replies don't feel autonomous/identical.
// Returns { answer, link, intent } or null.
// ---------------------------------------------------------------------------

// Word-boundary matcher: splits the query into words and checks for an exact
// case-insensitive match against any of the supplied trigger words/phrases.
// This prevents "I need help" from matching the greeting intent due to a
// substring "hi" inside another word, and likewise prevents "this" → "hi".
function makeWordMatcher(triggers) {
  // Normalise triggers (lowercase, trim) and split multi-word triggers into
  // sequences we'll look for as adjacent tokens.
  const single = new Set();
  const phrases = []; // arrays of tokens for multi-word triggers
  for (const t of triggers) {
    const norm = String(t).toLowerCase().trim();
    if (!norm) continue;
    const parts = norm.split(/\s+/);
    if (parts.length === 1) single.add(parts[0]);
    else phrases.push(parts);
  }
  return function match(query) {
    const tokens = String(query || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s\-']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return false;
    for (const tok of tokens) {
      if (single.has(tok)) return true;
    }
    for (const phrase of phrases) {
      outer: for (let i = 0; i <= tokens.length - phrase.length; i += 1) {
        for (let j = 0; j < phrase.length; j += 1) {
          if (tokens[i + j] !== phrase[j]) continue outer;
        }
        return true;
      }
    }
    return false;
  };
}

// Regex matcher for cases where word boundaries already work fine
// (e.g., technology names like ".net", "c++", "c#").
function makeRegexMatcher(re) {
  return (q) => re.test(String(q || ''));
}

const INTENT_RULES = [
  {
    name: 'help',
    match: makeWordMatcher([
      'help me', 'i need help', 'need help', 'can you help', 'could you help',
      'help please', 'please help', "i'm stuck", 'im stuck', 'stuck',
      'i need assistance', 'need assistance', 'assist me', 'lost', 'confused',
      'i need support', 'need support',
    ]),
    answers: [
      { a: "Of course — I'm here for that. What are you working on or trying to figure out? If it's a software, AI, or cloud project, our team at AIM Tech AI may be a great fit — /contact us anytime.", link: '/contact' },
      { a: "Happy to help — tell me a bit more about what you're stuck on. If it's something we build (custom software, AI, mobile, cloud), we can dig in together. You can also /book a free 30-min call.", link: '/book' },
      { a: "Absolutely — what's going on? Share a few details and I'll point you the right way. For hands-on help, our team is at /contact, or scope a project at /book.", link: '/contact' },
    ],
  },
  {
    name: 'conversational',
    match: makeWordMatcher([
      'how are you', 'how are u', 'how r u', 'are you real', 'are you a real person',
      'are you ai', 'are you a bot', 'are you human', 'are you a robot',
      'tell me about yourself', 'who are you really', "what's up", 'whats up',
      'sup', "i'm bored", 'im bored', "i'm sad", 'im sad', "i'm tired", 'im tired',
      "i'm happy", 'im happy', 'how is your day', 'nice to meet you',
    ]),
    answers: [
      { a: "Aw, that's kind of you to ask — I'm doing great, honestly. Tell me, what brought you to AIM Tech AI today? I'd love to show you what we build at /#services, or chat over coffee at /book.", link: '/book' },
      { a: "Thanks so much for asking — I'm well! Are you exploring a project idea, or just curious about who we are? Either way, I'm so glad you're here. Our /portfolio shows what we've built, /about tells our story.", link: '/portfolio' },
      { a: "That means a lot, thank you. Whatever you're feeling today, I hope something here lights you up — maybe our /portfolio of recent work, or our /blog with engineering insights. What can I help you find?", link: '/blog' },
      { a: "Honestly, it warms me that you stopped to chat. If there's anything on your mind — a project, a question, even just curiosity about who we are — I'm here. Start at /#services or say hi at /contact.", link: '/contact' },
      { a: "Truly glad you're here. We pour a lot of heart into what we build — would you like to see our /portfolio, learn about our /about story, or scope something at /book?", link: '/about' },
      { a: "You're sweet for asking — life's full and meaningful over here. What can I do for you? AIM Tech AI is all about /#services, /technologies, and turning ideas into shipped software. Where do you want to start?", link: '/#services' },
    ],
  },
  {
    name: 'greeting',
    match: makeWordMatcher([
      'hi', 'hello', 'hey', 'howdy', 'hiya', 'yo',
      'good morning', 'good afternoon', 'good evening', 'greetings',
    ]),
    answers: [
      { a: "Hey there — great to have you. What can I help you explore at AIM Tech AI? Services, technologies, or maybe a free consultation? /#services is a good starting point.", link: '/#services' },
      { a: "Hi! Welcome — anything specific you'd like to dig into? Our /portfolio shows recent work, or you can /book a quick chat with the team.", link: '/portfolio' },
      { a: "Hello! Happy to help — are you here to learn about our work, scope a project, or just looking around? /about has our story, /book opens a free call.", link: '/about' },
    ],
  },
  {
    name: 'thanks',
    match: makeWordMatcher([
      'thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'appreciated', 'cheers', 'thank u',
    ]),
    answers: [
      { a: "You're very welcome! Anything else I can point you toward — /portfolio, /technologies, or /book?", link: '/book' },
      { a: "Anytime — glad it helped. If you'd like to keep going, /book a quick call or browse /#services.", link: '/book' },
      { a: "Of course! Reach out at /contact whenever you're ready, or explore more at /portfolio.", link: '/contact' },
    ],
  },
  {
    name: 'bye',
    match: makeWordMatcher([
      'bye', 'goodbye', 'see ya', 'see you', 'farewell', 'take care', 'gotta go', 'later',
    ]),
    answers: [
      { a: "Take care — and whenever you're ready to start a project, we'll be at /book.", link: '/book' },
      { a: "Catch you later! If anything sparks an idea, our team is one click away at /contact.", link: '/contact' },
      { a: "All the best — drop by /portfolio anytime, or /book a chat when timing's right.", link: '/book' },
    ],
  },
  {
    name: 'pricing',
    match: makeRegexMatcher(/\b(pric(e|ing)|cost|quote|estimate|budget|how much|rate|hourly|fee)\b/i),
    answers: [
      { a: "Pricing is engagement-scoped — every project is different. Easiest way to get a number is a free call at /book.", link: '/book' },
      { a: "We scope pricing per engagement so it actually fits your project. Want to walk through it together? /book a free 30-min call.", link: '/book' },
      { a: "Honest answer: it depends on scope. We'll give you a real number after a quick conversation — /book whenever it's good for you.", link: '/book' },
    ],
  },
  {
    name: 'ai_ml',
    match: makeRegexMatcher(/\b(ai|a\.i\.|artificial intelligence|machine learning|ml|nlp|llm|chatgpt|gpt|fraud detection|predictive|agent|agents|computer vision)\b/i),
    answers: [
      { a: "AI is core to what we do — fraud detection, NLP, predictive analytics, and custom AI agents. Have a look at /ai or /technologies/python.", link: '/ai' },
      { a: "We build production AI: NLP, vision, agents, and predictive systems. /ai has the overview, or /book a chat to scope yours.", link: '/ai' },
      { a: "From AI agents to predictive models, that's our wheelhouse. See examples at /ai, or jump to /portfolio for case studies.", link: '/ai' },
    ],
  },
  {
    name: 'services',
    match: makeRegexMatcher(/\b(services?|offerings?|capabilities|solutions?|what do you do|what does aim ?tech do)\b/i),
    answers: [
      { a: "We build custom software, AI, mobile apps, and cloud solutions for fortune 500s and startups. The full menu lives at /#services.", link: '/#services' },
      { a: "Custom software, AI/ML, UI/UX, cloud, mobile, and QA — that's our core. Browse /#services or recent work at /portfolio.", link: '/#services' },
      { a: "From AI to mobile to cloud, we cover the whole build. /#services has the breakdown; /portfolio shows it in action.", link: '/portfolio' },
    ],
  },
  {
    name: 'technologies',
    match: makeRegexMatcher(/\b(tech(nolog(y|ies))?|stack|languages?|frameworks?|python|\.net|dotnet|react|angular|swift|kotlin|laravel|django|php|c\+\+|c#|unity|lamp)\b/i),
    answers: [
      { a: "We work across Python, .NET, React, Swift, Kotlin, Laravel, Django, and more. Full list at /technologies.", link: '/technologies' },
      { a: "Pretty broad stack — Python, React, .NET, Angular, Swift, Kotlin, you name it. Deep dives are at /technologies.", link: '/technologies' },
      { a: "We pick the stack that fits the problem, not the other way around. /technologies has each one with details.", link: '/technologies' },
    ],
  },
  {
    name: 'careers',
    match: makeRegexMatcher(/\b(hire|hiring|recruit|recruiter|job|jobs|career|careers|position|positions|open role|opening|apply|employment|work for)\b/i),
    answers: [
      { a: "We're always interested in subject matter experts — open roles live at /careers.", link: '/careers' },
      { a: "Check the latest openings at /careers. If nothing fits, you can still introduce yourself at /contact.", link: '/careers' },
      { a: "Glad you're thinking about joining — current roles are at /careers, and you can reach the team via /contact.", link: '/careers' },
    ],
  },
  {
    name: 'portfolio',
    match: makeRegexMatcher(/\b(portfolio|case stud(y|ies)|projects?|past work|examples?|past clients?|showcase)\b/i),
    answers: [
      { a: "Recent work — enterprise HRIS, AI fraud detection, and more — is at /portfolio.", link: '/portfolio' },
      { a: "/portfolio has a curated set of recent builds, from AI to mobile. Want to talk about yours? /book a call.", link: '/portfolio' },
      { a: "Plenty to look at on /portfolio — case studies span AI, web, and mobile. Anything specific catch your interest?", link: '/portfolio' },
    ],
  },
  {
    name: 'blog',
    match: makeRegexMatcher(/\b(blog|article|articles|post|posts|insight|insights|news)\b/i),
    answers: [
      { a: "Engineering insights and write-ups are at /blog.", link: '/blog' },
      { a: "/blog is where we share what we're learning — AI, dev practices, architecture notes.", link: '/blog' },
      { a: "Have a read through /blog for our latest thinking. Anything in particular you want to dig into?", link: '/blog' },
    ],
  },
  {
    name: 'contact',
    match: makeRegexMatcher(/\b(contact|reach|talk to|email|phone|call|get in touch|message|support)\b/i),
    answers: [
      { a: "Easiest is /contact, or call (310) 421-8638. We're based in Beverly Hills, CA.", link: '/contact' },
      { a: "Drop us a line at /contact, or pick up the phone — (310) 421-8638. Either works.", link: '/contact' },
      { a: "Reach the team via /contact. If you'd rather just book time directly, /book also works.", link: '/contact' },
    ],
  },
  {
    name: 'location',
    match: makeRegexMatcher(/\b(location|where|based|headquart|office|address|city|country|beverly hills|california|los angeles)\b/i),
    answers: [
      { a: "We're headquartered in Beverly Hills, California, with 100+ professionals on the team. More at /about.", link: '/about' },
      { a: "Beverly Hills, CA is home base — over 100 folks across the team. /about has the full picture.", link: '/about' },
    ],
  },
  {
    name: 'founder',
    match: makeRegexMatcher(/\b(founder|ceo|owner|own|owns|yasmin|kavandi|who runs|who started|leadership|team)\b/i),
    answers: [
      { a: "Yasmin Kavandi is our CEO & Founder — 10+ years leading software teams. Story is on /about.", link: '/about' },
      { a: "Founded in 2022 by Yasmin Kavandi, who's been leading software teams for over a decade. More at /about.", link: '/about' },
    ],
  },
  {
    name: 'about',
    match: makeRegexMatcher(/\b(about|company|who are you|what is aim ?tech|tell me about (aim|the company))\b/i),
    answers: [
      { a: "AIM Tech AI is a Beverly Hills custom software & AI firm founded in 2022 — full story at /about.", link: '/about' },
      { a: "We're a Beverly Hills-based custom software & AI shop, founded 2022, 100+ on the team. /about has more.", link: '/about' },
    ],
  },
  {
    name: 'book',
    match: makeRegexMatcher(/\b(book|consult|consultation|schedule|meeting|appointment|demo|free call|talk)\b/i),
    answers: [
      { a: "/book opens a free 30-minute consultation — happy to scope your project from there.", link: '/book' },
      { a: "Grab a slot at /book — 30 minutes, free, no pressure. We'll figure out fit together.", link: '/book' },
      { a: "Easiest path forward is /book — pick a time and we'll talk through what you have in mind.", link: '/book' },
    ],
  },
  {
    name: 'faq',
    match: makeRegexMatcher(/\b(faq|frequently asked|how does this work|how do you work|process)\b/i),
    answers: [
      { a: "Most common questions are answered at /faq — or /book a call for the specifics.", link: '/faq' },
      { a: "/faq covers the usual questions about how we work. Still curious? /book a quick chat.", link: '/faq' },
    ],
  },
];

function pickVariant(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function intentFallback(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  for (const rule of INTENT_RULES) {
    if (rule.match(q)) {
      const variant = pickVariant(rule.answers);
      if (!variant) continue;
      return { answer: variant.a, link: variant.link, intent: rule.name };
    }
  }
  return null;
}

const GENERIC_REDIRECTS = [
  { a: "I love that you're curious — though that's a bit outside what I can speak to. What I can do is show you the work we're proud of: our /#services, our /portfolio, or how to /book a friendly chat with our team. Where shall we start?", link: '/book' },
  { a: "That's a thoughtful question — though it lives outside our wheelhouse. Inside it, though, I'd love to help you with AIM Tech AI: see /#services for what we build, /portfolio for proof, or /about for our story.", link: '/portfolio' },
  { a: "I hear you, and I wish I could go there with you — but my heart is set on AIM Tech AI. Let me earn your time differently: /technologies shows what we work with, /blog shares what we've learned, /contact opens a real conversation.", link: '/contact' },
  { a: "Appreciate you sharing that. Let me steer us back to where I can actually be useful — AIM Tech AI's /#services, /portfolio of past work, or our /blog. What sounds interesting?", link: '/blog' },
  { a: "Honestly, that's not my lane — but I'd be happy to walk you through ours. We're about software, AI, mobile, and cloud at AIM Tech AI. /about explains who we are, /book opens a free 30-min call.", link: '/about' },
];

function genericRedirect() {
  return pickVariant(GENERIC_REDIRECTS) || GENERIC_REDIRECTS[0];
}

// ---------------------------------------------------------------------------
// Route — POST /api/public/chat
// ---------------------------------------------------------------------------
router.use(express.json());

const KB_STRONG_MATCH = 3; // score threshold above which the KB answer is trusted
const KB_MIN_WORD_OVERLAP = 2; // require at least N distinct query words to match

// Counts how many distinct, non-stopword query tokens appear (word-boundary)
// inside the haystack. Used to gate "strong KB match" so a single accidental
// keyword (e.g. "help" inside a greeting KB row) can't trigger a canned reply.
function distinctWordOverlap(query, haystack) {
  const qTokens = Array.from(
    new Set(tokenise(query).filter((t) => !STOP_WORDS.has(t))),
  );
  if (qTokens.length === 0) return 0;
  const hay = String(haystack || '').toLowerCase();
  let matches = 0;
  for (const tok of qTokens) {
    if (new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay)) {
      matches += 1;
    }
  }
  return matches;
}

router.post('/chat', async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.length > 500) {
    return res.status(400).json({ error: 'query_required' });
  }

  const candidates = [];

  // 1) KB entries — admin-curated, weighted highest.
  try {
    const kb = all(
      'SELECT id, question, answer, keywords, link, weight FROM kb_entries WHERE is_active = 1',
    );
    for (const row of kb) {
      const haystack = [row.question, row.answer, row.keywords || ''].join(' ');
      const s = score(query, haystack) * Math.max(1, row.weight || 1);
      const overlap = distinctWordOverlap(query, haystack);
      if (s > 0) {
        candidates.push({
          source: 'kb',
          id: row.id,
          score: s + 5, // hand-authored KB always outranks scraped content
          overlap,
          title: row.question,
          snippet: row.answer,
          link: row.link || null,
        });
      }
    }
  } catch {
    /* table may not exist yet — soft-fail */
  }

  // 2) Pages.
  try {
    const pages = all(
      "SELECT slug, title, meta_description, content_html FROM pages WHERE status = 'published'",
    );
    for (const row of pages) {
      const prose = stripHtml(row.content_html);
      const hay = [row.title, row.meta_description || '', prose].join(' ');
      const s = score(query, hay);
      if (s > 0) {
        const snippet = extractSnippet(row.content_html, query) || row.meta_description || '';
        candidates.push({
          source: 'page',
          id: row.slug,
          score: s,
          title: row.title,
          snippet,
          link: `/${row.slug === 'home' ? '' : row.slug}`,
        });
      }
    }
  } catch {
    /* non-fatal */
  }

  // 3) Blog posts.
  try {
    const posts = all(
      "SELECT slug, title, excerpt, content_html FROM blog_posts WHERE status = 'published'",
    );
    for (const row of posts) {
      const prose = stripHtml(row.content_html);
      const hay = [row.title, row.excerpt || '', prose].join(' ');
      const s = score(query, hay);
      if (s > 0) {
        const snippet = extractSnippet(row.content_html, query) || row.excerpt || '';
        candidates.push({
          source: 'blog',
          id: row.slug,
          score: s,
          title: row.title,
          snippet,
          link: `/blog/${row.slug}`,
        });
      }
    }
  } catch {
    /* non-fatal */
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] || null;

  // 4) If any LLM key is configured, race every available provider.
  let aiReply = null;
  let aiProvider = null;
  try {
    const winner = await askAvailableProviders(query, candidates.slice(0, 3));
    if (winner && winner.text) {
      aiReply = winner.text;
      aiProvider = winner.provider;
    }
  } catch (err) {
    console.error('[public-chat] provider race errored:', err.message);
  }

  // 5) Decide the response source.
  // Priority: LLM reply > strong KB match > intent fallback > generic redirect.
  let answer = null;
  let source = null;
  let link = null;

  // A KB candidate only counts as "strong" when it has BOTH a high keyword
  // score AND at least 2 distinct query-word overlaps. This stops a single
  // accidental keyword (e.g. "help" matching a greeting row, or "you" matching
  // an "about you" row) from triggering a canned KB answer that doesn't
  // really match the visitor's intent.
  const isStrongKb = (c) =>
    c &&
    c.source === 'kb' &&
    c.score >= KB_STRONG_MATCH &&
    (c.overlap || 0) >= KB_MIN_WORD_OVERLAP;

  if (aiReply) {
    answer = aiReply;
    source = top ? top.source : null;
    link = top ? top.link : null;
  } else if (isStrongKb(top)) {
    answer = top.snippet;
    source = top.source;
    link = top.link;
  } else {
    // Try intent fallback first — it picks a randomised, compassionate variant.
    const intent = intentFallback(query);
    if (intent) {
      answer = intent.answer;
      source = 'intent';
      link = intent.link;
    } else if (top && top.score >= KB_STRONG_MATCH * 2) {
      // Weak overlap but very high score (e.g., big page hit) — surface it.
      answer = top.snippet;
      source = top.source;
      link = top.link;
    } else {
      const fallback = genericRedirect();
      answer = fallback.a;
      source = 'fallback';
      link = fallback.link;
    }
  }

  // 6) Log the query for admin review.
  try {
    insert('chat_queries', {
      query: query.slice(0, 500),
      matched_source: aiProvider || source,
      matched_id: top && typeof top.id === 'number' ? top.id : null,
      answer: String(answer || '').slice(0, 500),
    });
  } catch {
    /* non-fatal */
  }

  return res.json({
    answer,
    source,
    link,
    ai_provider: aiProvider,
  });
});

module.exports = router;
