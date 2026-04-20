const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');
const { decrypt } = require('./settings');
const { dispatchNotification } = require('../services/notify');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: HTML-escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Trigger badge helper
// ---------------------------------------------------------------------------
function triggerBadge(type) {
  const colors = { manual: '#888', scheduled: '#14b8a6', on_event: '#eab308' };
  const labels = { manual: 'Manual', scheduled: 'Scheduled', on_event: 'On Event' };
  const c = colors[type] || '#888';
  const l = labels[type] || esc(type);
  return `<span style="padding:.2rem .6rem;border-radius:4px;font-size:.8rem;font-weight:500;background:${c}22;color:${c}">${l}</span>`;
}

function statusBadge(status) {
  const map = { running: '#3b82f6', completed: '#22c55e', failed: '#ef4444' };
  const c = map[status] || '#888';
  return `<span style="padding:.2rem .6rem;border-radius:4px;font-size:.8rem;font-weight:500;background:${c}22;color:${c}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------------------
// GET / — Agent list page
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  const agents = await all(`SELECT * FROM agents ORDER BY created_at DESC`);

  const today = new Date().toISOString().slice(0, 10);

  const rows = (await Promise.all(agents.map(async a => {
    const lastRun = await get(`SELECT started_at FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 1`, [a.id]);
    const runsToday = (await get(`SELECT COUNT(*) AS c FROM agent_runs WHERE agent_id = ? AND started_at >= ?`, [a.id, today]) || {}).c || 0;
    const desc = (a.description || '').length > 60 ? a.description.slice(0, 60) + '...' : (a.description || '');
    return `
    <tr onclick="location.href='/admin/agents/${a.id}'" style="cursor:pointer">
      <td style="font-weight:500">${esc(a.name)}</td>
      <td style="color:var(--muted)">${esc(desc)}</td>
      <td>${triggerBadge(a.trigger_type)}</td>
      <td>
        <label class="toggle-switch" onclick="event.stopPropagation()">
          <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="toggleAgent(${a.id}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>${lastRun ? esc(lastRun.started_at) : '<span style="color:var(--muted)">Never</span>'}</td>
      <td>${runsToday}</td>
    </tr>`;
  }))).join('');

  const content = `
    <style>
      .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
      .toggle-switch input { opacity:0; width:0; height:0; }
      .toggle-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
        background:#444; border-radius:24px; transition:.2s; }
      .toggle-slider:before { content:''; position:absolute; height:18px; width:18px;
        left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; }
      .toggle-switch input:checked + .toggle-slider { background:var(--accent, #14b8a6); }
      .toggle-switch input:checked + .toggle-slider:before { transform:translateX(20px); }
      .agents-table { width:100%; border-collapse:collapse; }
      .agents-table th, .agents-table td { padding:.75rem 1rem; text-align:left; border-bottom:1px solid var(--border, #333); }
      .agents-table tr:hover { background:var(--surface-hover, rgba(255,255,255,.04)); }
      .agents-table th { color:var(--muted, #888); font-weight:500; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
    </style>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h3>AI Agents</h3>
        <a href="/admin/agents/new" class="btn btn-primary">New Agent</a>
      </div>
      ${agents.length === 0
        ? '<p style="color:var(--muted);padding:2rem 0;text-align:center">No agents yet. Create your first AI agent.</p>'
        : `<div class="table-wrap">
        <table class="agents-table">
          <thead>
            <tr>
              <th>Name</th><th>Description</th><th>Trigger</th><th>Active</th><th>Last Run</th><th>Runs Today</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`}
    </div>

    <script>
    function toggleAgent(id, active) {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;
      fetch('/api/admin/agents/api/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ is_active: active ? 1 : 0, _csrf: csrf })
      });
    }
    </script>
  `;

  res.send(adminLayout({ title: 'Agents', page: 'agents', user: req.user, csrfToken: req.csrfToken, unreadCount, content }));
});

// ---------------------------------------------------------------------------
// GET /new — New agent form
// ---------------------------------------------------------------------------
router.get('/new', requireAuth, async (req, res) => {
  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  res.send(adminLayout({
    title: 'New Agent',
    page: 'agents',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content: await agentFormHtml(null, req.csrfToken)
  }));
});

// ---------------------------------------------------------------------------
// GET /:id — Edit agent form + run history
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  if (['api', 'new'].includes(req.params.id)) return;

  const agent = await get(`SELECT * FROM agents WHERE id = ?`, [req.params.id]);
  if (!agent) return res.status(404).send('Agent not found');

  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  const runs = await all(`SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 20`, [agent.id]);

  const runRows = runs.map(r => {
    const duration = r.completed_at && r.started_at
      ? ((new Date(r.completed_at) - new Date(r.started_at)) / 1000).toFixed(1) + 's'
      : '-';
    return `
    <tr>
      <td>${statusBadge(r.status)}</td>
      <td>${esc(r.started_at)}</td>
      <td>${duration}</td>
      <td>${r.tokens_used || '-'}</td>
    </tr>`;
  }).join('');

  const runHistory = runs.length > 0 ? `
    <div class="card" style="margin-top:1.5rem">
      <h3 style="margin-bottom:1rem">Run History</h3>
      <div class="table-wrap">
        <table class="agents-table">
          <thead>
            <tr><th>Status</th><th>Started</th><th>Duration</th><th>Tokens</th></tr>
          </thead>
          <tbody>${runRows}</tbody>
        </table>
      </div>
    </div>
  ` : `
    <div class="card" style="margin-top:1.5rem">
      <h3 style="margin-bottom:1rem">Run History</h3>
      <p style="color:var(--muted);text-align:center;padding:1rem 0">No runs yet. Use "Test Run" to execute this agent.</p>
    </div>
  `;

  res.send(adminLayout({
    title: 'Edit Agent',
    page: 'agents',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content: (await agentFormHtml(agent, req.csrfToken)) + runHistory
  }));
});

// ---------------------------------------------------------------------------
// Agent form HTML builder
// ---------------------------------------------------------------------------
async function agentFormHtml(agent, csrfToken) {
  const isEdit = !!agent;
  const a = agent || { name: '', description: '', system_prompt: '', trigger_type: 'manual', trigger_config: '', is_active: 1, provider: 'claude', model: '' };
  const gs = async (k) => { const r = await get('SELECT value FROM settings WHERE key = ?', [k]); return !!(r && r.value); };
  const availableProviders = [
    { id: 'claude', label: 'Anthropic (Claude)', hasKey: await gs('claude_api_key'), models: [
      { v: 'claude-sonnet-4-20250514', l: 'Claude Sonnet 4' },
      { v: 'claude-opus-4-20250514', l: 'Claude Opus 4' },
      { v: 'claude-haiku-4-20250506', l: 'Claude Haiku 4' },
    ]},
    { id: 'openai', label: 'OpenAI (GPT)', hasKey: await gs('openai_api_key'), models: [
      { v: 'gpt-4o', l: 'GPT-4o' },
      { v: 'gpt-4o-mini', l: 'GPT-4o Mini' },
      { v: 'gpt-4.1', l: 'GPT-4.1' },
      { v: 'o3-mini', l: 'o3-mini' },
    ]},
    { id: 'google', label: 'Google (Gemini)', hasKey: await gs('google_api_key'), models: [
      { v: 'gemini-2.5-flash', l: 'Gemini 2.5 Flash' },
      { v: 'gemini-2.5-pro', l: 'Gemini 2.5 Pro' },
    ]},
    { id: 'mistral', label: 'Mistral AI', hasKey: await gs('mistral_api_key'), models: [
      { v: 'mistral-large-latest', l: 'Mistral Large' },
      { v: 'mistral-small-latest', l: 'Mistral Small' },
    ]},
    { id: 'groq', label: 'Groq', hasKey: await gs('groq_api_key'), models: [
      { v: 'llama-3.3-70b-versatile', l: 'Llama 3.3 70B' },
      { v: 'mixtral-8x7b-32768', l: 'Mixtral 8x7B' },
    ]},
    { id: 'perplexity', label: 'Perplexity', hasKey: await gs('perplexity_api_key'), models: [
      { v: 'sonar-pro', l: 'Sonar Pro' },
      { v: 'sonar', l: 'Sonar' },
    ]},
    { id: 'deepseek', label: 'DeepSeek', hasKey: await gs('deepseek_api_key'), models: [
      { v: 'deepseek-chat', l: 'DeepSeek Chat' },
      { v: 'deepseek-reasoner', l: 'DeepSeek Reasoner' },
    ]},
  ];
  const providerModelsJson = JSON.stringify(availableProviders.map(p => ({ id: p.id, models: p.models })));
  const maxTokensRow = await get(`SELECT value FROM settings WHERE key = 'agent_max_tokens'`);
  const defaultMaxTokens = (maxTokensRow && maxTokensRow.value) || '4096';

  return `
    <style>
      .agent-form .form-group { margin-bottom:1.25rem; }
      .agent-form label { display:block; margin-bottom:.4rem; font-weight:500; color:var(--text-secondary, #ccc); font-size:.9rem; }
      .agent-form .form-input { width:100%; padding:.6rem .8rem; background:var(--surface, #1a1a2e); border:1px solid var(--border, #333);
        border-radius:6px; color:var(--text, #eee); font-size:.95rem; }
      .agent-form .form-input:focus { outline:none; border-color:var(--accent, #14b8a6); }
      .agent-form textarea.form-input { min-height:180px; font-family:'Fira Code','Courier New',monospace; font-size:.85rem; resize:vertical; }
      .agent-form .radio-group { display:flex; gap:1.5rem; margin-top:.4rem; }
      .agent-form .radio-group label { display:flex; align-items:center; gap:.4rem; font-weight:400; cursor:pointer; }
      .agent-form .btn-group { display:flex; gap:.75rem; margin-top:1.5rem; }
      .trigger-hint { font-size:.8rem; color:var(--muted, #888); margin-top:.25rem; }
      .coming-soon { font-size:.75rem; color:var(--muted); background:var(--surface); padding:.15rem .5rem; border-radius:3px; margin-left:.35rem; }
      #runResult { margin-top:1rem; padding:1rem; border-radius:6px; font-family:monospace; font-size:.85rem;
        white-space:pre-wrap; word-break:break-word; max-height:400px; overflow:auto; display:none; }
      #runResult.success { background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2); color:#22c55e; }
      #runResult.error { background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2); color:#ef4444; }
      #runResult.running { background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.2); color:#3b82f6; }
    </style>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
        <h3>${isEdit ? 'Edit Agent' : 'Create Agent'}</h3>
        <a href="/admin/agents" class="btn btn-secondary" style="font-size:.85rem">Back to Agents</a>
      </div>

      <form id="agentForm" class="agent-form">
        <div class="form-group">
          <label for="name">Name *</label>
          <input type="text" id="name" name="name" value="${esc(a.name)}" required class="form-input" placeholder="e.g. Daily Report Generator">
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <input type="text" id="description" name="description" value="${esc(a.description)}" class="form-input" placeholder="Brief description of what this agent does">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="provider">Provider</label>
            <select id="provider" name="provider" class="form-input" onchange="updateModelList()">
              ${availableProviders.map(p =>
                '<option value="' + p.id + '"' + (a.provider === p.id ? ' selected' : '') + (p.hasKey ? '' : ' style="color:var(--muted,#666);"') + '>'
                + p.label + (p.hasKey ? '' : ' (no key)') + '</option>'
              ).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label for="model">Model</label>
            <select id="model" name="model" class="form-input">
              ${(() => {
                const prov = availableProviders.find(p => p.id === (a.provider || 'claude'));
                return prov ? prov.models.map(m => '<option value="' + m.v + '"' + (a.model === m.v ? ' selected' : '') + '>' + m.l + '</option>').join('') : '';
              })()}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="system_prompt">System Prompt *</label>
          <textarea id="system_prompt" name="system_prompt" required class="form-input" placeholder="You are a helpful assistant that generates daily performance reports.&#10;&#10;When asked to execute your task, you will:&#10;1. Summarize key metrics&#10;2. Highlight any anomalies&#10;3. Provide actionable recommendations">${esc(a.system_prompt)}</textarea>
        </div>

        <div class="form-group">
          <label>Trigger Type</label>
          <div class="radio-group">
            <label><input type="radio" name="trigger_type" value="manual" ${a.trigger_type === 'manual' ? 'checked' : ''}> Manual</label>
            <label><input type="radio" name="trigger_type" value="scheduled" ${a.trigger_type === 'scheduled' ? 'checked' : ''}> Scheduled <span class="coming-soon">coming soon</span></label>
            <label><input type="radio" name="trigger_type" value="on_event" ${a.trigger_type === 'on_event' ? 'checked' : ''}> On Event <span class="coming-soon">coming soon</span></label>
          </div>
        </div>

        <div class="form-group" id="triggerConfigGroup" style="${a.trigger_type === 'manual' ? 'display:none' : ''}">
          <label for="trigger_config" id="triggerConfigLabel">${a.trigger_type === 'on_event' ? 'Event Name' : 'Cron Expression'}</label>
          <input type="text" id="trigger_config" name="trigger_config" value="${esc(a.trigger_config)}" class="form-input"
                 placeholder="${a.trigger_type === 'on_event' ? 'e.g. new_booking' : 'e.g. 0 9 * * *'}">
          <div class="trigger-hint" id="triggerHint">${a.trigger_type === 'on_event' ? 'Name of the event that triggers this agent' : 'Standard cron expression (minute hour day month weekday)'}</div>
        </div>

        <div class="form-group">
          <label for="max_tokens">Max Tokens</label>
          <input type="number" id="max_tokens" name="max_tokens" value="${esc(defaultMaxTokens)}" class="form-input" min="1" max="128000">
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:.75rem">
            <span>Active</span>
            <label class="toggle-switch">
              <input type="checkbox" id="is_active" name="is_active" ${a.is_active ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </label>
        </div>

        <div class="btn-group">
          <button type="submit" class="btn btn-primary" id="saveBtn">Save</button>
          ${isEdit ? `<button type="button" class="btn btn-secondary" id="testRunBtn">Test Run</button>` : ''}
          ${isEdit ? `<button type="button" class="btn btn-danger" id="deleteBtn" style="margin-left:auto">Delete</button>` : ''}
        </div>
      </form>

      <div id="runResult"></div>
    </div>

    <style>
      .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
      .toggle-switch input { opacity:0; width:0; height:0; }
      .toggle-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
        background:#444; border-radius:24px; transition:.2s; }
      .toggle-slider:before { content:''; position:absolute; height:18px; width:18px;
        left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; }
      .toggle-switch input:checked + .toggle-slider { background:var(--accent, #14b8a6); }
      .toggle-switch input:checked + .toggle-slider:before { transform:translateX(20px); }
    </style>

    <script>
    (function() {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;
      const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
      const isEdit = ${isEdit ? 'true' : 'false'};
      const agentId = ${isEdit ? a.id : 'null'};

      // Trigger type radio → show/hide config
      document.querySelectorAll('input[name="trigger_type"]').forEach(r => {
        r.addEventListener('change', function() {
          const group = document.getElementById('triggerConfigGroup');
          const label = document.getElementById('triggerConfigLabel');
          const hint = document.getElementById('triggerHint');
          const input = document.getElementById('trigger_config');
          if (this.value === 'manual') {
            group.style.display = 'none';
          } else {
            group.style.display = '';
            if (this.value === 'scheduled') {
              label.textContent = 'Cron Expression';
              input.placeholder = 'e.g. 0 9 * * *';
              hint.textContent = 'Standard cron expression (minute hour day month weekday)';
            } else {
              label.textContent = 'Event Name';
              input.placeholder = 'e.g. new_booking';
              hint.textContent = 'Name of the event that triggers this agent';
            }
          }
        });
      });

      // Provider/model dynamic list
      var _providerModels = ${providerModelsJson};
      window.updateModelList = function() {
        var prov = document.getElementById('provider').value;
        var sel = document.getElementById('model');
        var found = _providerModels.find(function(p) { return p.id === prov; });
        sel.innerHTML = '';
        if (found) found.models.forEach(function(m) {
          var o = document.createElement('option'); o.value = m.v; o.textContent = m.l; sel.appendChild(o);
        });
      };

      // Save
      document.getElementById('agentForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const body = {
          _csrf: csrf,
          name: document.getElementById('name').value.trim(),
          description: document.getElementById('description').value.trim(),
          provider: document.getElementById('provider').value,
          model: document.getElementById('model').value,
          system_prompt: document.getElementById('system_prompt').value.trim(),
          trigger_type: document.querySelector('input[name="trigger_type"]:checked').value,
          trigger_config: document.getElementById('trigger_config').value.trim(),
          is_active: document.getElementById('is_active').checked ? 1 : 0
        };

        const url = isEdit ? '/api/admin/agents/api/' + agentId : '/api/admin/agents/api';
        const method = isEdit ? 'PUT' : 'POST';

        try {
          const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
          const data = await res.json();
          if (data.success) {
            if (!isEdit) {
              location.href = '/admin/agents/' + data.id;
            } else {
              alert('Agent saved');
            }
          } else {
            alert(data.error || 'Failed to save agent');
          }
        } catch (err) {
          alert('Network error: ' + err.message);
        }
      });

      // Test Run
      const testBtn = document.getElementById('testRunBtn');
      if (testBtn) {
        testBtn.addEventListener('click', async function() {
          const result = document.getElementById('runResult');
          result.style.display = 'block';
          result.className = 'running';
          result.textContent = 'Running agent...';
          testBtn.disabled = true;

          try {
            const res = await fetch('/api/admin/agents/api/' + agentId + '/run', {
              method: 'POST', headers, body: JSON.stringify({ _csrf: csrf })
            });
            const data = await res.json();
            if (data.error) {
              result.className = 'error';
              result.textContent = 'Error: ' + data.error;
            } else {
              result.className = 'success';
              result.textContent = data.output || 'Completed (no output)';
              // Refresh page to update run history
              setTimeout(() => location.reload(), 1500);
            }
          } catch (err) {
            result.className = 'error';
            result.textContent = 'Network error: ' + err.message;
          } finally {
            testBtn.disabled = false;
          }
        });
      }

      // Delete
      const deleteBtn = document.getElementById('deleteBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
          if (!confirm('Delete this agent and all its runs?')) return;
          try {
            const res = await fetch('/api/admin/agents/api/' + agentId, {
              method: 'DELETE', headers, body: JSON.stringify({ _csrf: csrf })
            });
            const data = await res.json();
            if (data.success) {
              location.href = '/admin/agents';
            } else {
              alert(data.error || 'Failed to delete');
            }
          } catch (err) {
            alert('Network error: ' + err.message);
          }
        });
      }
    })();
    </script>
  `;
}

// =========================================================================
// API routes
// =========================================================================

// ---------------------------------------------------------------------------
// POST /api — Create agent
// ---------------------------------------------------------------------------
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, async (req, res) => {
  try {
    const { name, description, system_prompt, trigger_type, trigger_config, is_active, provider, model } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!system_prompt || !system_prompt.trim()) return res.status(400).json({ error: 'System prompt is required' });

    const validTriggers = ['manual', 'scheduled', 'on_event'];
    const tType = validTriggers.includes(trigger_type) ? trigger_type : 'manual';

    const result = await insert('agents', {
      name: name.trim(),
      description: (description || '').trim(),
      system_prompt: system_prompt.trim(),
      provider: (provider || 'claude').trim(),
      model: (model || '').trim(),
      trigger_type: tType,
      trigger_config: (trigger_config || '').trim(),
      is_active: is_active ? 1 : 0,
      created_by: req.user.id
    });

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('POST /api/admin/agents/api error:', err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/:id — Update agent
// ---------------------------------------------------------------------------
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, async (req, res) => {
  try {
    const agent = await get(`SELECT id FROM agents WHERE id = ?`, [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { name, description, system_prompt, trigger_type, trigger_config, is_active, provider, model } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (provider !== undefined) updates.provider = String(provider).trim();
    if (model !== undefined) updates.model = String(model).trim();
    if (system_prompt !== undefined) updates.system_prompt = String(system_prompt).trim();
    if (trigger_type !== undefined) {
      const validTriggers = ['manual', 'scheduled', 'on_event'];
      updates.trigger_type = validTriggers.includes(trigger_type) ? trigger_type : 'manual';
    }
    if (trigger_config !== undefined) updates.trigger_config = String(trigger_config).trim();
    if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;

    if (Object.keys(updates).length > 0) {
      await update('agents', agent.id, updates);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/admin/agents/api/:id error:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/:id — Delete agent + runs
// ---------------------------------------------------------------------------
router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  try {
    const agent = await get(`SELECT id FROM agents WHERE id = ?`, [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    await run(`DELETE FROM agent_runs WHERE agent_id = ?`, [agent.id]);
    await run(`DELETE FROM agents WHERE id = ?`, [agent.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/agents/api/:id error:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// ---------------------------------------------------------------------------
// Helper: get and decrypt an API key from settings
// ---------------------------------------------------------------------------
async function getApiKey(settingKey) {
  const row = await get(`SELECT value FROM settings WHERE key = ?`, [settingKey]);
  if (!row || !row.value) return null;
  try { return decrypt(row.value); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Helper: map provider id → settings key
// ---------------------------------------------------------------------------
const PROVIDER_KEY_MAP = {
  claude: 'claude_api_key',
  openai: 'openai_api_key',
  google: 'google_api_key',
  mistral: 'mistral_api_key',
  groq: 'groq_api_key',
  perplexity: 'perplexity_api_key',
  deepseek: 'deepseek_api_key',
};

// ---------------------------------------------------------------------------
// Helper: call an LLM provider and return { output, tokensUsed }
// ---------------------------------------------------------------------------
async function callProvider(provider, model, apiKey, systemPrompt, maxTokens) {
  if (provider === 'claude') {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Execute your task.' }]
    });
    const output = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const tokensUsed = (response.usage && (response.usage.input_tokens + response.usage.output_tokens)) || 0;
    return { output, tokensUsed };
  }

  // OpenAI-compatible providers (OpenAI, Groq, Mistral, DeepSeek, Perplexity)
  const baseUrls = {
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    mistral: 'https://api.mistral.ai/v1',
    deepseek: 'https://api.deepseek.com',
    perplexity: 'https://api.perplexity.ai',
  };

  if (baseUrls[provider]) {
    const url = baseUrls[provider] + '/chat/completions';
    const body = JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Execute your task.' }
      ]
    });
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`${provider} API error ${resp.status}: ${err.slice(0, 300)}`);
    }
    const data = await resp.json();
    const output = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage && (data.usage.prompt_tokens + data.usage.completion_tokens)) || 0;
    return { output, tokensUsed };
  }

  // Google Gemini
  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: 'Execute your task.' }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    });
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Google API error ${resp.status}: ${err.slice(0, 300)}`);
    }
    const data = await resp.json();
    const output = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
    const tokensUsed = (data.usageMetadata && (data.usageMetadata.promptTokenCount + data.usageMetadata.candidatesTokenCount)) || 0;
    return { output, tokensUsed };
  }

  throw new Error('Unsupported provider: ' + provider);
}

// ---------------------------------------------------------------------------
// POST /api/:id/run — Execute agent via selected provider
// ---------------------------------------------------------------------------
router.post('/api/:id/run', requireAuth, validateCsrf, async (req, res) => {
  let runId = null;
  try {
    // 1. Get agent
    const agent = await get(`SELECT * FROM agents WHERE id = ?`, [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const provider = agent.provider || 'claude';
    const model = agent.model || '';
    const keyName = PROVIDER_KEY_MAP[provider];

    // 2. Get API key for this provider
    if (!keyName) return res.status(400).json({ error: 'Unknown provider: ' + provider });
    const apiKey = await getApiKey(keyName);
    if (!apiKey) return res.status(400).json({ error: 'Add ' + provider + ' API key in Settings > API Keys' });

    // 3. Get max tokens from settings
    const maxTokensRow = await get(`SELECT value FROM settings WHERE key = 'agent_max_tokens'`);
    const maxTokens = parseInt((maxTokensRow && maxTokensRow.value) || '4096', 10) || 4096;

    // 3b. Enforce rate limits
    const maxRunsHourRow = await get(`SELECT value FROM settings WHERE key = 'agent_max_runs_hour'`);
    const maxRunsHour = parseInt((maxRunsHourRow && maxRunsHourRow.value) || '10', 10) || 10;
    const maxRunsDayRow = await get(`SELECT value FROM settings WHERE key = 'agent_max_runs_day'`);
    const maxRunsDay = parseInt((maxRunsDayRow && maxRunsDayRow.value) || '100', 10) || 100;

    const hourCount = await get(`SELECT COUNT(*) AS c FROM agent_runs WHERE started_at >= datetime('now', '-1 hour')`);
    if ((hourCount && hourCount.c) >= maxRunsHour) {
      return res.status(429).json({ error: `Hourly agent run limit reached (${maxRunsHour}/hour). Try again later.` });
    }
    const dayCount = await get(`SELECT COUNT(*) AS c FROM agent_runs WHERE started_at >= date('now')`);
    if ((dayCount && dayCount.c) >= maxRunsDay) {
      return res.status(429).json({ error: `Daily agent run limit reached (${maxRunsDay}/day). Try again tomorrow.` });
    }

    // 4. Create agent_run row
    const runResult = await insert('agent_runs', {
      agent_id: agent.id,
      status: 'running',
      input: 'Execute your task.',
      started_at: new Date().toISOString()
    });
    runId = runResult.lastInsertRowid;

    // 5. Call the provider
    const { output, tokensUsed } = await callProvider(provider, model, apiKey, agent.system_prompt, maxTokens);

    // 6. Update run as completed
    await run(`UPDATE agent_runs SET status = 'completed', output = ?, tokens_used = ?, completed_at = ? WHERE id = ?`,
      [output, tokensUsed, new Date().toISOString(), runId]);

    // Create notification
    const completedTitle = 'Agent Completed';
    const completedMessage = `Agent "${agent.name}" completed successfully (${tokensUsed} tokens)`;
    await insert('notifications', {
      type: 'system',
      title: completedTitle,
      message: completedMessage,
      is_read: 0
    });
    dispatchNotification(completedTitle, completedMessage, 'system');

    res.json({ success: true, output, tokens_used: tokensUsed, status: 'completed' });
  } catch (err) {
    console.error('POST /api/admin/agents/api/:id/run error:', err);

    // Update run as failed if we created one
    if (runId) {
      await run(`UPDATE agent_runs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?`,
        [err.message || 'Unknown error', new Date().toISOString(), runId]);
    }

    // Get agent name for notification
    const agent = await get(`SELECT name FROM agents WHERE id = ?`, [req.params.id]);
    const agentName = agent ? agent.name : `#${req.params.id}`;
    const failedTitle = 'Agent Failed';
    const failedMessage = `Agent "${agentName}" failed: ${(err.message || 'Unknown error').slice(0, 200)}`;
    await insert('notifications', {
      type: 'system',
      title: failedTitle,
      message: failedMessage,
      is_read: 0
    });
    dispatchNotification(failedTitle, failedMessage, 'system');

    res.status(500).json({ error: err.message || 'Agent execution failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/:id/runs — List runs for agent
// ---------------------------------------------------------------------------
router.get('/api/:id/runs', requireAuth, async (req, res) => {
  try {
    const runs = await all(`SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 20`, [req.params.id]);
    res.json({ success: true, runs });
  } catch (err) {
    console.error('GET /api/admin/agents/api/:id/runs error:', err);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

module.exports = router;
