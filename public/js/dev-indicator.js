/* ============================================================
   AimTechAI Dev Indicator
   Localhost-only floating widget that surfaces JS errors,
   unhandled promise rejections, and console.errors in real time.
   Mirrors the Next.js dev overlay vibe.
   No-op in production.
   ============================================================ */

(function () {
  // Hard gate — only run on localhost / loopback / private LAN ranges.
  var h = (location.hostname || '').toLowerCase();
  var isLocal =
    h === 'localhost' ||
    h === '0.0.0.0' ||
    /^127\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h.endsWith('.local');
  if (!isLocal) return;

  if (window.__aimDevIndicator) return; // singleton
  window.__aimDevIndicator = true;

  /* ---------- state ---------- */
  var issues = [];
  var seen = new Set();
  var open = false;

  function fingerprint(item) {
    return item.kind + '|' + (item.message || '').slice(0, 200) + '|' + (item.source || '');
  }

  function record(item) {
    item.id = Date.now() + ':' + Math.random().toString(36).slice(2, 7);
    item.ts = new Date().toISOString();
    var fp = fingerprint(item);
    if (seen.has(fp)) {
      // increment count on existing
      for (var i = 0; i < issues.length; i++) {
        if (fingerprint(issues[i]) === fp) {
          issues[i].count = (issues[i].count || 1) + 1;
          issues[i].ts = item.ts;
          break;
        }
      }
    } else {
      seen.add(fp);
      item.count = 1;
      issues.unshift(item);
      if (issues.length > 100) {
        var dropped = issues.pop();
        seen.delete(fingerprint(dropped));
      }
    }
    render();
  }

  /* ---------- error capture ---------- */
  window.addEventListener('error', function (e) {
    record({
      kind: 'error',
      message: e.message || String(e.error),
      source: (e.filename || '') + (e.lineno ? ':' + e.lineno : '') + (e.colno ? ':' + e.colno : ''),
      stack: e.error && e.error.stack ? String(e.error.stack) : null,
    });
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    record({
      kind: 'rejection',
      message: r && r.message ? r.message : String(r),
      stack: r && r.stack ? String(r.stack) : null,
    });
  });

  // Hook console.error / console.warn
  ['error', 'warn'].forEach(function (level) {
    var orig = console[level].bind(console);
    console[level] = function () {
      try {
        var msg = Array.from(arguments).map(function (a) {
          if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch (_) { return String(a); }
        }).join(' ');
        record({ kind: level === 'error' ? 'console.error' : 'console.warn', message: msg });
      } catch (_) { /* never let our hook break logging */ }
      return orig.apply(null, arguments);
    };
  });

  // Capture failed network requests (4xx/5xx) for fetch + XHR
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      var args = arguments;
      var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '?';
      return origFetch.apply(this, args).then(function (res) {
        if (!res.ok) {
          record({ kind: 'network', message: res.status + ' ' + res.statusText, source: url });
        }
        return res;
      }).catch(function (err) {
        record({ kind: 'network', message: 'fetch failed: ' + (err.message || String(err)), source: url });
        throw err;
      });
    };
  }

  /* ---------- UI ---------- */
  var ICON_BUG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>';
  var ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var root = document.createElement('div');
  root.id = 'aim-dev-indicator';
  root.innerHTML = '\
<style>\
#aim-dev-indicator { position: fixed; bottom: 16px; right: 16px; z-index: 2147483647; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\
#aim-dev-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #0FC1B7; color: #fff; border: none; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 16px rgba(15,193,183,0.45); font-size: 12px; font-weight: 600; line-height: 1; transition: transform .15s ease, background .2s; }\
#aim-dev-btn:hover { transform: translateY(-1px); }\
#aim-dev-btn.has-issues { background: #ef4444; box-shadow: 0 4px 16px rgba(239,68,68,0.5); }\
#aim-dev-btn.warn-only { background: #f59e0b; box-shadow: 0 4px 16px rgba(245,158,11,0.4); }\
#aim-dev-btn .count { background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 8px; font-size: 11px; }\
#aim-dev-panel { position: absolute; bottom: 50px; right: 0; width: min(440px, 92vw); max-height: 60vh; background: #0a0a0d; color: #f5f5f7; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; box-shadow: 0 24px 60px -12px rgba(0,0,0,0.7); overflow: hidden; display: none; flex-direction: column; }\
#aim-dev-indicator.open #aim-dev-panel { display: flex; }\
.aim-dev-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; }\
.aim-dev-head .clear { background: transparent; border: 1px solid rgba(255,255,255,0.12); color: #ccc; padding: 3px 8px; font-size: 10px; border-radius: 6px; cursor: pointer; }\
.aim-dev-head .clear:hover { background: rgba(255,255,255,0.05); color: #fff; }\
.aim-dev-list { overflow-y: auto; flex: 1; }\
.aim-dev-list:empty::after { content: "No issues detected. Nice."; display: block; padding: 24px; text-align: center; color: #666; font-size: 12px; }\
.aim-dev-item { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; line-height: 1.45; }\
.aim-dev-item:last-child { border-bottom: 0; }\
.aim-dev-item .row1 { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }\
.aim-dev-item .badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }\
.aim-dev-item.error .badge { background: rgba(239,68,68,0.15); color: #f87171; }\
.aim-dev-item.rejection .badge { background: rgba(168,85,247,0.15); color: #c084fc; }\
.aim-dev-item.network .badge { background: rgba(245,158,11,0.15); color: #fbbf24; }\
.aim-dev-item.console .badge { background: rgba(59,130,246,0.15); color: #60a5fa; }\
.aim-dev-item .count-x { margin-left: auto; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 6px; font-size: 10px; color: #888; }\
.aim-dev-item .msg { color: #f5f5f7; word-break: break-word; }\
.aim-dev-item .src { color: #777; font-size: 10px; margin-top: 3px; word-break: break-all; }\
.aim-dev-item details { margin-top: 4px; }\
.aim-dev-item details summary { color: #888; font-size: 10px; cursor: pointer; }\
.aim-dev-item details pre { font-size: 10px; color: #aaa; background: rgba(255,255,255,0.03); padding: 6px; border-radius: 6px; margin-top: 4px; max-height: 140px; overflow: auto; white-space: pre-wrap; }\
</style>\
<button id="aim-dev-btn" type="button" title="Localhost dev indicator"><span id="aim-dev-icon">' + ICON_CHECK + '</span><span id="aim-dev-label">Ready</span><span class="count" id="aim-dev-count" style="display:none">0</span></button>\
<div id="aim-dev-panel">\
  <div class="aim-dev-head"><span>AIM Dev — localhost</span><button class="clear" id="aim-dev-clear">Clear</button></div>\
  <div class="aim-dev-list" id="aim-dev-list"></div>\
</div>';

  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    document.body.appendChild(root);
    document.getElementById('aim-dev-btn').addEventListener('click', function () {
      open = !open;
      root.classList.toggle('open', open);
    });
    document.getElementById('aim-dev-clear').addEventListener('click', function () {
      issues = [];
      seen.clear();
      render();
    });
    render();
  }

  function fmtType(k) {
    if (k === 'console.error' || k === 'console.warn') return 'console';
    return k;
  }

  function render() {
    var btn = document.getElementById('aim-dev-btn');
    var icon = document.getElementById('aim-dev-icon');
    var label = document.getElementById('aim-dev-label');
    var count = document.getElementById('aim-dev-count');
    var list = document.getElementById('aim-dev-list');
    if (!btn || !list) return;

    var errCount = issues.filter(function (i) { return i.kind === 'error' || i.kind === 'rejection' || i.kind === 'console.error' || i.kind === 'network'; }).length;
    var warnCount = issues.filter(function (i) { return i.kind === 'console.warn'; }).length;
    var total = issues.length;

    btn.classList.remove('has-issues', 'warn-only');
    if (errCount > 0) {
      btn.classList.add('has-issues');
      icon.innerHTML = ICON_BUG;
      label.textContent = errCount + ' issue' + (errCount === 1 ? '' : 's');
    } else if (warnCount > 0) {
      btn.classList.add('warn-only');
      icon.innerHTML = ICON_BUG;
      label.textContent = warnCount + ' warning' + (warnCount === 1 ? '' : 's');
    } else {
      icon.innerHTML = ICON_CHECK;
      label.textContent = 'Ready';
    }

    if (total > 0) {
      count.style.display = 'inline';
      count.textContent = String(total);
    } else {
      count.style.display = 'none';
    }

    list.innerHTML = '';
    issues.slice(0, 50).forEach(function (it) {
      var ft = fmtType(it.kind);
      var row = document.createElement('div');
      row.className = 'aim-dev-item ' + ft;
      var src = it.source ? '<div class="src">' + esc(it.source) + '</div>' : '';
      var stack = it.stack ? '<details><summary>stack</summary><pre>' + esc(it.stack) + '</pre></details>' : '';
      var countBadge = it.count > 1 ? '<span class="count-x">×' + it.count + '</span>' : '';
      row.innerHTML =
        '<div class="row1"><span class="badge">' + esc(it.kind) + '</span>' + countBadge + '</div>' +
        '<div class="msg">' + esc(it.message) + '</div>' +
        src + stack;
      list.appendChild(row);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
