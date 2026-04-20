const express = require('express');
const router = express.Router();

const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

// ---------------------------------------------------------------------------
// Helper: HTML-escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Helper: format currency
// ---------------------------------------------------------------------------
function fmtMoney(v) {
  const n = parseFloat(v) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Helper: days between two dates
// ---------------------------------------------------------------------------
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now - then) / 86400000));
}

// ---------------------------------------------------------------------------
// GET / — Kanban board page
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const unreadCount = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  const stages = all('SELECT * FROM pipeline_stages ORDER BY position ASC');
  const deals = all(
    `SELECT d.*, c.name AS contact_name
     FROM deals d
     LEFT JOIN contacts c ON d.contact_id = c.id
     ORDER BY d.updated_at DESC`
  );
  const contacts = all('SELECT id, name FROM contacts ORDER BY name ASC');

  // Group deals by stage
  const dealsByStage = {};
  for (const s of stages) {
    dealsByStage[s.id] = [];
  }
  for (const d of deals) {
    if (dealsByStage[d.stage_id]) {
      dealsByStage[d.stage_id].push(d);
    }
  }

  // Build columns
  const columnsHtml = stages.map(stage => {
    const stageDeals = dealsByStage[stage.id] || [];
    const totalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

    const cardsHtml = stageDeals.map(d => {
      const days = daysSince(d.updated_at);
      const daysLabel = days === 0 ? 'today' : days === 1 ? '1 day' : days + ' days';
      return `
        <div class="kanban-card" draggable="true" data-deal-id="${d.id}"
             onclick="openEditModal(${d.id})">
          <div style="font-weight:600;font-size:.9rem;margin-bottom:.3rem;">${esc(d.title)}</div>
          ${d.contact_name ? `<div style="color:var(--muted);font-size:.8rem;margin-bottom:.25rem;">${esc(d.contact_name)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;color:var(--teal,#14b8a6);font-size:.85rem;">${fmtMoney(d.value)}</span>
            <span style="color:var(--muted);font-size:.75rem;">${daysLabel}</span>
          </div>
        </div>`;
    }).join('');

    const stageColor = stage.color || '#14b8a6';

    return `
      <div class="kanban-col" data-stage-id="${stage.id}">
        <div class="kanban-col-header">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(stageColor)};margin-right:.4rem;"></span>${esc(stage.name)}</span>
          <span style="display:flex;gap:.6rem;align-items:center;">
            <span style="color:var(--muted)">${stageDeals.length}</span>
            <span style="color:var(--teal,#14b8a6)">${fmtMoney(totalValue)}</span>
          </span>
        </div>
        <div class="kanban-col-body">
          ${cardsHtml || '<p style="color:var(--muted);font-size:.8rem;text-align:center;padding:1rem 0;">No deals</p>'}
        </div>
      </div>`;
  }).join('');

  // Stage options for modals
  const stageOpts = stages.map(s =>
    `<option value="${s.id}">${esc(s.name)}</option>`
  ).join('');

  // Contact options for modals
  const contactOpts = '<option value="">— None —</option>' + contacts.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join('');

  // Deal data as JSON for edit modal
  const dealsJson = JSON.stringify(deals.map(d => ({
    id: d.id,
    title: d.title,
    contact_id: d.contact_id || '',
    stage_id: d.stage_id,
    value: d.value || 0,
    notes: d.notes || ''
  })));

  const content = `
    <style>
      .kanban { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; }
      .kanban-col { min-width: 250px; flex: 0 0 250px; background: var(--bg-card, var(--card-bg, #16213e)); border: 1px solid var(--border, #333); border-radius: 10px; }
      .kanban-col-header { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border, #333); font-size: 0.8rem; font-weight: 700; display: flex; justify-content: space-between; }
      .kanban-col-body { padding: 0.5rem; min-height: 200px; }
      .kanban-card { background: var(--bg-input, var(--surface, #1a1a2e)); border: 1px solid var(--border, #333); border-radius: 8px; padding: 0.7rem; margin-bottom: 0.5rem; cursor: grab; transition: all 0.2s; }
      .kanban-card:hover { border-color: var(--teal, #14b8a6); }
      .kanban-card.dragging { opacity: 0.5; }
      .kanban-col.drag-over { background: rgba(15,193,183,0.05); }

      .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:900; justify-content:center; align-items:center; }
      .modal-overlay.open { display:flex; }
      .modal { background:var(--card-bg, #16213e); border:1px solid var(--border, #333); border-radius:10px; padding:2rem; width:100%; max-width:480px; }
      .modal h3 { margin-bottom:1.2rem; }
      .modal label { display:block; margin-bottom:.25rem; font-weight:500; color:var(--muted, #aaa); font-size:.82rem; text-transform:uppercase; letter-spacing:.03em; }
      .modal input, .modal select, .modal textarea { width:100%; padding:.55rem .75rem; margin-bottom:1rem; background:var(--surface, #1a1a2e); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:6px; font-size:.9rem; font-family:inherit; box-sizing:border-box; }
      .modal textarea { min-height:80px; resize:vertical; }
      .modal .btn-row { display:flex; gap:.8rem; margin-top:.5rem; }
      .modal .btn-cancel { padding:.6rem 1.2rem; background:var(--border, #333); color:var(--text, #eee); border:none; border-radius:6px; cursor:pointer; }
      .modal .btn-submit { padding:.6rem 1.5rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; }
      .modal .btn-delete { padding:.6rem 1.2rem; background:#ef444422; color:#ef4444; border:1px solid #ef444444; border-radius:6px; cursor:pointer; font-size:.9rem; margin-left:auto; }
      .modal .btn-delete:hover { background:#ef444444; }
      .btn-add { display:inline-block; padding:.6rem 1.5rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-size:.95rem; font-weight:600; cursor:pointer; }
      .btn-add:hover { opacity:.9; }
      .value-input-wrap { position:relative; }
      .value-input-wrap::before { content:'$'; position:absolute; left:.75rem; top:50%; transform:translateY(-70%); color:var(--muted, #aaa); font-weight:600; pointer-events:none; }
      .value-input-wrap input { padding-left:1.5rem; }
      .toast { position:fixed; top:1.5rem; right:1.5rem; padding:.8rem 1.5rem; border-radius:6px; font-weight:500; z-index:9999; transition:opacity .3s; }
      .toast-success { background:#22c55e22; color:#22c55e; border:1px solid #22c55e44; }
      .toast-error { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
    </style>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:.8rem;">
        <div>
          <h3>Pipeline</h3>
          <p style="margin:.3rem 0 0;color:var(--muted)">Drag deals between stages to update their progress.</p>
        </div>
        <button class="btn-add" id="btnNewDeal">+ New Deal</button>
      </div>
      <div class="kanban">
        ${columnsHtml}
      </div>
    </div>

    <!-- New Deal Modal -->
    <div class="modal-overlay" id="newDealModal">
      <div class="modal">
        <h3>New Deal</h3>
        <form id="newDealForm">
          <label for="nd_title">Title *</label>
          <input type="text" id="nd_title" name="title" required maxlength="200">

          <label for="nd_contact">Contact</label>
          <select id="nd_contact" name="contact_id">
            ${contactOpts}
          </select>

          <label for="nd_stage">Stage</label>
          <select id="nd_stage" name="stage_id">
            ${stageOpts}
          </select>

          <label for="nd_value">Value</label>
          <div class="value-input-wrap">
            <input type="number" id="nd_value" name="value" min="0" step="1" placeholder="0">
          </div>

          <label for="nd_notes">Notes</label>
          <textarea id="nd_notes" name="notes" maxlength="2000"></textarea>

          <div class="btn-row">
            <button type="button" class="btn-cancel" onclick="closeModal('newDealModal')">Cancel</button>
            <button type="submit" class="btn-submit">Create Deal</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Deal Modal -->
    <div class="modal-overlay" id="editDealModal">
      <div class="modal">
        <h3>Edit Deal</h3>
        <form id="editDealForm">
          <input type="hidden" id="ed_id">

          <label for="ed_title">Title *</label>
          <input type="text" id="ed_title" name="title" required maxlength="200">

          <label for="ed_contact">Contact</label>
          <select id="ed_contact" name="contact_id">
            ${contactOpts}
          </select>

          <label for="ed_stage">Stage</label>
          <select id="ed_stage" name="stage_id">
            ${stageOpts}
          </select>

          <label for="ed_value">Value</label>
          <div class="value-input-wrap">
            <input type="number" id="ed_value" name="value" min="0" step="1" placeholder="0">
          </div>

          <label for="ed_notes">Notes</label>
          <textarea id="ed_notes" name="notes" maxlength="2000"></textarea>

          <div class="btn-row">
            <button type="button" class="btn-cancel" onclick="closeModal('editDealModal')">Cancel</button>
            <button type="submit" class="btn-submit">Save Changes</button>
            <button type="button" class="btn-delete" id="btnDeleteDeal">Delete</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    (function() {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;
      const dealsData = ${dealsJson};

      // ------- Toast -------
      function showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
      }

      // ------- Modal helpers -------
      window.closeModal = function(id) {
        document.getElementById(id).classList.remove('open');
      };

      function openModal(id) {
        document.getElementById(id).classList.add('open');
      }

      // Close on backdrop click
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
      });

      // ------- New Deal -------
      document.getElementById('btnNewDeal').addEventListener('click', () => {
        document.getElementById('newDealForm').reset();
        openModal('newDealModal');
      });

      document.getElementById('newDealForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          title: document.getElementById('nd_title').value,
          contact_id: document.getElementById('nd_contact').value || null,
          stage_id: document.getElementById('nd_stage').value || null,
          value: parseFloat(document.getElementById('nd_value').value) || 0,
          notes: document.getElementById('nd_notes').value
        };
        try {
          const resp = await fetch('/api/admin/pipeline/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify(data)
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Deal created', 'success');
            setTimeout(() => location.reload(), 600);
          } else {
            showToast(result.error || 'Failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });

      // ------- Edit Deal -------
      window.openEditModal = function(dealId) {
        const deal = dealsData.find(d => d.id === dealId);
        if (!deal) return;
        document.getElementById('ed_id').value = deal.id;
        document.getElementById('ed_title').value = deal.title;
        document.getElementById('ed_contact').value = deal.contact_id;
        document.getElementById('ed_stage').value = deal.stage_id;
        document.getElementById('ed_value').value = deal.value || '';
        document.getElementById('ed_notes').value = deal.notes;
        openModal('editDealModal');
      };

      document.getElementById('editDealForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('ed_id').value;
        const data = {
          title: document.getElementById('ed_title').value,
          contact_id: document.getElementById('ed_contact').value || null,
          stage_id: document.getElementById('ed_stage').value || null,
          value: parseFloat(document.getElementById('ed_value').value) || 0,
          notes: document.getElementById('ed_notes').value
        };
        try {
          const resp = await fetch('/api/admin/pipeline/api/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify(data)
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Deal updated', 'success');
            setTimeout(() => location.reload(), 600);
          } else {
            showToast(result.error || 'Update failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });

      // ------- Delete Deal -------
      document.getElementById('btnDeleteDeal').addEventListener('click', async () => {
        const id = document.getElementById('ed_id').value;
        if (!confirm('Delete this deal permanently?')) return;
        try {
          const resp = await fetch('/api/admin/pipeline/api/' + id, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrf }
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Deal deleted', 'success');
            setTimeout(() => location.reload(), 600);
          } else {
            showToast(result.error || 'Delete failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });

      // ------- Drag and Drop -------
      const cards = document.querySelectorAll('.kanban-card');
      const cols = document.querySelectorAll('.kanban-col');

      cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.dealId);
          card.classList.add('dragging');
          // Prevent click from also firing
          e.stopPropagation();
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          cols.forEach(c => c.classList.remove('drag-over'));
        });
      });

      cols.forEach(col => {
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', (e) => {
          // Only remove if leaving the column entirely
          if (!col.contains(e.relatedTarget)) {
            col.classList.remove('drag-over');
          }
        });

        col.addEventListener('drop', async (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');

          const dealId = e.dataTransfer.getData('text/plain');
          const stageId = col.dataset.stageId;

          if (!dealId || !stageId) return;

          try {
            const resp = await fetch('/api/admin/pipeline/api/' + dealId + '/stage', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
              body: JSON.stringify({ stage_id: parseInt(stageId) })
            });
            const result = await resp.json();
            if (resp.ok) {
              // Move card DOM element to new column body
              const cardEl = document.querySelector('.kanban-card[data-deal-id="' + dealId + '"]');
              const colBody = col.querySelector('.kanban-col-body');
              if (cardEl && colBody) {
                colBody.appendChild(cardEl);
              }
              showToast('Deal moved', 'success');
              // Reload after short delay to update counts/totals
              setTimeout(() => location.reload(), 800);
            } else {
              showToast(result.error || 'Move failed', 'error');
            }
          } catch (err) {
            showToast('Network error', 'error');
          }
        });
      });
    })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Pipeline',
    page: 'pipeline',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// POST /api — Create deal
// ---------------------------------------------------------------------------
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { title, contact_id, stage_id, value, notes } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Default to first stage if none specified
  let finalStageId = stage_id ? parseInt(stage_id) : null;
  if (!finalStageId) {
    const firstStage = get('SELECT id FROM pipeline_stages ORDER BY position ASC LIMIT 1');
    finalStageId = firstStage ? firstStage.id : null;
  }

  const result = insert('deals', {
    title: String(title).trim().slice(0, 200),
    contact_id: contact_id ? parseInt(contact_id) : null,
    stage_id: finalStageId,
    value: parseFloat(value) || 0,
    notes: String(notes || '').trim().slice(0, 2000),
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, id: result.lastInsertRowid, message: 'Deal created' });
});

// ---------------------------------------------------------------------------
// PUT /api/:id — Update deal
// ---------------------------------------------------------------------------
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  if (req.params.id === 'undefined') return res.status(400).json({ error: 'Invalid deal ID' });

  const deal = get('SELECT * FROM deals WHERE id = ?', [req.params.id]);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const { title, contact_id, stage_id, value, notes } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  update('deals', deal.id, {
    title: String(title).trim().slice(0, 200),
    contact_id: contact_id ? parseInt(contact_id) : null,
    stage_id: stage_id ? parseInt(stage_id) : deal.stage_id,
    value: parseFloat(value) || 0,
    notes: String(notes || '').trim().slice(0, 2000),
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, message: 'Deal updated' });
});

// ---------------------------------------------------------------------------
// PATCH /api/:id/stage — Move deal to new stage (drag-drop)
// ---------------------------------------------------------------------------
router.patch('/api/:id/stage', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const deal = get('SELECT * FROM deals WHERE id = ?', [req.params.id]);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const { stage_id } = req.body || {};
  if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

  // Verify stage exists
  const stage = get('SELECT id FROM pipeline_stages WHERE id = ?', [parseInt(stage_id)]);
  if (!stage) return res.status(400).json({ error: 'Invalid stage' });

  update('deals', deal.id, {
    stage_id: parseInt(stage_id),
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, message: 'Deal moved' });
});

// ---------------------------------------------------------------------------
// DELETE /api/:id — Delete deal (admin only)
// ---------------------------------------------------------------------------
router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const deal = get('SELECT * FROM deals WHERE id = ?', [req.params.id]);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  run('DELETE FROM deals WHERE id = ?', [deal.id]);

  res.json({ ok: true, message: 'Deal deleted' });
});

module.exports = router;
