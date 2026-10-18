/* ============================================================================
   Pulse Desk v3 — core engine
   API + token, polling, formatting, charts, modals, action dispatcher, router.

   HARD RULES (from the code maps — do not break these):
   1. Every non-GET /api/* call needs header X-Dashboard-Token, or the server
      answers 401 and the action silently does nothing. All writes go through
      api() here; never call fetch() directly for a mutation.
   2. Tables re-render on every poll, so ALL trading buttons are handled by one
      delegated document-level listener (data-a attributes). Never attach a
      listener to a rendered node.
   3. Live engines place real orders. The interlocks below mirror the server's
      own refusals so the UI can explain why a method cannot start; the server
      remains the authority and its error string is what we display.
   4. Paper numbers come only from /api/tournament and are shown only on the
      Testing page. Never render a tournament number on a live page.
   ========================================================================== */
const PD = (function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const state = {
    page: 'home',
    status: null,
    tournament: null,
    strategies: null,
    pnl: null,
    safety: null,
    exchanges: null,
    history: null,
    sparkCache: {},
    sparkAt: 0,
    offline: 0,
    token: localStorage.getItem('pulseDashToken') || '',
    version: '',
    pages: {},
    subTitles: {}
  };

  /* ---------------- API ---------------- */
  function api(path, opts) {
    const o = Object.assign({ method: 'GET' }, opts || {});
    if (o.body !== undefined && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    o.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    if (state.token) o.headers['X-Dashboard-Token'] = state.token;
    return fetch(path, o).then(function (r) {
      return r.text().then(function (t) {
        if (r.status === 401) return { ok: false, error: 'Unauthorized — set the dashboard token' };
        let j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        if (j === null) return { ok: r.ok, error: r.ok ? '' : ('HTTP ' + r.status) };
        return j;
      });
    }).catch(function (e) {
      return { ok: false, error: 'Dashboard offline (' + (e && e.message ? e.message : 'network') + ')', _offline: true };
    });
  }
  const post = (p, b) => api(p, { method: 'POST', body: b === undefined ? {} : b });

  /* ---------------- format ---------------- */
  function money(n, dp) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    const d = dp === undefined ? 2 : dp;
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 ? '-$' : '$') + s;
  }
  function signed(n, dp) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v), dp === undefined ? 2 : dp).replace('$', '$');
  }
  function pct(n, dp) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp === undefined ? 2 : dp) + '%';
  }
  function num(n, dp) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function cls(n) { const v = Number(n); return v > 0 ? 'up' : v < 0 ? 'down' : 'muted'; }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ts(t) {
    const n = Number(t);
    if (!n) return '—';
    return new Date(n * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function clock(t) {
    const n = Number(t);
    if (!n) return '—';
    return new Date(n * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function ago(t) {
    const n = Number(t);
    if (!n) return '—';
    const s = Math.max(0, Math.floor(Date.now() / 1000 - n));
    return dur(s) + ' ago';
  }
  function dur(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  }
  function shortSym(s) { return String(s || '').replace('/USDT', ''); }

  /* ---------------- ui bits ---------------- */
  let toastT = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.hidden = false;
    t.className = kind || '';
    t.textContent = msg;
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 4200);
  }
  function modal(title, html) {
    $('#mTitle').textContent = title;
    $('#mBody').innerHTML = html;
    $('#scrim').classList.add('on');
  }
  function closeModal() { $('#scrim').classList.remove('on'); }

  /* ---------------- charts ---------------- */
  function sparkline(vals, up) {
    const a = (vals || []).map(Number).filter(isFinite);
    if (a.length < 2) return '<span class="muted" style="font-size:12px">—</span>';
    const w = 64, h = 22, mn = Math.min.apply(null, a), mx = Math.max.apply(null, a), sp = (mx - mn) || 1;
    const pts = a.map(function (v, i) {
      return (i / (a.length - 1) * w).toFixed(1) + ',' + (h - ((v - mn) / sp) * (h - 4) - 2).toFixed(1);
    }).join(' ');
    return '<svg class="spk" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' +
      (up ? '#1f8f3d' : '#e11d48') + '" stroke-width="1.6"/></svg>';
  }
  function drawCandles(cv, data, levels) {
    if (!cv) return;
    const c = data && data.candles ? data.candles : [];
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 640, h = cv.clientHeight || cv.height || 240;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!c.length) { g.fillStyle = '#9a9a9a'; g.font = '13px system-ui'; g.fillText('No candles', 10, 20); return; }
    const pad = 10, volH = 30, plotH = h - pad - volH - 8;
    let lo = Infinity, hi = -Infinity, mv = 0;
    c.forEach(function (k) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); mv = Math.max(mv, k.v || 0); });
    (levels ? Object.keys(levels) : []).forEach(function (key) {
      const v = Number(levels[key]);
      if (isFinite(v) && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    });
    const sp = (hi - lo) || 1, bw = Math.max(2, (w - pad * 2) / c.length - 2);
    const y = v => pad + (1 - (v - lo) / sp) * plotH;
    c.forEach(function (k, i) {
      const x = pad + i * ((w - pad * 2) / c.length);
      const up = k.c >= k.o;
      g.strokeStyle = up ? '#1f8f3d' : '#e11d48';
      g.fillStyle = g.strokeStyle;
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x + bw / 2, y(k.h)); g.lineTo(x + bw / 2, y(k.l)); g.stroke();
      g.fillRect(x, y(Math.max(k.o, k.c)), bw, Math.max(1, Math.abs(y(k.o) - y(k.c))));
      if (mv) { const vh = (k.v || 0) / mv * volH; g.globalAlpha = .22; g.fillRect(x, h - pad - vh, bw, vh); g.globalAlpha = 1; }
    });
    const marks = [['entry', '#3880f0', 'ENTRY'], ['stop', '#e11d48', 'STOP'], ['take', '#1f8f3d', 'TARGET']];
    marks.forEach(function (m) {
      const v = levels ? Number(levels[m[0]]) : NaN;
      if (!isFinite(v) || v <= 0) return;
      g.strokeStyle = m[1]; g.setLineDash([5, 4]); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(pad, y(v)); g.lineTo(w - pad, y(v)); g.stroke();
      g.setLineDash([]);
      // A solid chip behind the label: over candles, bare text was unreadable.
      const label = m[2] + ' ' + v;
      g.font = 'bold 13px system-ui';
      const tw = g.measureText(label).width + 12;
      g.fillStyle = m[1];
      g.fillRect(w - tw - 6, y(v) - 20, tw, 18);
      g.fillStyle = '#fff';
      g.fillText(label, w - tw, y(v) - 7);
    });
    g.fillStyle = '#9a9a9a'; g.font = '11px system-ui';
    g.fillText(hi.toPrecision(6), 4, 12);
    g.fillText(lo.toPrecision(6), 4, h - volH - 4);
  }
  function openChart(symbol, source, tf, title) {
    tf = tf || '1h';
    state.chart = { symbol: symbol, source: source || 'cex', tf: tf };
    modal(title || symbol, '<div class="chart"><canvas id="mCanvas" style="height:min(56vh,440px)"></canvas></div><div class="note" style="margin-top:12px" id="mMeta">Loading…</div>');
    $$('#mTf button').forEach(b => b.classList.toggle('on', b.dataset.tf === tf));
    loadChart();
  }
  function loadChart() {
    const c = state.chart; if (!c) return;
    const url = c.source === 'sol'
      ? '/api/chart/sol?mint=' + encodeURIComponent(c.symbol) + '&tf=' + encodeURIComponent(c.tf) + '&limit=140'
      : '/api/chart?symbol=' + encodeURIComponent(c.symbol) + '&tf=' + encodeURIComponent(c.tf) + '&limit=140';
    api(url).then(function (r) {
      const cv = $('#mCanvas'); if (!cv) return;
      drawCandles(cv, r, r && r.levels);
      const meta = $('#mMeta');
      if (meta) {
        if (r && r.ok === false) { meta.textContent = r.error || 'chart unavailable'; return; }
        meta.innerHTML = 'last <b>' + esc(r.last) + '</b> · change <b class="' + cls(r.change_pct) + '">' + pct(r.change_pct) +
          '</b> · high ' + esc(r.high) + ' · low ' + esc(r.low) + (r.levels && r.levels.entry ? ' · held by ' + esc(r.levels.owner || '') + ' (' + esc(r.levels.style || '') + ')' : '');
      }
    });
  }

  /* ---------------- sparklines ---------------- */
  function hydrateSparks(kind) {
    const sel = kind === 'sol' ? '[data-spkmint]' : '[data-spksym]';
    const nodes = $$(sel);
    if (!nodes.length) return;
    const keys = [];
    nodes.forEach(function (n) { const k = kind === 'sol' ? n.dataset.spkmint : n.dataset.spksym; if (k && keys.indexOf(k) < 0) keys.push(k); });
    const now = Date.now();
    const fresh = keys.every(k => state.sparkCache[k] && (now - state.sparkCache[k].at) < 90000);
    const paint = function () {
      nodes.forEach(function (n) {
        const k = kind === 'sol' ? n.dataset.spkmint : n.dataset.spksym;
        const rec = state.sparkCache[k];
        if (!rec || !rec.v || rec.v.length < 2) return;
        const up = rec.v[rec.v.length - 1] >= rec.v[0];
        n.innerHTML = sparkline(rec.v, up);
      });
    };
    if (fresh) { paint(); return; }
    const url = kind === 'sol'
      ? '/api/sparks/sol?mints=' + encodeURIComponent(keys.join(','))
      : '/api/sparks?symbols=' + encodeURIComponent(keys.join(','));
    api(url).then(function (r) {
      const m = (r && r.sparks) || {};
      Object.keys(m).forEach(function (k) { state.sparkCache[k] = { v: m[k], at: Date.now() }; });
      paint();
    });
  }

  /* ---------------- timers (per-trade running time) ---------------- */
  function tickTimers() {
    const now = Date.now() / 1000;
    $$('[data-since]').forEach(function (el) {
      const t = Number(el.dataset.since);
      if (t) el.textContent = dur(now - t);
    });
    $$('[data-until]').forEach(function (el) {
      const t = Number(el.dataset.until);
      if (t) el.textContent = t > now ? dur(t - now) + ' left' : 'due';
    });
  }

  /* ---------------- render ---------------- */
  function mount() {
    const st = state.status;
    const page = state.page;
    const fn = state.pages[page];
    const host = $('#p-' + page);
    if (!host) return;
    if (!st && page !== 'settings') { host.innerHTML = '<div class="loading">Connecting to the desk…</div>'; return; }
    // never clobber what the operator is typing
    const a = document.activeElement;
    if (a && host.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;

    /* The page re-renders every 2 s. Without this, every horizontally scrolled
       table snaps back to the left mid-drag, which makes the UI feel broken.
       Scroll offsets are captured by container index and restored after paint. */
    const scrollables = $$('.bd.flush, .logs, .modal .mb', host);
    const saved = scrollables.map(function (el) { return [el.scrollLeft, el.scrollTop]; });
    const pageY = window.scrollY;

    host.innerHTML = fn ? fn(st) : '<div class="note">Not built yet.</div>';
    if (fn && fn.after) fn.after(st);

    const after = $$('.bd.flush, .logs, .modal .mb', host);
    after.forEach(function (el, i) {
      if (!saved[i]) return;
      if (saved[i][0]) el.scrollLeft = saved[i][0];
      if (saved[i][1]) el.scrollTop = saved[i][1];
    });
    if (pageY) window.scrollTo(0, pageY);

    paintLeds();
    tickTimers();
  }
  function paintLeds() {
    const st = state.status || {};
    const map = {
      core: st.running ? (st.mode === 'LIVE' ? 'live' : 'paper') : '',
      wish: st.wish_running ? 'live' : '',
      moon: st.moon_running ? 'live' : '',
      alpha: st.sol_running ? 'live' : '',
      council: st.ai_assist ? 'live' : ''
    };
    Object.keys(map).forEach(function (k) {
      const el = $('#led-' + k);
      if (el) el.className = 'led' + (map[k] ? ' ' + map[k] : '');
    });
  }

  /* ---------------- actions ---------------- */
  function gate() {
    const st = state.status || {};
    const wishLive = !!st.wish_running, moonLive = !!st.moon_running;
    const coreLive = !!(st.running && st.mode === 'LIVE'), alphaLive = !!st.sol_running;
    return {
      core: coreLive ? { ok: true } : (wishLive ? { ok: false, why: 'Stop Wish Me Rich first — both spend the same USDT.' }
        : moonLive ? { ok: false, why: 'Stop the live Moonshot first — one live engine at a time.' } : { ok: true }),
      moon: (coreLive ? { ok: false, why: 'Stop the live Core first — one live engine at a time.' }
        : wishLive ? { ok: false, why: 'Stop the live Wish first — one live engine at a time.' } : { ok: true }),
      wish: alphaLive ? { ok: false, why: 'Stop On-chain Alpha first — one live on-chain engine at a time (same wallet).' } : { ok: true },
      alpha: wishLive ? { ok: false, why: 'Stop Wish Me Rich first — one live on-chain engine at a time (same wallet).' } : { ok: true }
    };
  }
  function confirmBox(title, lines) {
    return window.confirm(title + '\n\n' + lines.join('\n'));
  }
  function say(r, okMsg) {
    if (!r) { toast('No response from the desk', 'bad'); return; }
    if (r.ok === false) { toast(r.error || 'Refused', 'bad'); return; }
    toast(okMsg || r.message || 'Done', 'good');
  }
  function inFlight(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.was = btn.textContent; btn.disabled = true; btn.textContent = 'working…'; }
    else { btn.disabled = false; if (btn.dataset.was) btn.textContent = btn.dataset.was; }
  }
  function action(name, d, btn) {
    const st = state.status || {};
    const g = gate();
    /* navigation hooks: goto:<page> and goto:period:<today|yday|7|15|30> */
    if (name.indexOf('goto:') === 0) {
      const parts = name.split(':');
      if (parts[1] === 'period') { state.period = parts[2]; mount(); return; }
      go(parts[1]);
      return;
    }
    const need = (k) => { if (!g[k].ok) { toast(g[k].why, 'bad'); return false; } return true; };
    const live = () => !!(st.mode === 'LIVE');
    let p = null, okMsg = '';

    switch (name) {
      /* ---- core ---- */
      case 'core.start':
        if (!need('core')) return;
        if (!confirmBox('Start Core bot?', [live() ? 'LIVE money — real orders on KuCoin.' : 'Paper mode (Live toggle is off).',
          'Slots: ' + (st.max_open_trades || '?'), 'Ticket size: $' + (st.trade_mode ? st.trade_mode.min_notional_usd + '–$' + st.trade_mode.max_notional_usd : '?')])) return;
        p = post('/api/start', { live: live() }); okMsg = 'Core started'; break;
      case 'core.stop': p = post('/api/stop'); okMsg = 'Core stopped'; break;
      case 'core.slots': {
        const inp = document.getElementById('slotsIn');
        const v = parseInt(d.v || (inp && inp.value), 10);
        if (!(v >= 1 && v <= 40)) { toast('Slots must be 1–40', 'bad'); return; }
        p = post('/api/slots', { n: v }); okMsg = 'Slots set to ' + v; break;
      }
      case 'core.sync':
        if (!confirmBox('Sync wallet?', ['Reads KuCoin and adopts idle coins when "trade wallet coins" is on.', 'Can take a few seconds.'])) return;
        p = post('/api/sync'); okMsg = 'Synced'; break;
      case 'core.adopt': p = post('/api/wallet/adopt', { enabled: d.on === '1' }); okMsg = 'Adopt updated'; break;
      case 'core.sellall':
        if (!confirmBox('Sell ALL core positions now?', ['Market sells every open position.', 'This is real money.'])) return;
        p = post('/api/sell_all'); okMsg = 'Selling everything'; break;
      case 'core.spray': p = post('/api/spray', { enabled: d.on === '1' }); okMsg = 'Spray mode updated'; break;
      case 'core.gaming': p = post('/api/gaming', { enabled: d.on === '1' }); okMsg = 'Gaming mode updated'; break;
      case 'buy': {
        const sym = d.s;
        if (live() && !confirmBox('Buy ' + shortSym(sym) + ' now?', ['LIVE money — a real market order on KuCoin.'])) return;
        p = post('/api/buy', { symbol: sym }); okMsg = 'Buying ' + shortSym(sym); break;
      }
      case 'sell':
        if (!confirmBox('Sell ' + shortSym(d.s) + ' now?', ['Market order, whole position.'])) return;
        p = post('/api/sell', { symbol: d.s }); okMsg = 'Selling ' + shortSym(d.s); break;
      case 'ban':
        if (!confirmBox('Ban ' + shortSym(d.s) + '?', ['Removes it from buys. An open position is not sold.'])) return;
        p = post('/api/ban', { symbol: d.s }); okMsg = 'Banned ' + shortSym(d.s); break;
      case 'unban': p = post('/api/unban', { symbol: d.s }); okMsg = 'Unbanned'; break;
      case 'leave': p = post('/api/wallet/leave', { symbol: d.s, leave: d.on !== '0' }); okMsg = 'Updated'; break;
      case 'wallet.sell':
        if (!confirmBox('Market-sell your whole ' + shortSym(d.s) + ' balance?', ['This sells the wallet balance, not just the bot position.'])) return;
        p = post('/api/wallet/sell', { symbol: d.s }); okMsg = 'Selling wallet balance'; break;
      case 'flatten':
        if (!confirmBox('FLATTEN everything?', ['Stops new buys, sells every core position, and reclaims rent.', 'This is real money and cannot be undone.'])) return;
        p = post('/api/flatten'); okMsg = 'Flatten started'; break;

      /* ---- wish ---- */
      case 'wish.start':
        if (!need('wish')) return;
        if (!confirmBox('Start Wish Me Rich LIVE?', ['Sprays $1–$2 tickets across new/alpha on-chain coins.',
          'Random sell timer 5 min – 4 h, −20% stop.', 'This spends the real Solana wallet — it cannot run on paper here.'])) return;
        p = post('/api/wish/start', { live: true }); okMsg = 'Wish started LIVE'; break;
      case 'wish.stop': p = post('/api/wish/stop'); okMsg = 'Wish stopped'; break;
      case 'wish.sellall':
        if (!confirmBox('Sell ALL Wish coins?', ['Market sells every Wish bag on-chain.'])) return;
        p = post('/api/wish/sell_all'); okMsg = 'Selling all Wish'; break;
      case 'wish.buy': p = post('/api/wish/buy', { symbol: d.s }); okMsg = 'Wish buy sent'; break;
      case 'wish.sell': p = post('/api/wish/sell', { symbol: d.s }); okMsg = 'Wish sell sent'; break;
      case 'wish.mode': p = post('/api/wish/mode', { mode: d.v }); okMsg = 'Wish mode → ' + d.v; break;

      /* ---- moonshot ---- */
      case 'moon.start':
        if (!need('moon')) return;
        if (!confirmBox('Start Moonshot?', ['Buys pullbacks inside big pumps, $2–$5 tickets, max 5 open.',
          live() ? 'LIVE money — real orders on KuCoin.' : 'Paper mode.'])) return;
        p = post('/api/moonshot/start', { live: live() }); okMsg = 'Moonshot started'; break;
      case 'moon.stop': p = post('/api/moonshot/stop'); okMsg = 'Moonshot stopped'; break;
      case 'moon.sell': p = post('/api/moonshot/sell', { symbol: d.s }); okMsg = 'Moonshot sell sent'; break;
      case 'moon.mode': p = post('/api/moonshot/mode', { mode: d.v }); okMsg = 'Moonshot mode → ' + d.v; break;

      /* ---- on-chain alpha ---- */
      case 'alpha.start':
        if (!need('alpha')) return;
        if (!confirmBox('Start On-chain Alpha?', ['Real Jupiter swaps from the Solana wallet.', '$2–$5 tickets, max 5 open.'])) return;
        p = post('/api/solana/start', { live: true }); okMsg = 'Alpha started'; break;
      case 'alpha.stop': p = post('/api/solana/stop'); okMsg = 'Alpha stopped'; break;
      case 'alpha.sell': p = post('/api/solana/sell', { mint: d.m }); okMsg = 'Alpha sell sent'; break;
      case 'alpha.ban': p = post('/api/solana/ban', { mint: d.m, symbol: d.s || '' }); okMsg = 'Banned'; break;
      case 'alpha.unban': p = post('/api/solana/unban', { mint: d.m }); okMsg = 'Unbanned'; break;
      case 'alpha.mode': p = post('/api/solana/mode', { mode: d.v }); okMsg = 'Alpha mode → ' + d.v; break;
      case 'alpha.exit': p = post('/api/solana/exit', { style: d.v }); okMsg = 'Exit style → ' + d.v; break;
      case 'alpha.profile': p = post('/api/solana/exit_profile', { profile: d.v }); okMsg = 'Profile → ' + d.v; break;
      case 'alpha.reclaim':
        if (!confirmBox('Reclaim rent?', ['Closes empty token accounts and returns ~0.002 SOL each.'])) return;
        p = post('/api/solana/reclaim'); okMsg = 'Rent reclaimed'; break;
      case 'alpha.halt':
        if (!confirmBox('Clear the daily halt?', ['Re-bases today\'s loss counter to the current wallet value.'])) return;
        p = post('/api/solana/clear_halt'); okMsg = 'Halt cleared'; break;
      case 'deposited': {
        const v = window.prompt('What did you put into the on-chain wallet (USD)?', d.v || '0');
        if (v === null) return;
        p = post('/api/solana/deposited', { usd: parseFloat(v) || 0 }); okMsg = 'Baseline updated'; break;
      }
      case 'guards': p = post('/api/guards', { guards: JSON.parse('{' + JSON.stringify(d.k) + ':' + d.v + '}') }); okMsg = 'Guard updated'; break;

      /* ---- council ---- */
      case 'council.on': p = post('/api/ai', { enabled: d.on === '1' }); okMsg = 'AI council ' + (d.on === '1' ? 'on' : 'off'); break;
      case 'council.pick': {
        const sel = (st.ai_council_models || []).slice();
        const id = d.id;
        const i = sel.indexOf(id);
        if (i >= 0) { if (sel.length <= 1) { toast('Keep at least one voter', 'bad'); return; } sel.splice(i, 1); }
        else { if (sel.length >= 7) { toast('The cap is 7 voters', 'bad'); return; } sel.push(id); }
        p = post('/api/ai/council', { models: sel }); okMsg = 'Council updated'; break;
      }
      case 'council.refresh': p = post('/api/ai/refresh'); okMsg = 'Models refreshed'; break;

      /* ---- tournament (paper) ---- */
      case 'tour.start':
        if (!confirmBox('Start the paper tournament?', ['$100 paper stake per engine, honest fees and slippage.', 'No real orders — this is a race, not trading.'])) return;
        p = post('/api/tournament/start', { engine: d.engines || 'all' }); okMsg = 'Paper tournament started'; break;
      case 'tour.stop': p = post('/api/tournament/stop'); okMsg = 'Tournament stopped'; break;

      /* ---- safety ---- */
      case 'safety.set': {
        const body = {}; body[d.k] = d.t === 'b' ? (d.v === '1') : parseFloat(d.v);
        p = post('/api/safety', { safety: body }); okMsg = 'Safety updated'; break;
      }
      case 'safety.trip':
        if (!confirmBox('Pause fresh entries now?', ['The tail-event breaker stops new on-chain buys for 24 h.'])) return;
        p = post('/api/safety/breaker/trip'); okMsg = 'Breaker tripped'; break;
      case 'safety.reset': p = post('/api/safety/breaker/reset'); okMsg = 'Breaker cleared'; break;

      /* ---- exchanges ---- */
      case 'ex.save': {
        const body = {
          exchange: d.ex, label: $('#exLabel') ? $('#exLabel').value : '',
          api_key: $('#exKey') ? $('#exKey').value : '', api_secret: $('#exSecret') ? $('#exSecret').value : '',
          api_password: $('#exPass') ? $('#exPass').value : ''
        };
        if (!body.ex) { toast('Pick a venue', 'bad'); return; }
        p = post('/api/exchanges/save', body); okMsg = 'Venue saved'; break;
      }
      case 'ex.use': p = post('/api/exchanges/activate', { id: d.id }); okMsg = 'Venue activated'; break;
      case 'ex.del':
        if (!confirmBox('Delete this venue profile?', ['Stored keys for it are removed.'])) return;
        p = post('/api/exchanges/delete', { id: d.id }); okMsg = 'Deleted'; break;
      case 'ex.test': p = post('/api/exchanges/test', { exchange: d.ex }); okMsg = 'Venue reachable'; break;
      case 'webhook.test': p = post('/api/webhook/test'); okMsg = 'Test ping sent to Discord'; break;
      case 'backtest.run':
        if (!confirmBox('Run the moon backtest?', ['Replays the Moonshot rules on real candles.', 'Takes about 30 seconds and uses free APIs.'])) return;
        p = post('/api/backtest/moon', { pools: 10, candles: 1000 }); okMsg = 'Backtest started'; break;

      /* ---- housekeeping ---- */
      case 'token.save': {
        const box = $('#tokBar') || $('#tokInput');
        const v = box ? box.value.trim() : '';
        if (!v) { toast('Paste the token first', 'bad'); return; }
        localStorage.setItem('pulseDashToken', v);
        state.token = v;
        const bar = $('#tokenBar');
        if (bar) bar.remove();
        toast('Token saved — buttons are live now', 'good');
        refresh(true);
        if (state.page === 'settings') mount();
        return;
      }
      case 'csv': window.open('/api/history.csv?limit=5000', '_blank'); return;
      case 'chart': openChart(d.s, d.src || 'cex', '1h', d.t || d.s); return;
      case 'reload': location.reload(); return;
      default: toast('Unknown action: ' + name, 'bad'); return;
    }
    if (p) {
      inFlight(btn, true);
      p.then(function (r) { say(r, okMsg); }).then(function () { inFlight(btn, false); refresh(true); });
    }
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el) return;
    e.preventDefault();
    action(el.dataset.a, el.dataset, el);
  });

  /* ---------------- poll ---------------- */
  function setBanner(bad, text) {
    const b = $('#readyBanner');
    if (!text) { b.hidden = true; return; }
    b.hidden = false;
    b.className = 'banner' + (bad ? ' bad' : '');
    b.textContent = text;
  }
  function refresh(force) {
    return api('/api/status').then(function (s) {
      if (s && s._offline) {
        state.offline++;
        if (state.offline >= 2) {
          $('#offlineBanner').hidden = false;
          $('#fLinkDot').className = 'dot bad';
          $('#fLink').textContent = 'offline';
        }
        return;
      }
      state.offline = 0;
      $('#offlineBanner').hidden = true;
      state.status = s;
      window.__pd = s;
      if (s.readiness) {
        $('#appVer').textContent = s.readiness.app_version ? 'v' + s.readiness.app_version : '';
        state.version = s.readiness.app_version || '';
        const iss = (s.readiness.issues || []).concat((s.readiness.warnings || []).filter(w => !/paper mode is on/i.test(w)));
        setBanner(!!(s.readiness.issues && s.readiness.issues.length), iss[0] || '');
        const ready = s.readiness.ready;
        $('#fLinkDot').className = 'dot ' + (ready ? 'ok' : 'warn');
        $('#fLink').textContent = ready ? 'desk ready' : 'needs attention';
      }
      $('#fTokenDot').className = 'dot ' + (state.token ? 'ok' : 'warn');
      $('#fToken').textContent = state.token ? 'token set' : 'no token — actions will 401';
      mount();
    });
  }
  function refreshTournament() {
    return api('/api/tournament').then(function (r) { state.tournament = r; if (state.page === 'testing') mount(); });
  }
  function refreshStrategies() {
    return api('/api/strategies').then(function (r) { state.strategies = r; if (state.page === 'strategies') mount(); });
  }
  function refreshPnl() {
    if (state.pnl && Date.now() - (state.pnlAt || 0) < 15000) return Promise.resolve(state.pnl);
    return api('/api/pnl').then(function (r) { state.pnl = r; state.pnlAt = Date.now(); if (state.page === 'home') mount(); return r; });
  }
  function refreshExchanges() {
    return api('/api/exchanges').then(function (r) { state.exchanges = r; if (state.page === 'exchanges') mount(); });
  }
  function refreshSafety() {
    return api('/api/safety').then(function (r) { state.safety = r; if (state.page === 'rules') mount(); });
  }
  function refreshHistory(force) {
    if (!force && state.history && state.historyAt && Date.now() - state.historyAt < 20000) {
      return Promise.resolve(state.history);
    }
    return api('/api/history?limit=200').then(function (r) {
      state.history = r;
      state.historyAt = Date.now();
      if (state.page === 'activity') mount();
      return r;
    });
  }

  /* ---------------- router ---------------- */
  const TITLES = {
    home: ['Home', 'Live status of every method — no paper numbers here'],
    testing: ['Testing', 'Paper money only — $100 per engine, honest fees. Never mixed with live'],
    core: ['Core bot', 'KuCoin strategy book · slots, chart, hot coins, strategy keys'],
    wish: ['Wish Me Rich', 'On-chain spray · $1–$2 tickets · random sell timers'],
    moon: ['Moonshot', 'Pullback entries inside big pumps · slicer or rider'],
    alpha: ['On-chain Alpha', 'Solana wallet · moon rider or fresh sniper'],
    follows: ['Follows', 'Copy a trader who is actively buying and selling'],
    council: ['AI council', 'Voters, models and how they decide'],
    exchanges: ['Exchanges', 'Venues and real wallet balances'],
    strategies: ['Strategies', 'All ten, with edge from your own closed trades'],
    rules: ['Rules', 'Every safety rail, exactly as configured'],
    activity: ['Activity & history', 'Buys, sells, P&L and the live log'],
    settings: ['Settings', 'Keys, token, dashboard controls']
  };
  function go(page, silent) {
    if (!TITLES[page]) page = 'home';
    state.page = page;
    $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.page === page));
    $$('.page').forEach(p => p.classList.remove('on'));
    const host = $('#p-' + page);
    if (host) host.classList.add('on');
    $('#ptitle').textContent = TITLES[page][0];
    $('#psub').textContent = TITLES[page][1];
    try { localStorage.setItem('pulse.page', page); } catch (e) { }
    if (!silent) {
      if (page === 'testing') refreshTournament();
      if (page === 'strategies') refreshStrategies();
      if (page === 'exchanges') refreshExchanges();
      if (page === 'rules') refreshSafety();
      if (page === 'activity') refreshHistory();
      if (page === 'home') refreshPnl();
    }
    mount();
  }

  function tokenBar() {
    /* An inline bar instead of a browser prompt(): it survives being dismissed,
       it explains itself, and it disappears the moment a token is saved. */
    const host = document.querySelector('.banners');
    if (!host || document.getElementById('tokenBar')) return;
    const bar = document.createElement('div');
    bar.id = 'tokenBar';
    bar.className = 'banner';
    bar.innerHTML = '<b>One thing first:</b> paste your dashboard token to make the buttons work ' +
      '(<code>DASHBOARD_TOKEN</code> in <code>/opt/pulse-desk/.env</code>) — ' +
      '<input type="password" id="tokBar" placeholder="paste token" style="width:min(420px,40vw);margin:0 8px;vertical-align:middle">' +
      '<button class="btn sm primary" data-a="token.save" style="vertical-align:middle">Save</button> ' +
      '<span class="muted" style="font-size:13px">stored in this browser only · sending it as a header, never in the URL</span>';
    host.appendChild(bar);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    $$('.nav').forEach(function (n) { n.addEventListener('click', function () { go(n.dataset.page); }); });
    $('#mClose').addEventListener('click', closeModal);
    $('#scrim').addEventListener('click', function (e) { if (e.target.id === 'scrim') closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $$('#mTf button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.chart) return;
        state.chart.tf = b.dataset.tf;
        $$('#mTf button').forEach(x => x.classList.toggle('on', x === b));
        loadChart();
      });
    });
    /* The old dashboard is no longer linked from here — the operator retired it. */

    api('/api/bootstrap').then(function (b) {
      if (b && b.version) $('#appVer').textContent = 'v' + b.version;
      if (b && b.token_required && !state.token) tokenBar();
      let start = 'home';
      try { start = localStorage.getItem('pulse.page') || 'home'; } catch (e) { }
      go(start, true);
      refresh();
      setInterval(refresh, 2000);
      setInterval(function () {
        if (state.chart && $('#scrim').classList.contains('on')) loadChart();
      }, 30000);
      setInterval(tickTimers, 1000);
      setInterval(refreshTournament, 5000);
      setInterval(refreshStrategies, 20000);
    });
  }

  return {
    boot: boot, go: go, state: state, pages: state.pages,
    api: api, post: post, refresh: refresh, mount: mount, toast: toast, modal: modal,
    money: money, signed: signed, pct: pct, num: num, cls: cls, esc: esc, ts: ts, clock: clock,
    ago: ago, dur: dur, shortSym: shortSym, sparkline: sparkline, drawCandles: drawCandles,
    openChart: openChart, hydrateSparks: hydrateSparks, refreshTournament: refreshTournament,
    refreshStrategies: refreshStrategies, refreshExchanges: refreshExchanges, refreshSafety: refreshSafety,
    refreshHistory: refreshHistory, refreshPnl: refreshPnl, gate: gate
  };
})();
