/* ============================================================================
   Pulse Desk v3 — page renderers.
   Every number below comes from a real API field (see PLAN-v3-ui.md §2).
   Paper data appears ONLY in renderTesting(); live pages never touch
   state.tournament.
   ========================================================================== */
(function () {
  'use strict';
  const P = PD.pages, S = PD.state;
  const M = PD.money, PCT = PD.pct, N = PD.num, E = PD.esc, CLS = PD.cls, CLOCK = PD.clock;

  const money0 = v => M(v, 0);
  const engineLive = (o, mode) => !!o && mode === 'LIVE';
  const pill = (txt, kind) => '<span class="pill ' + (kind || '') + '"><span class="led"></span>' + E(txt) + '</span>';
  /* Compact red box for "this engine cannot start right now" — the long note that
     used to sit in the page body was more noise than information. */
  const blockPill = why => '<div style="margin-top:12px"><span class="pill bad" style="padding:8px 12px;border-radius:10px;white-space:normal;text-align:left;line-height:1.35;max-width:100%">' + E(why) + '</span></div>';
  const livePill = (running, live) => running ? pill(live ? 'running live' : 'running', live ? 'live' : 'paper') : pill('stopped', 'off');
  const tile = (title, big, sub, act, kind) =>
    '<div class="tile"' + (act ? ' data-a="' + act + '"' : '') + '><div class="t">' +
    '<span class="led ' + (kind || '') + '"></span>' + E(title) + '</div><div class="big">' + big + '</div><div class="s">' + sub + '</div></div>';

  /* ============================== HOME ============================== */
  P.home = function (st) {
    const books = (st.books && st.books.strategy_books) || {};
    const core = books.core || {}, wish = books.wish || {}, moon = books.moon || {}, onchain = books.onchain || {};
    const exw = (st.books && st.books.exchange_wallet) || {};
    const rw = (st.books && st.books.real_wallet) || {};
    const running = [];
    if (st.running) running.push('Core bot');
    if (st.wish_running) running.push('Wish Me Rich');
    if (st.moon_running) running.push('Moonshot');
    if (st.sol_running) running.push('On-chain Alpha');
    const pnl = S.pnl || {};

    const methods = [
      { k: 'core', t: 'Core bot', o: core, run: st.running, live: st.mode === 'LIVE', extra: (st.max_open_trades || 0) + ' slots' },
      { k: 'wish', t: 'Wish Me Rich', o: wish, run: st.wish_running, live: true, extra: wish.running ? (wish.open_count || 0) + '/' + (wish.target_n || 0) + ' bags' : 'idle' },
      { k: 'moon', t: 'Moonshot', o: moon, run: st.moon_running, live: st.moon && st.moon.mode === 'LIVE', extra: (st.moonshot_mode || 'slicer') },
      { k: 'alpha', t: 'On-chain Alpha', o: onchain, run: st.sol_running, live: true, extra: (st.sol && st.sol.halted) ? 'halted' : (st.solana_mode || 'moon') }
    ];
    const tiles = methods.map(function (m) {
      const o = m.o || {};
      const led = m.run ? (m.live ? 'live' : 'paper') : '';
      return tile(m.t, M(o.equity_usd), (m.run ? 'running · ' : 'stopped · ') + E(m.extra) +
        ' · day <span class="' + CLS(o.day_pnl) + '">' + PD.signed(o.day_pnl) + '</span>', 'goto:' + m.k, led);
    }).join('') + tile('Follows', '<span class="muted">not built</span>', 'needs the copy engine — Phase 4', '', '');

    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Money in KuCoin', M(exw.total_usd), 'USDT ' + M(exw.usdt) + ' · coins ' + M(exw.coin_value)),
      stat('Solana wallet', M(rw.equity_usd), (rw.gas_sol ? N(rw.gas_sol, 3) + ' SOL gas' : '—') + ' · coins ' + M(rw.coins_usd)),
      stat('Running now', running.length ? E(running.join(', ')) : '<span class="muted">nothing</span>', running.length ? 'live engines are spending real money' : 'all engines stopped'),
      stat('Net P&L today', '<span class="' + CLS(pnl.net_today) + '">' + PD.signed(pnl.net_today) + '</span>', 'after AI cost ' + M(pnl.api_cost_today) + ' · all-time ' + PD.signed(pnl.net_total)),
      '</div>',

      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Methods</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">live books only</span></div><div class="bd"><div class="sq">', tiles, '</div></div></div>',

      '<div class="grid g2" style="margin-bottom:16px">',
      '<div class="card"><div class="hd"><h2>History</h2><div class="sp"></div>', periodSeg(), '</div>',
      '<div class="bd">', historyBlock(), '</div></div>',
      '<div class="card"><div class="hd"><h2>Wallets</h2><div class="sp"></div>',
      '<button class="btn sm" data-a="core.sync">Sync wallet</button></div>',
      '<div class="bd flush">', walletRows(st), '</div></div>',
      '</div>',

      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Desk</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">' + E((st.trade_mode && st.trade_mode.label) || '') + '</span></div>',
      '<div class="bd"><div class="grid g3">',
      kv('Core mode', st.running ? (st.mode === 'LIVE' ? 'LIVE — real orders' : 'PAPER') : 'stopped'),
      kv('Slots', (st.max_open_trades || 0) + ' · ticket $' + ((st.trade_mode && st.trade_mode.min_notional_usd) || '?') + '–$' + ((st.trade_mode && st.trade_mode.max_notional_usd) || '?')),
      kv('Spray mode', st.spray_mode ? 'on' : 'off'),
      kv('AI council', st.ai_assist ? 'on · ' + ((st.ai_council_models || []).length) + ' voters' : 'off'),
      kv('Day P&L (core)', '<span class="' + CLS(st.day_pnl) + '">' + PD.signed(st.day_pnl) + '</span>'),
      kv('Record (core)', (st.wins || 0) + 'W / ' + (st.losses || 0) + 'L · ' + N(st.win_rate, 1) + '%'),
      kv('On-chain halt', (st.sol && st.sol.halted) ? '<span class="down">' + E(st.sol.halt_reason || 'halted') + '</span>' : 'clear'),
      kv('Breaker', (st.breaker && st.breaker.active) ? '<span class="down">tripped</span>' : 'clear'),
      kv('Exchange', E(st.exchange_label || st.exchange || '—')),
      '</div></div></div>'
    ].join('');
  };
  function stat(k, v, d, act) {
    return '<div class="stat' + (act ? ' click" data-a="' + act : '') + '"><div class="k">' + E(k) + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
  }
  function kv(k, v) { return '<div class="kv"><span class="k">' + E(k) + '</span><span class="v">' + v + '</span></div>'; }
  function periodSeg() {
    const on = S.period || 'today';
    return '<div class="seg" id="periodSeg">' + ['today', 'yday', '7', '15', '30'].map(function (p) {
      const label = { today: 'Today', yday: 'Yesterday', '7': '7 days', '15': '15 days', '30': '30 days' }[p];
      return '<button data-a="goto:period:' + p + '" class="' + (on === p ? 'on' : '') + '">' + label + '</button>';
    }).join('') + '</div>';
  }
  function historyBlock() {
    const h = S.homeHist;
    if (!h || !h.ok) return '<div class="loading">Loading history…</div>';
    const per = S.period || 'today';
    const daily = (h.daily || []).slice().reverse();           // newest first
    const pick = per === 'today' ? daily.slice(0, 1) : per === 'yday' ? daily.slice(1, 2) : daily.slice(0, parseInt(per, 10));
    const pnl = pick.reduce((a, r) => a + (Number(r.pnl) || 0), 0);
    const closed = pick.reduce((a, r) => a + (Number(r.closed) || 0), 0);
    const t = h.totals || {};
    const rows = Object.keys(h.by_engine || {}).map(function (k) {
      const e = h.by_engine[k];
      return '<tr><td>' + E(e.label) + '</td><td class="num">' + e.buys + '</td><td class="num">' + e.closed + '</td>' +
        '<td class="num">' + e.wins + '</td><td class="num">' + (e.closed - e.wins) + '</td>' +
        '<td class="num ' + CLS(e.pnl) + '">' + PD.signed(e.pnl) + '</td></tr>';
    }).join('');
    return '<div class="grid g4" style="margin-bottom:14px">' +
      stat('P&L · ' + E(per), '<span class="' + CLS(pnl) + '">' + PD.signed(pnl) + '</span>', 'realised closes ' + PD.signed(closed)) +
      stat('Closed trades', String(t.closed || 0), (t.wins || 0) + 'W / ' + (t.losses || 0) + 'L') +
      stat('Win rate', N(t.win_rate, 1) + '%', 'min sample ' + (t.closed || 0) + ' closes') +
      stat('Slippage', t.slippage_usd === undefined ? '—' : M(t.slippage_usd), t.avg_slippage_pct === null || t.avg_slippage_pct === undefined ? 'no fills measured' : 'avg ' + N(t.avg_slippage_pct, 2) + '% per exit') +
      '</div>' +
      '<table><thead><tr><th>Engine</th><th class="num">Buys</th><th class="num">Closed</th><th class="num">Won</th><th class="num">Lost</th><th class="num">P&amp;L</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<div class="note" style="margin-top:14px">Every method resets its <b>reading</b> at midnight — not the system. Totals above cover the whole history; the period only picks the days.</div>';
  }
  function walletRows(st) {
    const w = st.wallet || {};
    const coins = w.coins || [];
    if (!w.ok) return '<div class="rowline"><span class="d">Wallet unavailable — ' + E(w.error || 'not connected') + '</span></div>';
    let html = '<div class="rowline"><span class="t">KuCoin total</span><span class="d">USDT ' + M(w.usdt) + ' · coins ' + M(w.coin_value) +
      ' · read ' + PD.ago((Date.now() / 1000) - (w.age_sec || 0)) + '</span><span class="v">' + M(w.total) + '</span></div>';
    coins.slice(0, 8).forEach(function (c) {
      html += '<div class="rowline"><span class="t">' + E(PD.shortSym(c.symbol)) + '</span>' +
        '<span class="d">' + N(c.amount, 4) + ' @ ' + M(c.price, 4) + (c.leave_alone ? ' · <span class="tag">leave alone</span>' : '') + '</span>' +
        '<span class="v">' + M(c.value) + '</span>' +
        '<span class="acts"><button class="btn xs" data-a="leave" data-s="' + E(c.symbol) + '" data-on="' + (c.leave_alone ? '0' : '1') + '">' + (c.leave_alone ? 'trade it' : 'leave alone') + '</button>' +
        '<button class="btn xs" data-a="wallet.sell" data-s="' + E(c.symbol) + '">sell</button></span></div>';
    });
    if (!coins.length) html += '<div class="rowline"><span class="d">No coins in the wallet — only USDT.</span></div>';
    return html;
  }
  P.home.after = function () {
    if (S.homeHist && S.homeHistAt && Date.now() - S.homeHistAt < 30000) return;
    PD.api('/api/history?limit=50').then(function (r) { S.homeHist = r; S.homeHistAt = Date.now(); PD.mount(); });
  };

  /* ============================== CORE ============================== */
  P.core = function (st) {
    const pos = st.positions || [];
    const hot = st.hot_coins || [];
    const g = PD.gate().core;
    const live = st.mode === 'LIVE';
    const book = ((st.books || {}).strategy_books || {}).core || {};
    const strat = (S.strategies && S.strategies.rows) || [];

    const rows = pos.map(function (p) {
      return row(p.symbol, [
        CLOCK(p.opened_at) + ' <span class="muted">' + PD.ts(p.opened_at).split(',')[0] + '</span>',
        '<span class="tmr" data-since="' + (p.opened_at || 0) + '">…</span>',
        M(p.entry, 6), M(p.price, 6),
        '<span class="' + CLS(p.my_pct) + '">' + PCT(p.my_pct) + '</span>',
        '<span class="muted">' + M(p.stop, 6) + ' / ' + M(p.take, 6) + '</span>',
        E(p.style || '—'),
        '<button class="btn xs" data-a="leave" data-s="' + E(p.symbol) + '" data-on="1">leave</button>' +
        '<button class="btn xs" data-a="ban" data-s="' + E(p.symbol) + '">ban</button>' +
        '<button class="btn xs" data-a="sell" data-s="' + E(p.symbol) + '">sell</button>' +
        '<button class="btn xs" data-a="buy" data-s="' + E(p.symbol) + '">buy +</button>',
        '<span data-spksym="' + E(p.symbol) + '"></span>'
      ], p);
    }).join('');

    const hotRows = hot.slice(0, 12).map(function (h) {
      const banned = (st.banned || []).indexOf(h.symbol) >= 0;
      const sym = E(h.symbol), nm = E(PD.shortSym(h.symbol));
      return '<tr><td class="clk" data-a="chart" data-s="' + sym + '" data-t="' + nm + '" title="open the chart">' +
        '<div class="coin"><span class="tick">' + nm.slice(0, 3) + '</span>' + nm + '</div></td>' +
        '<td class="clk" data-a="chart" data-s="' + sym + '" data-t="' + nm + '" title="open the chart" data-spksym="' + sym + '"></td>' +
        '<td class="num">' + N(h.heat, 2) + '</td>' +
        '<td class="num ' + CLS(h.change_24h) + '">' + PCT(h.change_24h) + '</td>' +
        '<td class="num">' + M(h.volume_usd, 0) + '</td>' +
        '<td>' + (banned ? '<span class="tag sell">banned</span>' : '<span class="tag buy">ok</span>') + '</td>' +
        '<td><div class="acts">' +
        (banned ? '<button class="btn xs" data-a="unban" data-s="' + sym + '">unban</button>'
          : '<button class="btn xs" data-a="ban" data-s="' + sym + '">ban</button>') +
        '<button class="btn xs" data-a="buy" data-s="' + sym + '">buy</button></div></td></tr>';
    }).join('');

    const keyRows = strat.map(function (s) {
      return '<tr><td><b>' + E(s.label) + '</b>' + (s.rated ? '' : ' <span class="tag">unrated</span>') + '</td>' +
        '<td class="num">' + s.trades + '</td><td class="num">' + s.wins + '</td><td class="num">' + (s.trades - s.wins) + '</td>' +
        '<td class="num ' + CLS(s.pnl) + '">' + PD.signed(s.pnl) + '</td>' +
        '<td class="num">' + N(s.weight, 2) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">Strategy stats load on the Strategies page.</td></tr>';

    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Core book', M(book.equity_usd), 'cash ' + M(book.cash_usd) + ' · ledger, not a wallet'),
      stat('Day P&L', '<span class="' + CLS(st.day_pnl) + '">' + PD.signed(st.day_pnl) + '</span>', 'closed ' + PD.signed(book.closed_pnl)),
      stat('Record', (st.wins || 0) + 'W / ' + (st.losses || 0) + 'L', 'win rate ' + N(st.win_rate, 1) + '%'),
      '<div class="stat"><div class="k">Slots</div><div class="v">' + pos.length + ' / ' + (st.max_open_trades || 0) + '</div>' +
      '<div class="d" style="display:flex;gap:6px;align-items:center;margin-top:6px">' +
      '<input type="number" id="slotsIn" min="1" max="40" value="' + (st.max_open_trades || 5) + '" style="width:70px">' +
      '<button class="btn xs" data-a="core.slots">set</button>' +
      '</div></div>',
      '</div>',

      '<div class="card" style="margin-bottom:16px"><div class="hd">',
      '<h2>Status</h2><div class="sp"></div>',
      livePill(st.running, live),
      '<span class="tag">' + E(st.status_text || '') + '</span>',
      '<button class="btn sm ' + (st.running ? 'stop' : 'go') + '" data-a="' + (st.running ? 'core.stop' : 'core.start') + '"' + (g.ok ? '' : ' disabled title="' + E(g.why) + '"') + '>' + (st.running ? 'Stop Core' : 'Start Core') + '</button>',
      '<button class="btn sm" data-a="core.sync">Sync wallet</button>',
      '<button class="btn sm stop" data-a="core.sellall">Sell all</button>',
      '</div><div class="bd"><div class="grid g4">',
      kv('Mode', live ? '<span class="down">LIVE</span>' : 'PAPER'),
      kv('Last cycle', st.last_cycle_at ? PD.ago(st.last_cycle_at) : '—'),
      kv('Halted', st.halted ? '<span class="down">' + E(st.halt_reason || 'yes') + '</span>' : 'no'),
      kv('Trade wallet coins', '<label class="ck"><input type="checkbox" data-a="core.adopt" data-on="' + (st.adopt_on_sync ? '0' : '1') + '"' + (st.adopt_on_sync ? ' checked' : '') + '> adopt on sync</label>'),
      '</div>',
      g.ok ? '' : blockPill(g.why),
      '</div></div>',

      '<div class="grid g2" style="margin-bottom:16px">',
      '<div class="card"><div class="hd"><h2>Chart</h2><div class="sp"></div>',
      (function () {
        /* The chart used to be stuck on one coin with no way to change it.
           Options: the open positions first, then everything the scan found. */
        const syms = pos.map(p => p.symbol).concat((st.hot_coins || []).map(h => h.symbol));
        const uniq = syms.filter((s, i) => syms.indexOf(s) === i).slice(0, 30);
        const cur = S.coreSymbol || uniq[0] || 'BTC/USDT';
        if (uniq.indexOf(cur) < 0) uniq.unshift(cur);
        return '<select onchange="PD.state.coreSymbol=this.value;PD.mount()" title="pick the coin to chart">' +
          uniq.map(s => '<option value="' + E(s) + '"' + (s === cur ? ' selected' : '') + '>' + E(PD.shortSym(s)) + '</option>').join('') +
          '</select>';
      })(),
      '<button class="btn sm" data-a="chart" data-s="' + E(S.coreSymbol || 'BTC/USDT') + '" data-t="' + E(PD.shortSym(S.coreSymbol || 'BTC/USDT')) + '">Enlarge</button></div>',
      '<div class="bd"><div class="chart"><canvas id="coreCanvas" height="220"></canvas></div>',
      '<div class="note" style="margin-top:12px">Candles plus the entry, stop and target of the open position when there is one. Click a coin below to load its chart here.</div></div></div>',

      '<div class="card"><div class="hd"><h2>Hot coins</h2><div class="sp"></div><span class="pill">' + pos.length + ' taken</span></div>',
      '<div class="bd flush"><table><thead><tr><th>Coin</th><th>7d</th><th class="num">Heat</th><th class="num">24h</th><th class="num">Volume</th><th>State</th><th></th></tr></thead><tbody>' +
      (hotRows || '<tr><td colspan="7" class="muted">No scan yet — start Core to scan.</td></tr>') + '</tbody></table></div></div>',
      '</div>',

      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Open positions</h2><div class="sp"></div><span class="muted" style="font-size:13px">running time is live</span></div>',
      '<div class="bd flush"><table><thead><tr><th>Coin</th><th>Bought at</th><th>Running</th><th class="num">Entry</th><th class="num">Now</th><th class="num">P&amp;L</th><th class="num">Stop / Take</th><th>Key</th><th>Actions</th><th>7d</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="10" class="muted">No open trade.</td></tr>') + '</tbody></table></div></div>',

      '<div class="card"><div class="hd"><h2>Strategy keys</h2><div class="sp"></div><span class="muted" style="font-size:13px">all ten · core book</span></div>',
      '<div class="bd flush"><table><thead><tr><th>Strategy</th><th class="num">Trades</th><th class="num">Won</th><th class="num">Lost</th><th class="num">P&amp;L</th><th class="num">Weight</th></tr></thead><tbody>' +
      keyRows + '</tbody></table></div></div>',
      '</div>',

      '<div class="card" style="margin-top:16px"><div class="hd"><h2>What it is thinking</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">' + E(st.cycleHint || '') + '</span></div><div class="bd flush">',
      (st.thoughts || []).slice(0, 6).map(function (t) {
        return '<div class="rowline"><span class="t">' + E(t.symbol) + '</span><span class="d">' + E(t.reason || t.narrative || '') + '</span>' +
          '<span class="tag ' + (t.active ? 'buy' : '') + '">' + E(t.direction || '') + ' ' + N(t.confidence, 0) + '%</span>' +
          '<span class="acts"><button class="btn xs" data-a="ban" data-s="' + E(t.symbol) + '">ban</button>' +
          '<button class="btn xs" data-a="buy" data-s="' + E(t.symbol) + '">buy</button></span></div>';
      }).join('') || '<div class="rowline"><span class="d">Waiting for a scan cycle…</span></div>',
      '</div></div>'
    ].join('');
  };
  function row(coin, cells, p) {
    return '<tr><td><div class="coin"><span class="tick">' + E(PD.shortSym(coin).slice(0, 3)) + '</span>' + E(PD.shortSym(coin)) + '</div></td>' +
      '<td>' + cells[0] + '</td><td>' + cells[1] + '</td><td class="num">' + cells[2] + '</td><td class="num">' + cells[3] + '</td>' +
      '<td class="num">' + cells[4] + '</td><td class="num">' + cells[5] + '</td><td>' + cells[6] + '</td>' +
      '<td><div class="acts">' + cells[7] + '</div></td><td>' + cells[8] + '</td></tr>';
  }
  P.core.after = function (st) {
    if (!S.strategies) PD.refreshStrategies();
    const pos = st.positions || [];
    const sym = S.coreSymbol || (pos[0] && pos[0].symbol) || (st.hot_coins && st.hot_coins[0] && st.hot_coins[0].symbol) || 'BTC/USDT';
    S.coreSymbol = sym;
    const lab = document.getElementById('coreChartSym');
    if (lab) lab.textContent = sym;
    const lv = {};
    const p = pos.filter(x => x.symbol === sym)[0] || pos[0];
    if (p) { lv.entry = p.entry; lv.stop = p.stop; lv.take = p.take; lv.owner = 'Core'; lv.style = p.style; }
    PD.api('/api/chart?symbol=' + encodeURIComponent(sym) + '&tf=1h&limit=140').then(function (r) {
      const cv = document.getElementById('coreCanvas');
      PD.drawCandles(cv, r, (r && r.levels) || lv);
    });
    PD.hydrateSparks('cex');
  };

  /* ============================== WISH ============================== */
  P.wish = function (st) {
    const w = st.wish || {};
    const g = PD.gate().wish;
    const pos = w.positions || [];
    const lead = (w.positions || [])[0] || {};
    const posRows = pos.map(function (p) {
      return '<tr><td><div class="coin"><span class="tick">' + E((p.symbol || '').slice(0, 3)) + '</span>' + E(p.symbol) + '</div></td>' +
        '<td class="num">' + M(p.entry, 8) + '</td><td class="num">' + M(p.price, 8) + '</td>' +
        '<td class="num ' + CLS(p.unrealized_pnl) + '">' + PD.signed(p.unrealized_pnl) + '</td>' +
        '<td><span class="tmr" data-until="' + (p.sell_at || 0) + '">…</span>' + (p.trail_armed ? ' <span class="tag buy">trail</span>' : '') + '</td>' +
        '<td class="num">' + (p.off_peak_pct === undefined ? '—' : N(p.off_peak_pct, 1) + '%') + '</td>' +
        '<td><div class="acts">' +
        '<button class="btn xs" data-a="chart" data-s="' + E(p.mint) + '" data-src="sol" data-t="' + E(p.symbol) + '">chart</button>' +
        '<button class="btn xs" data-a="wish.sell" data-s="' + E(p.mint || p.symbol) + '">sell</button></div></td></tr>';
    }).join('');
    const hist = (w.history || []).slice(0, 12).map(function (h) {
      return '<tr><td>' + E(PD.ts(h.ts)) + '</td><td>' + E(h.side) + '</td><td>' + E(h.symbol) + '</td>' +
        '<td class="num">' + M(h.quote) + '</td><td class="num ' + CLS(h.pnl) + '">' + (h.pnl === null || h.pnl === undefined ? '—' : PD.signed(h.pnl)) + '</td>' +
        '<td class="muted">' + E(h.reason || '') + '</td></tr>';
    }).join('');

    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Wish book', M(w.equity), 'cash ' + M(w.cash) + ' · on-chain'),
      stat('Day', '<span class="' + CLS(w.day_pnl) + '">' + PD.signed(w.day_pnl) + '</span>', 'closed ' + PD.signed(w.closed_pnl)),
      stat('Record', (w.wins || 0) + 'W / ' + (w.losses || 0) + 'L', 'win rate ' + N(w.win_rate, 1) + '%'),
      stat('Bags', (w.open_count || 0) + ' / ' + (w.target_n || 0), 'spray target'),
      '</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Engine</h2><div class="sp"></div>',
      livePill(w.running, true), '<span class="tag">' + E(w.status_text || '') + '</span>',
      '<select onchange="PD.state.wishMode=this.value;PD.api(\'/api/wish/mode\',{method:\'POST\',body:{mode:this.value}}).then(r=>{PD.toast(r.ok===false?(r.error||\'Refused\'):(\'Wish hunt \'+this.value),r.ok===false?\'bad\':\'good\');PD.refresh(true)})">' +
      (function () {
        const wm = S.wishMode || st.wish_hunt_mode || 'fresh';
        return ['fresh', 'moon'].map(v => '<option value="' + v + '"' + (wm === v ? ' selected' : '') + '>' + v + ' hunt</option>').join('');
      })() + '</select>',
      '<button class="btn sm ' + (w.running ? 'stop' : 'go') + '" data-a="' + (w.running ? 'wish.stop' : 'wish.start') + '"' + (g.ok ? '' : ' disabled title="' + E(g.why) + '"') + '>' + (w.running ? 'Stop Wish' : 'Start Wish LIVE') + '</button>',
      '<button class="btn sm stop" data-a="wish.sellall">Sell all Wish</button>',
      '</div><div class="bd">',
      '<div class="note">Sprays <b>$1–$2</b> tickets across new and alpha on-chain coins, up to the target count, with a <b>random sell timer (5 min – 4 h)</b> and a <b>−20%</b> cut before the timer. LIVE only — there is no paper Wish here; paper lives on the Testing page.</div>',
      g.ok ? '' : blockPill(g.why),
      '</div></div>',
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Wish positions</h2><div class="sp"></div><span class="muted" style="font-size:13px">timer per bag</span></div>',
      '<div class="bd flush"><table><thead><tr><th>Coin</th><th class="num">Entry</th><th class="num">Now</th><th class="num">P&amp;L</th><th>Sell timer</th><th class="num">Off peak</th><th></th></tr></thead><tbody>' +
      (posRows || '<tr><td colspan="7" class="muted">No Wish bags open.</td></tr>') + '</tbody></table></div></div>',
      '<div class="card"><div class="hd"><h2>Recent Wish trades</h2><div class="sp"></div></div>',
      '<div class="bd flush"><table><thead><tr><th>When</th><th>Side</th><th>Coin</th><th class="num">$</th><th class="num">P&amp;L</th><th>Why</th></tr></thead><tbody>' +
      (hist || '<tr><td colspan="6" class="muted">No Wish trades yet.</td></tr>') + '</tbody></table></div></div>',
      '</div>'
    ].join('');
  };
  P.wish.after = function () { PD.hydrateSparks('sol'); };

  /* ============================== MOONSHOT ============================== */
  P.moon = function (st) {
    const m = st.moon || {};
    const g = PD.gate().moon;
    const pos = m.positions || [];
    const pool = (st.moon_pool || []);
    const posRows = pos.map(function (p) {
      return '<tr><td><div class="coin"><span class="tick">' + E(PD.shortSym(p.symbol).slice(0, 3)) + '</span>' + E(PD.shortSym(p.symbol)) + '</div></td>' +
        '<td class="num">' + M(p.entry, 6) + '</td><td class="num">' + M(p.price, 6) + '</td>' +
        '<td class="num ' + CLS(p.unrealized_pnl) + '">' + PD.signed(p.unrealized_pnl) + '</td>' +
        '<td class="num">' + (p.peak_gain === undefined ? '—' : PCT(p.peak_gain)) + '</td>' +
        '<td class="num ' + CLS(p.change_24h) + '">' + PCT(p.change_24h) + '</td>' +
        '<td><div class="acts"><button class="btn xs" data-a="chart" data-s="' + E(p.symbol) + '" data-t="' + E(PD.shortSym(p.symbol)) + '">chart</button>' +
        '<button class="btn xs" data-a="moon.sell" data-s="' + E(p.symbol) + '">sell</button></div></td></tr>';
    }).join('');
    const byRegime = m.by_regime || {}, bySession = m.by_session || {};
    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Moon book', M(m.equity), 'cash ' + M(m.cash)),
      stat('Day P&L', '<span class="' + CLS(m.day_pnl) + '">' + PD.signed(m.day_pnl) + '</span>', 'closed ' + PD.signed(m.closed_pnl)),
      stat('Record', (m.wins || 0) + 'W / ' + ((m.trades || 0) - (m.wins || 0)) + 'L', 'trades ' + (m.trades || 0)),
      stat('Style', E(m.style || st.moonshot_mode || '—'), m.measure_only ? 'measure-only mode' : 'trading active'),
      '</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Engine</h2><div class="sp"></div>',
      livePill(m.running, m.mode === 'LIVE'), '<span class="tag">' + E(m.mode || 'OFF') + '</span>',
      '<select id="moonMode" onchange="PD.api(\'/api/moonshot/mode\',{method:\'POST\',body:{mode:this.value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Mode changed\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">' +
      '<option value="slicer"' + (st.moonshot_mode === 'slicer' ? ' selected' : '') + '>slicer — take +27% and step off</option>' +
      '<option value="rider"' + (st.moonshot_mode === 'rider' ? ' selected' : '') + '>rider — trail the whole moon</option></select>',
      '<button class="btn sm ' + (m.running ? 'stop' : 'go') + '" data-a="' + (m.running ? 'moon.stop' : 'moon.start') + '"' + (g.ok ? '' : ' disabled title="' + E(g.why) + '"') + '>' + (m.running ? 'Stop Moonshot' : 'Start Moonshot') + '</button>',
      '</div><div class="bd">',
      '<div class="note">Buys pullbacks inside big 24h pumps (+20%…+150%, $500k+ volume), <b>$2–$5 tickets</b>, max 5 open. ' +
      '<b>Slicer:</b> −12% stop · +27.5% take · trail 8% after +20% · 6h max hold. <b>Rider:</b> −15% stop until +30%, then breakeven lock and a 10% trail, no take, no time stop. Daily halt −15%.</div>',
      m.halted ? '<div class="note bad" style="margin-top:12px">Halted: ' + E(m.halt_reason || 'daily halt') + '</div>' : '',
      g.ok ? '' : blockPill(g.why),
      '<div class="grid g2" style="margin-top:14px">',
      '<div><div class="k" style="font-size:13px;font-weight:600;color:var(--secondary);margin-bottom:6px">By regime</div>' +
      Object.keys(byRegime).map(k => kv(k, (byRegime[k].trades || 0) + ' trades · <span class="' + CLS(byRegime[k].pnl) + '">' + PD.signed(byRegime[k].pnl) + '</span>')).join('') + '</div>',
      '<div><div class="k" style="font-size:13px;font-weight:600;color:var(--secondary);margin-bottom:6px">By session</div>' +
      Object.keys(bySession).map(k => kv(k, (bySession[k].trades || 0) + ' trades · <span class="' + CLS(bySession[k].pnl) + '">' + PD.signed(bySession[k].pnl) + '</span>')).join('') + '</div>',
      '</div></div></div>',
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Positions</h2></div><div class="bd flush">' +
      '<table><thead><tr><th>Coin</th><th class="num">Entry</th><th class="num">Now</th><th class="num">P&amp;L</th><th class="num">Peak</th><th class="num">24h</th><th></th></tr></thead><tbody>' +
      (posRows || '<tr><td colspan="7" class="muted">No moonshot positions.</td></tr>') + '</tbody></table></div></div>',
      '<div class="card"><div class="hd"><h2>Pump watch</h2><div class="sp"></div><span class="pill">' + pool.length + ' candidates</span></div><div class="bd flush">' +
      '<table><thead><tr><th>Coin</th><th class="num">24h</th><th class="num">Volume</th><th></th></tr></thead><tbody>' +
      (pool.slice(0, 10).map(p => '<tr><td>' + E(PD.shortSym(p.symbol)) + '</td><td class="num ' + CLS(p.change_24h) + '">' + PCT(p.change_24h) + '</td>' +
        '<td class="num">' + M(p.volume_usd, 0) + '</td><td><div class="acts"><button class="btn xs" data-a="chart" data-s="' + E(p.symbol) + '" data-t="' + E(PD.shortSym(p.symbol)) + '">chart</button></div></td></tr>').join('')
        || '<tr><td colspan="4" class="muted">Scanning while running…</td></tr>') + '</tbody></table></div></div>',
      '</div>'
    ].join('');
  };

  /* ============================== ALPHA ============================== */
  P.alpha = function (st) {
    const s = st.sol || {};
    const g = PD.gate().alpha;
    const gd = st.guards || {};
    const pos = s.positions || [];
    const pool = st.sol_pool || [];
    const posRows = pos.map(function (p) {
      return '<tr><td><div class="coin"><span class="tick">' + E((p.symbol || '').slice(0, 3)) + '</span>' + E(p.symbol) + '</div></td>' +
        '<td>' + (p.opened_at ? CLOCK(p.opened_at) : '—') + '</td>' +
        '<td><span class="tmr" data-since="' + (p.opened_at || 0) + '">…</span></td>' +
        '<td class="num">' + M(p.entry, 8) + '</td><td class="num">' + M(p.price, 8) + '</td>' +
        '<td class="num ' + CLS(p.unrealized_pnl) + '">' + PD.signed(p.unrealized_pnl) + '</td>' +
        '<td class="num">' + (p.trail_pct === undefined ? '—' : N(p.trail_pct, 0) + '%') + '</td>' +
        '<td><div class="acts">' +
        '<button class="btn xs" data-a="chart" data-s="' + E(p.mint) + '" data-src="sol" data-t="' + E(p.symbol) + '">chart</button>' +
        '<button class="btn xs" data-a="alpha.sell" data-m="' + E(p.mint) + '">sell</button>' +
        '<button class="btn xs" data-a="alpha.ban" data-m="' + E(p.mint) + '" data-s="' + E(p.symbol) + '">ban</button></div></td>' +
        '<td data-spkmint="' + E(p.mint) + '"></td></tr>';
    }).join('');
    const poolRows = pool.slice(0, 10).map(function (p) {
      const mint = E(p.mint), nm = E(p.symbol);
      const open = 'data-a="chart" data-s="' + mint + '" data-src="sol" data-t="' + nm + '" title="open the chart"';
      return '<tr><td class="clk" ' + open + '><div class="coin"><span class="tick">' + nm.slice(0, 3) + '</span>' + nm + '</div></td>' +
        '<td class="num">' + N(p.age_min, 0) + 'm</td><td class="num">' + M(p.liquidity_usd, 0) + '</td>' +
        '<td class="num ' + CLS(p.change_24h) + '">' + PCT(p.change_24h) + '</td>' +
        '<td class="num">' + (p.rank === undefined ? '—' : N(p.rank, 1)) + '</td>' +
        '<td class="clk" ' + open + ' data-spkmint="' + mint + '"></td>' +
        '<td><div class="acts"><button class="btn xs" data-a="alpha.ban" data-m="' + mint + '" data-s="' + nm + '">ban</button></div></td></tr>';
    }).join('');
    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('On-chain now', M(s.equity), 'gas ' + N(s.gas_sol, 4) + ' SOL'),
      stat('Net vs deposits', '<span class="' + CLS(s.net_pnl) + '">' + PD.signed(s.net_pnl) + '</span>',
        '<span class="click" style="text-decoration:underline" data-a="deposited" data-v="' + (s.deposited || 0) + '">deposited ' + M(s.deposited) + '</span>'),
      stat('Since midnight', '<span class="' + CLS(s.day_pnl) + '">' + PD.signed(s.day_pnl) + '</span>', 'closed ' + PD.signed(s.closed_pnl)),
      stat('Record', (s.wins || 0) + 'W / ' + ((s.trades || 0) - (s.wins || 0)) + 'L', 'trades ' + (s.trades || 0)),
      '</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Engine</h2><div class="sp"></div>',
      livePill(s.running, true), '<span class="tag">' + E(s.mode || 'OFF') + '</span>',
      '<select onchange="PD.api(\'/api/solana/mode\',{method:\'POST\',body:{mode:this.value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Mode changed\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">' +
      '<option value="moon"' + (st.solana_mode === 'moon' ? ' selected' : '') + '>moon rider</option>' +
      '<option value="fresh"' + (st.solana_mode === 'fresh' ? ' selected' : '') + '>fresh sniper</option></select>',
      '<select onchange="PD.api(\'/api/solana/exit\',{method:\'POST\',body:{style:this.value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Exit style changed\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">' +
      '<option value="adaptive"' + (st.solana_exit_style === 'adaptive' ? ' selected' : '') + '>adaptive ladder</option>' +
      '<option value="trail"' + (st.solana_exit_style === 'trail' ? ' selected' : '') + '>full trail</option>' +
      '<option value="simple"' + (st.solana_exit_style === 'simple' ? ' selected' : '') + '>simple fixed</option></select>',
      '<button class="btn sm ' + (s.running ? 'stop' : 'go') + '" data-a="' + (s.running ? 'alpha.stop' : 'alpha.start') + '"' + (g.ok ? '' : ' disabled title="' + E(g.why) + '"') + '>' + (s.running ? 'Stop Alpha' : 'Start Alpha') + '</button>',
      '<button class="btn sm" data-a="alpha.reclaim">♻ Reclaim rent</button>',
      ((s.halted) ? '<button class="btn sm stop" data-a="alpha.halt">Clear daily halt</button>' : ''),
      '</div><div class="bd">',
      (s.halted ? '<div class="note bad" style="margin-bottom:12px">Halted: ' + E(s.halt_reason || '') + '</div>' : ''),
      g.ok ? '' : blockPill(g.why),
      '<div class="grid g3">',
      kv('Session filter', '<label class="ck"><input type="checkbox" ' + (gd.session_filter ? 'checked' : '') + ' onchange="PD.api(\'/api/guards\',{method:\'POST\',body:{guards:{session_filter:this.checked}}}).then(()=>PD.refresh(true))"> ' + N(gd.session_start_hour, 0) + ':00 → ' + N(gd.session_end_hour, 0) + ':00 UTC</label>'),
      kv('Regime sizing', '<label class="ck"><input type="checkbox" ' + (gd.regime_switch ? 'checked' : '') + ' onchange="PD.api(\'/api/guards\',{method:\'POST\',body:{guards:{regime_switch:this.checked}}}).then(()=>PD.refresh(true))"> ' + E((s.regime && s.regime.level) || 'auto') + '</label>'),
      kv('Pause buys', '<label class="ck"><input type="checkbox" ' + (gd.trading_pause ? 'checked' : '') + ' onchange="PD.api(\'/api/guards\',{method:\'POST\',body:{guards:{trading_pause:this.checked}}}).then(()=>PD.refresh(true))"> manage only, open nothing new</label>'),
      '</div></div></div>',
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Alpha positions</h2></div><div class="bd flush">',
      '<table><thead><tr><th>Coin</th><th>Bought</th><th>Running</th><th class="num">Entry</th><th class="num">Now</th><th class="num">P&amp;L</th><th class="num">Trail</th><th></th><th>7d</th></tr></thead><tbody>' +
      (posRows || '<tr><td colspan="9" class="muted">No open alpha coins.</td></tr>') + '</tbody></table></div></div>',
      '<div class="card"><div class="hd"><h2>Candidates</h2><div class="sp"></div><span class="pill">' + pool.length + ' found</span></div><div class="bd flush">',
      '<table><thead><tr><th>Coin</th><th class="num">Age</th><th class="num">Liquidity</th><th class="num">24h</th><th class="num">Rank</th><th></th></tr></thead><tbody>' +
      (poolRows || '<tr><td colspan="6" class="muted">Scanning while running…</td></tr>') + '</tbody></table></div></div>',
      '</div>'
    ].join('');
  };
  P.alpha.after = function () { PD.hydrateSparks('sol'); };

  /* ============================== FOLLOWS ============================== */
  /* The long game: what the scanner has learned across runs, not just now. */
  function trackingCard(f, trackedRows) {
    const t = (f && f.tracking) || null;
    if (!t) return '';
    const days = t.since ? (Date.now() / 1000 - t.since) / 86400 : 0;
    return '<div class="grid g4" style="margin-bottom:16px">' +
      stat('Collecting since', days < 1 ? 'today' : N(days, 1) + ' days', N(t.scans_recorded, 0) + ' scans recorded') +
      stat('Wallets tracked', N(t.tracked_wallets, 0), N(t.seen_more_than_once, 0) + ' seen more than once') +
      stat('Ever passed', N(t.ever_passed, 0), 'kept coming back as copyable') +
      stat('Average copy result', '<span class="' + CLS(t.avg_sim_pct_passed) + '">' +
        (t.avg_sim_pct_passed === null || t.avg_sim_pct_passed === undefined ? '—' : PCT(t.avg_sim_pct_passed)) + '</span>',
        'wallets that passed · all wallets ' + (t.avg_sim_pct_all === null || t.avg_sim_pct_all === undefined ? '—' : PCT(t.avg_sim_pct_all))) +
      '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Wallets that keep passing</h2><div class="sp"></div>' +
      '<span class="muted" style="font-size:13px">the actual shortlist as it builds over days</span></div>' +
      '<div class="bd flush"><table><thead><tr><th>Wallet</th><th class="num">Times passed</th><th class="num">Scans seen</th>' +
      '<th class="num">Best score</th><th>Coins</th><th class="num">Copy avg</th><th class="num">Trips observed</th><th>First seen</th></tr></thead><tbody>' +
      ((trackedRows && trackedRows.length) ? trackedRows.map(function (r) {
        return '<tr><td class="mono" style="font-size:12.5px">' + E(r.wallet.slice(0, 8)) + '…' + E(r.wallet.slice(-4)) + '</td>' +
          '<td class="num"><b>' + r.pass_count + '</b></td><td class="num">' + r.scans_seen + '</td>' +
          '<td class="num">' + N(r.best_score, 0) + '</td>' +
          '<td>' + E((r.coins || []).slice(0, 3).join(', ')) + '</td>' +
          '<td class="num ' + CLS(r.sim_avg_pct) + '">' + (r.sim_avg_pct === null || r.sim_avg_pct === undefined ? '—' : PCT(r.sim_avg_pct)) + '</td>' +
          '<td class="num">' + (r.sim_trips || 0) + '</td>' +
          '<td class="muted">' + E(PD.ts(r.first_seen)) + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="muted">Nobody has passed twice yet — the registry is still filling. Check back after a few scans.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="bd"><div class="note">This is the "collect data first" plan working: every scan folds into a registry that survives restarts, ' +
      'so in a few days you will know which wallets <b>kept</b> looking copyable instead of judging one lucky snapshot. ' +
      'The registry keeps a 7-day window and never leaves this machine.</div></div></div>';
  }

  /* On/off for the Follows paper engine, right on its own page.
     Start is per-engine; stop is per-engine too (controller.stop_tournament
     takes a comma list), so switching Follows off never kills another test. */
  function followControls(f) {
    const t = S.tournament || {};
    const row = ((t.engines || []).filter(e => e.engine === 'follows')[0]) || {};
    const running = !!row.running;
    const has = row.started !== false && row.start_equity !== undefined;
    return '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Follows engine</h2><div class="sp"></div>' +
      (running ? '<span class="pill paper"><span class="led"></span>running paper</span>'
        : '<span class="pill off"><span class="led"></span>stopped</span>') +
      '<button class="btn sm ' + (running ? 'stop' : 'go') + '" onclick="PD.state.followToggle(' + (running ? 'false' : 'true') + ')">' +
      (running ? 'Stop Follows' : 'Start Follows (paper)') + '</button></div>' +
      '<div class="bd"><div class="grid g4">' +
      stat('Equity', M(row.equity), 'paper stake ' + M(row.start_equity || 100)) +
      stat('Return', '<span class="' + CLS(row.return_pct) + '">' + PCT(row.return_pct) + '</span>', 'cash ' + M(row.cash)) +
      stat('Open copies', String(row.open_count || 0), 'of 5 allowed · $5 each, $10 cap') +
      stat('Trades', String(row.trades || 0), (row.wins || 0) + 'W / ' + (row.losses || 0) + 'L · costs ' + M(row.costs_paid)) +
      '</div>' +
      '<div class="note" style="margin-top:12px">' + (running
        ? 'Mirroring the wallets the finder passes. It is <b>paper money</b> — no order is ever placed, no wallet is touched.'
        : (has ? 'Stopped. Its $100 paper book is kept and resumes where it left off.'
          : 'Never run yet. Starting it opens a fresh $100 paper book.')) +
      ' Live trading is a separate, unimplemented path.</div>' +
      '</div></div>';
  }
  S.followToggle = function (on) {
    const path = on ? '/api/tournament/start' : '/api/tournament/stop';
    const body = { engine: 'follows' };
    if (on && !window.confirm('Start the Follows mirror in PAPER mode?\n\n$100 paper stake, $5 per copy, honest costs. No real orders.')) return;
    if (!on && !window.confirm('Stop the Follows paper run?\n\nIts book is kept. Other paper tests keep running.')) return;
    PD.api(path, { method: 'POST', body: body }).then(function (r) {
      if (r && r.ok === false) { PD.toast(r.error || 'Refused', 'bad'); return; }
      PD.toast(on ? 'Follows started (paper)' : 'Follows stopped', 'good');
      PD.refreshTournament();
    });
  };

  P.follows = function () {
    const f = S.follows;
    const cands = (f && f.candidates) || [];
    const rejects = (f && f.rejects) || [];
    const passing = cands.filter(c => c.verdict === 'pass');
    const trackedRows = (f && f.leaders) || [];

    const sim = c => {
      const s2 = c.sim || {};
      if (!s2.round_trips) return '<span class="muted">no round trip yet</span>';
      return s2.round_trips + ' trips · <span class="' + CLS(s2.avg_pct) + '">' + PCT(s2.avg_pct) + '</span> each · net ' +
        '<span class="' + CLS(s2.net_usd) + '">' + PD.signed(s2.net_usd) + '</span>';
    };
    /* The cost wall: at a $5 ticket the fixed costs alone (2 swaps of gas +
       rent) are ~6% and slippage at 3% a side is another 6%, so a copied
       trader must beat roughly +12% a round trip just to break even. */
    const withSim = cands.filter(c => c.sim && c.sim.round_trips);
    const losing = withSim.filter(c => c.sim.net_usd < 0).length;
    const costWall = '<div class="note bad" style="margin-bottom:16px"><b>The cost wall — read this before wanting the engine built.</b> ' +
      'On a <b>$5</b> copy the fixed costs are brutal: $0.05 gas twice plus $0.20 rent is <b>6%</b> of the ticket, and 3% slippage a side is another <b>6%</b>. ' +
      'A trader has to beat roughly <b>+12% per round trip</b> before a single cent is profit. ' +
      (withSim.length ? 'Of the ' + withSim.length + ' candidates with a completed trip, <b>' + losing + '</b> would have lost money at $5 a copy — including the current top scorer. ' : '') +
      'That is the honest state of copying $5 tickets on thin memecoin pools, and it is why this stays paper until the numbers say otherwise.</div>';
    const rows = cands.map(function (c) {
      const tag = c.verdict === 'pass' ? 'buy' : '';
      return '<tr><td class="mono" style="font-size:12.5px">' + E(c.wallet.slice(0, 8)) + '…' + E(c.wallet.slice(-4)) + '</td>' +
        '<td><b>' + E(c.coin || '—') + '</b></td>' +
        '<td class="num">' + c.buys + ' / ' + c.sells + '</td>' +
        '<td class="num">' + c.round_trips + '</td>' +
        '<td class="num">' + M(c.volume_usd) + '</td>' +
        '<td class="num">' + (c.idle_min === null ? '—' : N(c.idle_min, 0) + 'm') + '</td>' +
        '<td>' + sim(c) + '</td>' +
        '<td class="num"><b>' + N(c.score, 0) + '</b></td>' +
        '<td><span class="tag ' + tag + '">' + E(c.verdict) + '</span></td></tr>';
    }).join('');

    const rejectRows = rejects.slice(0, 8).map(function (c) {
      return '<div class="rowline"><span class="t mono" style="font-size:12.5px">' + E(c.wallet.slice(0, 8)) + '…</span>' +
        '<span class="d">' + E((c.why || []).join('; ')) + '</span>' +
        '<span class="tag">' + E(c.coin || '') + '</span></div>';
    }).join('');

    return [
      followControls(f),

      '<div class="note" style="margin-bottom:16px"><b>The finder is live and reading real market data.</b> ' +
      'A scanner runs every 15 minutes against public market data, groups recent trades by wallet, throws out the wallets you ruled out ' +
      '(creators who only sell, dust, idle, one-sided) and simulates copying the survivors at <b>$5 a copy with a $10 cap</b> and honest costs. ' +
      'The mirror engine is <b>paper only</b>: it reads the tape this scanner publishes and cannot place an order.</div>',

      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Finding wallets', f && f.ok ? '<span class="up">running</span>' : 'waiting', f && f.ok ? 'last scan ' + PD.ago(f.generated_at) : 'no scan published yet'),
      stat('Candidates', String(cands.length), passing.length + ' pass · ' + (cands.length - passing.length) + ' watch'),
      stat('Scan depth', f ? N(f.trades_seen, 0) : '—', f ? N(f.wallets_seen, 0) + ' wallets in ' + f.scanned_pools + ' pools' : '—'),
      stat('Copy size', '$5 <span class="muted" style="font-size:15px">/ $10 cap</span>', 'fixed ticket — never a % of the wallet'),
      '</div>',

      costWall,

      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Candidates right now</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">' + (f ? E(f.generated_iso) : '') + ' · from public market data</span>',
      '<button class="btn sm" onclick="PD.state.followsAt=0;PD.pages.follows.after()">Rescan now</button></div>',
      '<div class="bd flush"><table><thead><tr><th>Wallet</th><th>Coin</th><th class="num">Buys / sells</th><th class="num">Round trips</th><th class="num">Volume</th><th class="num">Last trade</th><th>If you had copied it</th><th class="num">Score</th><th>Verdict</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9" class="muted">No candidates published yet — the scanner runs every 15 minutes.</td></tr>') + '</tbody></table></div>',
      '</div>',

      '<div class="grid g2" style="margin-bottom:16px">',
      '<div class="card"><div class="hd"><h2>Rejected, and why</h2><div class="sp"></div><span class="pill">' + rejects.length + ' thrown out</span></div>',
      '<div class="bd flush">' + (rejectRows || '<div class="rowline"><span class="d">Nothing rejected in the last scan.</span></div>') + '</div></div>',

      '<div class="card"><div class="hd"><h2>What still has to be built</h2><div class="sp"></div><span class="tag warn">engine</span></div><div class="bd">',
      kv('Mirror engine', 'he buys → we buy $5; he sells → we sell what we bought. Does not exist yet.'),
      kv('Exposure limits', 'max concurrent copies, per-wallet cap, daily loss stop — same rails as Alpha'),
      kv('AI ranking', 'the council ranks the shortlist instead of vetoing the field (needs the Phase 3 restart)'),
      kv('Paper first', 'runs as a paper book until you have watched it copy for a few days'),
      '<div class="note" style="margin-top:12px">Until the engine exists this page stays read-only. Discovering a good wallet is not the same as copying it, and I am not going to blur that.</div>',
      '</div></div>',
      '</div>',

      '<div class="card"><div class="hd"><h2>How a wallet gets picked</h2></div><div class="bd">',
      kv('Must', 'buy <b>and</b> sell in the window — at least ' + 2 + ' each'),
      kv('Must not', 'sell only (that is the coin creator or a bag dump), or be idle for more than 45 minutes'),
      kv('Bots', 'more than 40 trades in one window, or trading three pools at once — rejected as a bot or a router'),
      kv('Size filter', 'at least $40 of volume, so dust wallets do not waste a slot'),
      kv('Ranking', 'repeat round trips first, then freshness, then size, then balance between buys and sells'),
      kv('Copy maths', '3% slippage per side + $0.05 gas per swap + $0.20 rent per position, charged on every simulated trip'),
      '</div></div>',

      trackingCard(f, trackedRows),

      '<div class="note" style="margin-top:16px">' + E((f && f.note) || '') + '</div>'
    ].join('');
  };
  P.follows.after = function () {
    PD.refreshTournament();   // the on/off card reads its state from the scoreboard
    if (S.follows && S.followsAt && Date.now() - S.followsAt < 60000) return;
    PD.api('/static/follows-scan.json?t=' + Date.now()).then(function (r) {
      if (r && r.ok) { S.follows = r; S.followsAt = Date.now(); PD.mount(); }
      else PD.toast('No scan published yet', 'bad');
    });
  };

  /* ============================== COUNCIL ============================== */
  P.council = function (st) {
    const ai = st.ai_status || {};
    const cands = ai.candidates || [];
    const sel = st.ai_council_models || [];
    const chips = cands.map(function (c) {
      const on = sel.indexOf(c.id) >= 0;
      return '<button class="btn sm ' + (on ? 'primary' : '') + '" data-a="council.pick" data-id="' + E(c.id) + '" title="' + E(c.model) + '">' +
        E(c.label) + (c.online ? '' : ' <span class="tag sell">offline</span>') + '</button>';
    }).join(' ');
    const last = st.ai_last || {};
    const votes = (last.votes || []);
    return [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Council', st.ai_assist ? '<span class="up">on</span>' : '<span class="muted">off</span>', st.ai_assist ? 'voting before buys' : 'core strategy only'),
      stat('Voters', sel.length + ' / ' + (ai.max || 7), 'odd numbers give a majority'),
      stat('Models discovered', String((ai.models || []).length), 'provider ' + E(ai.provider || '—')),
      stat('Debate', st.settings && st.settings.council_debate ? 'on' : 'on', 'council can veto or shrink — never invent a buy'),
      '</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Voters</h2><div class="sp"></div>',
      '<button class="btn sm" data-a="council.refresh">Refresh models</button>',
      '<button class="btn sm ' + (st.ai_assist ? 'stop' : 'go') + '" data-a="council.on" data-on="' + (st.ai_assist ? '0' : '1') + '">' + (st.ai_assist ? 'Turn council off' : 'Turn council on') + '</button>',
      '</div><div class="bd">',
      '<div class="note" style="margin-bottom:12px">Tap a model to add or remove it. The cap is <b>7</b> and it is enforced by the server — the server also ignores any custom maximum, so there is no max field here to lie to you.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' + (chips || '<span class="muted">No models discovered yet — press Refresh models.</span>') + '</div>',
      '<div class="note" style="margin-top:14px">Local engines (Ollama, LM Studio) are deliberately absent: this desk has no GPU and they were never configured.</div>',
      '</div></div>',
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Last vote</h2><div class="sp"></div><span class="pill">' + (votes.length ? votes.length + ' voters' : 'no vote yet') + '</span></div><div class="bd flush">',
      votes.length ? votes.map(function (v) {
        const yes = v.vote === true || v.vote === 'yes' || v.yes === true;
        return '<div class="rowline"><span class="t">' + E(v.model || v.id || 'voter') + '</span>' +
          '<span class="d">' + E(v.reason || v.note || '') + '</span>' +
          '<span class="tag ' + (yes ? 'buy' : 'sell') + '">' + (yes ? 'YES' : 'NO') + '</span></div>';
      }).join('') : '<div class="rowline"><span class="d">No vote recorded yet.</span></div>',
      '</div></div>',
      '<div class="card"><div class="hd"><h2>How it decides</h2></div><div class="bd">',
      kv('Job', 'veto or shrink the core strategy\'s pick'),
      kv('Never', 'invents a buy from social buzz, never replaces the strategy'),
      kv('Weight', 'the advisor can pin a strategy at the 0.8 floor when its expectancy is negative'),
      kv('Blind spot', 'if a voter is down the desk still trades'),
      '</div></div></div>'
    ].join('');
  };

  /* ============================== EXCHANGES ============================== */
  P.exchanges = function (st) {
    const ex = S.exchanges;
    if (!ex || !ex.ok) return '<div class="loading">Loading venues…</div>';
    const cur = ex.current || {};
    const exw = (st && st.books && st.books.exchange_wallet) || {};
    const rw = (st && st.books && st.books.real_wallet) || {};
    const tiles = '<div class="sq" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
      tile('KuCoin', M(exw.total_usd), (exw.ok ? 'USDT ' + M(exw.usdt) + ' · coins ' + M(exw.coin_value) : 'unavailable') + (cur.exchange === 'kucoin' ? ' · active' : ''), '', cur.exchange === 'kucoin' ? 'live' : '') +
      tile('Solana wallet', M(rw.equity_usd), N(rw.gas_sol, 4) + ' SOL gas · coins ' + M(rw.coins_usd), '', '') +
      tile('Profiles saved', String((ex.profiles || []).length), (ex.profiles || []).length ? 'keys stored on this desk' : 'no saved venue yet', '', '') +
      '</div>';

    const profiles = (ex.profiles || []).map(function (p) {
      return '<tr><td><b>' + E(p.label || p.exchange) + '</b>' + (p.active ? ' <span class="tag buy">active</span>' : '') + '</td>' +
        '<td>' + E(p.exchange) + '</td><td class="mono">' + E(p.api_key_masked || '—') + '</td>' +
        '<td>' + (p.has_secret ? '<span class="tag buy">secret</span>' : '<span class="tag">no secret</span>') + '</td>' +
        '<td>' + (p.updated_at ? PD.ts(p.updated_at) : '—') + '</td>' +
        '<td><div class="acts">' + (p.active ? '' : '<button class="btn xs" data-a="ex.use" data-id="' + E(p.id) + '">Use</button>') +
        '<button class="btn xs stop" data-a="ex.del" data-id="' + E(p.id) + '">Delete</button></div></td></tr>';
    }).join('');

    const pop = (ex.popular || []).map(function (p) {
      return '<option value="' + E(p.id) + '"' + (cur.exchange === p.id ? ' selected' : '') + '>' + E(p.label) + (p.needs_password ? ' (needs passphrase)' : '') + '</option>';
    }).join('');

    return [
      '<div class="note" style="margin-bottom:16px">The desk has <b>one real KuCoin wallet</b> and <b>one real Solana wallet</b>. Core, Wish, Moonshot and Alpha keep separate <i>ledgers</i> over those wallets — a book is not extra money.</div>',
      tiles,
      '<div class="card" style="margin:16px 0"><div class="hd"><h2>Saved venues</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">active: ' + E(cur.label || cur.exchange || '—') + '</span></div>',
      '<div class="bd flush"><table><thead><tr><th>Label</th><th>Venue</th><th>API key</th><th>Secret</th><th>Updated</th><th></th></tr></thead><tbody>' +
      (profiles || '<tr><td colspan="6" class="muted">No saved profiles — the desk is using the keys in .env.</td></tr>') + '</tbody></table></div></div>',
      '<div class="card"><div class="hd"><h2>Add a venue</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">keys are stored on this desk and never shown again</span></div><div class="bd">',
      '<div class="grid g3">',
      '<label class="k" style="font-size:13px;color:var(--secondary)">Venue<select id="exSel" style="width:100%;margin-top:5px">' + pop + '</select></label>',
      '<label class="k" style="font-size:13px;color:var(--secondary)">Label<input type="text" id="exLabel" placeholder="My Binance" style="width:100%;margin-top:5px"></label>',
      '<label class="k" style="font-size:13px;color:var(--secondary)">API key<input type="password" id="exKey" placeholder="key" style="width:100%;margin-top:5px"></label>',
      '<label class="k" style="font-size:13px;color:var(--secondary)">API secret<input type="password" id="exSecret" placeholder="secret" style="width:100%;margin-top:5px"></label>',
      '<label class="k" style="font-size:13px;color:var(--secondary)">Passphrase (KuCoin/OKX/Bitget)<input type="password" id="exPass" placeholder="if needed" style="width:100%;margin-top:5px"></label>',
      '</div>',
      '<div style="display:flex;gap:8px;margin-top:14px">',
      '<button class="btn sm primary" onclick="PD.state.exPick=document.getElementById(\'exSel\').value;PD.api(\'/api/exchanges/save\',{method:\'POST\',body:{exchange:PD.state.exPick,label:document.getElementById(\'exLabel\').value,api_key:document.getElementById(\'exKey\').value,api_secret:document.getElementById(\'exSecret\').value,api_password:document.getElementById(\'exPass\').value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Venue saved\',r.ok===false?\'bad\':\'good\');PD.refreshExchanges()})">Save profile</button>',
      '<button class="btn sm" onclick="PD.api(\'/api/exchanges/test\',{method:\'POST\',body:{exchange:document.getElementById(\'exSel\').value}}).then(r=>PD.toast(r.ok===false?r.error:\'Venue reachable\',r.ok===false?\'bad\':\'good\'))">Test markets</button>',
      '</div>',
      '<div class="note" style="margin-top:14px">Saving a profile does <b>not</b> switch the desk to it — press <b>Use</b> on the row. Switching venues while Core or Wish is live will be refused by the desk.</div>',
      '</div></div>'
    ].join('');
  };

  /* ============================== STRATEGIES ============================== */
  P.strategies = function () {
    const r = S.strategies;
    if (!r || !r.ok) return '<div class="loading">Loading strategy stats…</div>';
    const rows = r.rows || [];
    const body = rows.map(function (s, i) {
      const edge = s.rated ? '<span class="' + CLS(s.expectancy_pct) + '">' + PCT(s.expectancy_pct) + '</span> <span class="muted">/ trade</span>' : '<span class="muted">needs ' + r.min_sample + ' closes</span>';
      return '<tr><td class="muted">' + (i + 1) + '</td><td><b>' + E(s.label) + '</b><div class="muted" style="font-size:12.5px;margin-top:3px">' + E(s.when || '') + '</div></td>' +
        '<td class="num">' + s.trades + '</td><td class="num">' + s.wins + '</td><td class="num">' + (s.trades - s.wins) + '</td>' +
        '<td class="num">' + N(s.win_rate, 1) + '%</td>' +
        '<td class="num ' + CLS(s.pnl) + '">' + PD.signed(s.pnl) + '</td>' +
        '<td class="num">' + N(s.weight, 2) + '</td>' +
        '<td class="num">' + edge + '</td></tr>';
    }).join('');
    const cards = rows.map(function (s) {
      return '<div class="card" style="margin-bottom:12px"><div class="hd"><h2>' + E(s.label) + '</h2><div class="sp"></div>' +
        '<span class="tag">' + s.trades + ' trades</span>' +
        '<span class="tag ' + (s.rated ? (s.pnl > 0 ? 'buy' : 'sell') : '') + '">' + (s.rated ? PCT(s.expectancy_pct) + ' per trade' : 'unrated') + '</span></div>' +
        '<div class="bd"><div class="grid g3">' +
        '<div><div class="muted" style="font-size:12px;font-weight:600">WHEN</div><div style="margin-top:4px">' + E(s.when || '—') + '</div></div>' +
        '<div><div class="muted" style="font-size:12px;font-weight:600">LOOK FOR</div><div style="margin-top:4px">' + E(s.look_for || '—') + '</div></div>' +
        '<div><div class="muted" style="font-size:12px;font-weight:600">AVOID</div><div style="margin-top:4px">' + E(s.avoid || '—') + '</div></div>' +
        '</div></div></div>';
    }).join('');
    return [
      '<div class="grid g3" style="margin-bottom:16px">',
      stat('Strategies', String(rows.length), 'all of them, always'),
      stat('Rated', String(rows.filter(s => s.rated).length), 'needs ' + r.min_sample + ' closed trades'),
      stat('Adaptive weighting', r.adaptive ? 'on' : 'off', 'weights move with your own results'),
      '</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Scoreboard</h2><div class="sp"></div><span class="muted" style="font-size:13px">core book</span></div>',
      '<div class="bd flush"><table><thead><tr><th>#</th><th>Strategy</th><th class="num">Trades</th><th class="num">Won</th><th class="num">Lost</th><th class="num">Win %</th><th class="num">P&amp;L</th><th class="num">Weight</th><th class="num">Edge</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>',
      cards
    ].join('');
  };

  /* ============================== RULES ============================== */
  const SAFETY_TOGGLES = [
    ['depth_check', 'Exit probe before buying', 'Simulates a sell before it buys, so a honeypot cannot trap the desk.'],
    ['ext_check', 'Read the mint account', 'Blocks frozen accounts, freeze authority and transfer hooks.'],
    ['fresh_partials', 'Bank ⅓ at +50% (fresh)', 'Takes a partial profit on fresh sniper positions.'],
    ['attention_exit', 'Exit when attention dies', 'Leaves when the volume that brought it in disappears.'],
    ['slot_pressure_exit', 'Flat coin yields its slot', 'A coin going nowhere gives its slot back.'],
    ['tail_breaker', 'Tail-event breaker', 'Halts fresh entries after a catastrophic loss.'],
    ['route_watch', 'Route-loss watch', 'Watches for pools that lose their route.'],
    ['rent_in_pnl', 'Count rent in P&L', 'ATA rent is money spent — it belongs in the numbers.']
  ];
  const SAFETY_NUMBERS = [
    ['fresh_min_age_min', 'Min coin age (min)', 1], ['fresh_min_liq_usd', 'Min liquidity ($)', 1000],
    ['max_h1_pump_pct', 'Max 1h pump (%)', 5], ['max_m5_pump_pct', 'Max 5m pump (%)', 5],
    ['depth_usd', 'Probe size ($)', 1], ['depth_min_return_pct', 'Probe min return (%)', 0.5],
    ['pool_drain_pct', 'Exit if pool drains (%)', 5], ['buy_slippage_bps', 'Max entry slippage (bps)', 50],
    ['min_ticket_rent_pct', 'Max rent as % of ticket', 1], ['attention_min_ratio', 'Attention floor (ratio)', 0.01],
    ['attention_after_hours', 'Attention after (h)', 0.5], ['flat_gain_pct', 'Flat exit gain (%)', 0.5],
    ['flat_after_hours', 'Flat after (h)', 0.5], ['tail_loss_pct', 'Tail breaker loss (%)', 5],
    ['tail_cooldown_hours', 'Tail cooldown (h)', 1], ['gas_reserve_sol', 'Gas reserve (SOL)', 0.001]
  ];
  P.rules = function (st) {
    const sf = S.safety;
    const gd = st.guards || {};
    const fs = st.fresh_safety || {};
    const s = (sf && sf.settings) || {};
    if (!sf || !sf.ok) return '<div class="loading">Loading rules…</div>';
    const toggles = SAFETY_TOGGLES.map(function (t) {
      return '<div class="rowline"><span class="t">' + E(t[1]) + '</span><span class="d">' + E(t[2]) + '</span>' +
        '<label class="ck"><input type="checkbox"' + (s[t[0]] ? ' checked' : '') +
        ' onchange="PD.api(\'/api/safety\',{method:\'POST\',body:{safety:{' + t[0] + ':this.checked}}}).then(r=>{PD.toast(r.ok===false?r.error:\'Saved\',r.ok===false?\'bad\':\'good\');PD.refreshSafety()})"></label></div>';
    }).join('');
    const numbers = SAFETY_NUMBERS.map(function (n) {
      return '<div class="kv"><span class="k">' + E(n[1]) + '</span><span class="v"><input type="number" step="' + n[2] + '" value="' + (s[n[0]] === undefined ? '' : s[n[0]]) + '" style="width:110px" ' +
        'onchange="PD.api(\'/api/safety\',{method:\'POST\',body:{safety:{' + n[0] + ':parseFloat(this.value)}}}).then(r=>{PD.toast(r.ok===false?r.error:\'Saved\',r.ok===false?\'bad\':\'good\');PD.refreshSafety()})"></span></div>';
    }).join('');
    const br = (sf && sf.breaker) || {};
    const rej = (sf && sf.rejections) || {};
    const floors = fs.floors || {};
    const gas = fs.gas || {};
    return [
      '<div class="note" style="margin-bottom:16px">These are the real switches the desk obeys. Everything on this page is read live from the running engine — nothing here is decoration.</div>',
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Fresh safety', fs.ok ? '<span class="up">green</span>' : '<span class="down">not green</span>', (fs.pause_until_green ? 'entries paused until green' : 'entries allowed')),
      stat('Tail breaker', br.active ? '<span class="down">tripped</span>' : '<span class="up">clear</span>', br.active ? (br.reason || '') : 'no catastrophic loss recorded'),
      stat('Floor ticket', M(floors.min_notional_usd), 'min liquidity ' + M(floors.min_liquidity_usd, 0)),
      stat('Gas reserve', N(gas.reserve_sol, 4) + ' SOL', 'Kucoin fee ' + N(gas.kucoin_fee_rate, 3)),
      '</div>',
      '<div class="grid g2" style="margin-bottom:16px">',
      '<div class="card"><div class="hd"><h2>Safety rails</h2><div class="sp"></div>',
      '<button class="btn sm stop" data-a="safety.trip">Pause fresh now</button>',
      br.active ? '<button class="btn sm" data-a="safety.reset">Clear breaker</button>' : '',
      '</div><div class="bd flush">' + toggles + '</div></div>',
      '<div class="card"><div class="hd"><h2>Numbers</h2><div class="sp"></div><span class="muted" style="font-size:13px">applies to on-chain entries</span></div>',
      '<div class="bd">' + numbers + '</div></div>',
      '</div>',
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Alpha guards</h2></div><div class="bd">',
      kv('Session window', N(gd.session_start_hour, 0) + ':00 → ' + N(gd.session_end_hour, 0) + ':00 UTC · ' + (gd.session_filter ? 'enforced' : 'always open')),
      kv('Regime override', E(gd.regime_override || 'auto')),
      kv('Trading pause', gd.trading_pause ? '<span class="down">buys paused</span>' : 'buys allowed'),
      '</div></div>',
      '<div class="card"><div class="hd"><h2>Refusals (last ' + N(rej.window_hours, 0) + 'h)</h2><div class="sp"></div><span class="pill">' + N(rej.total, 0) + ' total</span></div><div class="bd flush">',
      (rej.by_reason || []).length ? (rej.by_reason || []).map(function (r) {
        return '<div class="rowline"><span class="t">' + E(r.reason) + '</span><span class="d"></span><span class="v">' + r.count + '</span></div>';
      }).join('') : '<div class="rowline"><span class="d">Nothing refused in the window.</span></div>',
      '</div></div></div>',
      '<div class="card" style="margin-top:16px"><div class="hd"><h2>Honest limits</h2></div><div class="bd">',
      '<div class="note warn">The desk <b>advertises</b> a cross-venue mutex ("one live engine at a time") and even ships the guard function — but the guard is never called. ' +
      'What is really enforced: Core refuses to start while Wish or Moonshot is live; Moonshot refuses while Core or Wish is live; Wish and Alpha refuse each other. ' +
      '<b>Core (KuCoin) and Alpha (Solana) can run at the same time.</b> They spend different wallets, so it is survivable, but do not trust a "no conflict" badge — the status flags behind it are dead code.</div>',
      '</div></div>'
    ].join('');
  };

  /* ============================== ACTIVITY ============================== */
  /* Quarantine classification. /api/history does NOT annotate rows (only the
     status payloads do), so the rule sets are reproduced here verbatim from
     bot/quarantine.py — phantom bases, the phantom mint, and experiment styles. */
  const PHANTOM_BASES = ['STONK'];
  const PHANTOM_MINTS = ['6GMAFSYS4GK3FDAO5FZZYSQPPZAWSA4RUJHACPMPUNGX'];
  const EXPERIMENT_STYLES = ['stonk', 'phantom', 'experiment', 'experiment_only', 'grad', 'grad_momentum', 'grad_shadow'];
  function quarantineOf(r) {
    const sym = String(r.symbol || '').split('/')[0].toUpperCase();
    if (PHANTOM_BASES.indexOf(sym) >= 0) return 'phantom symbol';
    if (r.mint && PHANTOM_MINTS.indexOf(String(r.mint)) >= 0) return 'phantom mint';
    if (EXPERIMENT_STYLES.indexOf(String(r.style || '').toLowerCase()) >= 0) return 'experiment style';
    return '';
  }
  function bars(daily, big) {
    const d = (daily || []).slice(-21);
    if (!d.length) return '<div class="loading">No closed trades yet.</div>';
    const mx = Math.max.apply(null, d.map(x => Math.abs(Number(x.pnl) || 0)).concat([0.01]));
    const h = big ? 260 : 110;                     // the operator wanted these much bigger
    const scale = big ? h - 20 : 96;
    const kind = S.barKind || 'bar';
    if (kind === 'line') {
      const w = big ? 1000 : 900, pts = d.map(function (x, i) {
        const v = (Number(x.pnl) || 0) / mx;
        return (i / Math.max(1, d.length - 1) * w).toFixed(1) + ',' + ((h / 2) - v * (h / 2 - 12)).toFixed(1);
      }).join(' ');
      return '<div style="height:' + h + 'px"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">' +
        '<line x1="0" y1="' + (h / 2) + '" x2="' + w + '" y2="' + (h / 2) + '" stroke="#d8d8dd" stroke-width="1"/>' +
        '<polyline points="' + pts + '" fill="none" stroke="#3880f0" stroke-width="2"/></svg></div>' +
        '<div class="muted" style="font-size:12px;display:flex;justify-content:space-between;margin-top:4px">' +
        '<span>' + E(d[0].day) + '</span><span>peak ' + PD.signed(mx) + '</span><span>' + E(d[d.length - 1].day) + '</span></div>';
    }
    return '<div style="display:flex;align-items:flex-end;gap:' + (big ? 6 : 4) + 'px;height:' + h + 'px">' + d.map(function (x) {
      const v = Number(x.pnl) || 0;
      const bh = Math.max(3, Math.round(Math.abs(v) / mx * scale));
      const up = v >= 0;
      return '<div title="' + E(x.day) + ' · ' + PD.signed(v) + ' (' + x.closed + ' closed)" ' +
        'style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:' + h + 'px;cursor:pointer" ' +
        'onclick="PD.state.barKind=(PD.state.barKind===\'bar\'?\'line\':\'bar\');PD.mount()">' +
        (up ? '' : '<div style="height:' + (h - 14 - bh) + 'px"></div>') +
        '<div style="height:' + bh + 'px;border-radius:3px;background:' + (up ? 'var(--up)' : 'var(--down)') + ';opacity:.85"></div></div>';
    }).join('') + '</div>';
  }
  function bannedCard(st) {
    const syms = st.banned || [];
    const mints = st.banned_mints || [];
    const rows = syms.map(function (s) {
      return '<div class="rowline"><span class="t">' + E(PD.shortSym(s)) + '</span><span class="d">KuCoin — no new buys</span>' +
        '<button class="btn xs" data-a="unban" data-s="' + E(s) + '">unban</button></div>';
    }).join('') + mints.map(function (m) {
      const mint = typeof m === 'string' ? m : (m.mint || '');
      const label = typeof m === 'string' ? (m.slice(0, 10) + '…') : (m.symbol || (mint.slice(0, 10) + '…'));
      return '<div class="rowline"><span class="t">' + E(label) + '</span><span class="d">on-chain · ' + E(mint.slice(0, 14)) + '…</span>' +
        '<button class="btn xs" data-a="alpha.unban" data-m="' + E(mint) + '">unban</button></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Banned</h2><div class="sp"></div>' +
      '<span class="pill">' + (syms.length + mints.length) + ' banned</span></div><div class="bd flush">' +
      (rows || '<div class="rowline"><span class="d">Nothing banned. Ban removes a coin from buys — it does not sell it.</span></div>') +
      '</div></div>';
  }
  function backtestCard() {
    const b = S.backtest;
    if (!b || !b.ok || !b.result) {
      return '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Moon backtest</h2><div class="sp"></div>' +
        '<button class="btn sm" data-a="backtest.run">Run backtest</button></div><div class="bd">' +
        '<div class="note">Not loaded yet — it replays the Moonshot rules on real candles (~30 s, free APIs, no orders).</div></div></div>';
    }
    const r = b.result || {}, s2 = r.stats || {};
    return '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Moon backtest</h2><div class="sp"></div>' +
      '<span class="muted" style="font-size:13px">' + N(r.pools_tested, 0) + ' pools · ' + N(r.candles_fetched, 0) + ' candles</span>' +
      '<button class="btn sm" data-a="backtest.run">Run again</button></div><div class="bd">' +
      '<div class="grid g4" style="margin-bottom:12px">' +
      stat('Trades', String(s2.trades || 0), (s2.wins || 0) + 'W / ' + (s2.losses || 0) + 'L') +
      stat('Win rate', N(s2.win_rate, 1) + '%', 'avg hold ' + N(s2.avg_hold_hours, 1) + 'h') +
      stat('P&L', '<span class="' + CLS(s2.pnl) + '">' + PD.signed(s2.pnl) + '</span>', 'best ' + PD.signed(s2.best) + ' · worst ' + PD.signed(s2.worst)) +
      stat('Max drawdown', N(s2.max_drawdown, 1) + '%', 'replayed on paper') +
      '</div>' +
      (r.limits && r.limits.length ? '<div class="note">Limits found: ' + E(r.limits.join(' · ')) + '</div>' : '') +
      '</div></div>';
  }

  P.activity = function (st) {
    const h = S.history;
    const logs = (st.logs || []).slice(0, 80);
    const head = [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Closed P&L (ledger)', PD.signed(st.closed_pnl_ledger), 'every closed row, quarantine included'),
      stat('Realised', PD.signed(st.closed_pnl_realized), 'quarantined rows excluded: ' + PD.signed(st.closed_pnl_quarantined)),
      stat('Trades', String(st.trades || 0), (st.wins || 0) + 'W / ' + (st.losses || 0) + 'L · core'),
      stat('Win rate', N(st.win_rate, 1) + '%', 'core book'),
      '</div>'
    ];
    if (!h || !h.ok) return head.join('') + '<div class="loading">Loading the full history…</div>';

    const money = h.money || {}, tot = h.totals || {}, led = money.ledger || {};
    /* Never render the whole history at once: 20 rows, then load more, hard-capped. */
    const step = 20, cap = 200;
    const shown = Math.min(S.histLimit || step, cap);
    const all = (h.rows || []).slice(0, shown);
    const totalRows = (h.rows || []).length;
    const q = all.filter(r => quarantineOf(r));
    const clean = all.filter(r => !quarantineOf(r) && !r.reversed);

    const moneyBlock = [
      '<div class="grid g4" style="margin-bottom:16px">',
      stat('Deposited', M(money.deposited), 'click the Alpha page to correct it'),
      stat('Wallet now', M(money.equity), 'cash ' + M(money.cash) + ' · coins ' + M(money.coins_usd) + ' · gas ' + M(money.gas_usd)),
      stat('Net P&L', '<span class="' + CLS(money.net_pnl) + '">' + (money.net_pnl === null ? '—' : PD.signed(money.net_pnl)) + '</span>', 'wallet minus deposits'),
      stat('Realised (wallet view)', '<span class="' + CLS(money.closed_pnl) + '">' + PD.signed(money.closed_pnl) + '</span>', 'days: ' + PD.signed(money.day_pnl)),
      '</div>'
    ].join('');

    const rowHtml = function (r) {
      const why = quarantineOf(r);
      const slip = (r.slippage_pct === null || r.slippage_pct === undefined) ? '' :
        '<span title="expected ' + E(r.expected_price) + ' → filled ' + E(r.fill_price) + '">' + N(r.slippage_pct, 2) + '%</span>';
      return '<tr class="' + (why ? 'clk' : '') + '"' + (why ? ' style="opacity:.6"' : '') + '>' +
        '<td>' + E(PD.ts(r.ts).replace(',', '')) + '</td>' +
        '<td>' + E(r.engine_label || r.engine) + '</td>' +
        '<td><span class="tag ' + (r.side === 'BUY' ? 'buy' : 'sell') + '">' + E(r.side) + '</span></td>' +
        '<td>' + E(PD.shortSym(r.symbol)) + '</td>' +
        '<td class="num">' + N(r.amount, 4) + '</td><td class="num">' + N(r.price, 6) + '</td>' +
        '<td class="num">' + M(r.quote) + '</td>' +
        '<td class="num ' + CLS(r.pnl) + '">' + (r.pnl === null || r.pnl === undefined ? '—' : PD.signed(r.pnl)) + '</td>' +
        '<td class="num">' + slip + '</td>' +
        '<td>' + E(r.reason || '') + '</td><td>' + E(r.style || '') + '</td>' +
        '<td>' + (r.sig === 'paper' ? '<span class="tag paper">paper</span>' : (r.explorer ? '<a href="' + E(r.explorer) + '" target="_blank" rel="noopener">tx</a>' : '')) +
        (r.reversed ? ' <span class="tag warn">VOID</span>' : '') + (why ? ' <span class="tag warn">' + E(why) + '</span>' : '') + '</td></tr>';
    };

    const bk = function (obj, label) {
      const keys = Object.keys(obj || {});
      if (!keys.length) return '';
      return '<div><div class="muted" style="font-size:12px;font-weight:600;margin-bottom:6px">' + E(label) + '</div>' +
        keys.map(function (k) {
          const v = obj[k] || {};
          const pnl = v.pnl !== undefined ? v.pnl : v.closed_pnl_realized;
          return kv(k, (v.closed !== undefined ? v.closed + ' closed · ' : (v.trades !== undefined ? v.trades + ' trades · ' : '')) +
            '<span class="' + CLS(pnl) + '">' + PD.signed(pnl) + '</span>');
        }).join('') + '</div>';
    };

    const ledger = (led.entries || []).slice(-8).reverse().map(function (e) {
      return '<div class="rowline"><span class="t">' + E(PD.ts(e.ts)) + '</span><span class="d">' + E(e.note || '') + '</span>' +
        '<span class="v ' + CLS(e.usd) + '">' + PD.signed(e.usd) + '</span></div>';
    }).join('');

    return [
      head.join(''), moneyBlock,
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Daily closed P&amp;L</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">last 21 days · click a bar to switch bar/line</span>',
      '<button class="btn sm" onclick="PD.modal(\'Daily closed P&amp;L\',\'<div class=&quot;card&quot;><div class=&quot;bd&quot;>\'+PD.state.barsBig()+\'</div></div>\')">Enlarge</button></div>',
      '<div class="bd">' + bars(h.daily) + '</div></div>',

      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Every trade</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">showing ' + all.length + ' of ' + totalRows + ' loaded rows · ' + tot.closed + ' closed · slippage ' + M(tot.slippage_usd) + '</span>',
      (shown < Math.min(totalRows, cap) ? '<button class="btn sm" onclick="PD.state.histLimit=' + Math.min(shown + step, cap) + ';PD.mount()">Load 20 more</button>' : ''),
      (shown > step ? '<button class="btn sm" onclick="PD.state.histLimit=' + step + ';PD.mount()">Collapse</button>' : ''),
      '<button class="btn sm" data-a="csv">Download CSV</button>',
      '<button class="btn sm stop" data-a="flatten">FLATTEN everything</button></div>',
      '<div class="bd flush"><table><thead><tr><th>When</th><th>Engine</th><th>Side</th><th>Coin</th><th class="num">Amount</th><th class="num">Price</th><th class="num">$</th><th class="num">P&amp;L</th><th class="num">Slip</th><th>Why</th><th>Key</th><th></th></tr></thead><tbody>' +
      (all.map(rowHtml).join('') || '<tr><td colspan="12" class="muted">No trades yet.</td></tr>') + '</tbody></table></div>',
      '<div class="bd"><div class="note">The desk\'s history API does not label quarantined rows, so this page reproduces the same rules the engine uses ' +
      '(phantom symbol/mint, experiment styles) and dims them. ' + q.length + ' of the ' + all.length + ' loaded rows are quarantined. ' +
      '<b>Totals always cover the whole history</b> — the row limit only trims what is listed.</div></div></div>',

      '<div class="grid g3" style="margin-bottom:16px">',
      '<div class="card"><div class="hd"><h2>By engine</h2></div><div class="bd">' + (bk(h.by_engine, 'engine') || '<span class="muted">—</span>') + '</div></div>',
      '<div class="card"><div class="hd"><h2>By exit style</h2></div><div class="bd">' + (bk(h.by_style, 'style') || '<span class="muted">—</span>') + '</div></div>',
      '<div class="card"><div class="hd"><h2>Slippage by style</h2></div><div class="bd">' + (bk(h.slippage_by_style, 'style') || '<span class="muted">—</span>') + '</div></div>',
      '</div>',

      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Deposits &amp; withdrawals</h2><div class="sp"></div>',
      '<input type="number" id="depUsd" step="0.01" placeholder="usd" style="width:90px">',
      '<input type="text" id="depNote" placeholder="note" style="width:150px">',
      '<button class="btn sm" onclick="PD.api(\'/api/deposits\',{method:\'POST\',body:{usd:parseFloat(document.getElementById(\'depUsd\').value)||0,note:document.getElementById(\'depNote\').value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Logged\',r.ok===false?\'bad\':\'good\');PD.refreshHistory()})">Log</button></div>',
      '<div class="bd flush">' + (ledger || '<div class="rowline"><span class="d">Nothing logged yet. A negative number is a withdrawal.</span></div>') +
      '<div class="rowline"><span class="t">Total</span><span class="d">deposited ' + M(led.deposited) + ' · withdrawn ' + M(led.withdrawn) + '</span>' +
      '<span class="v">' + M(led.total) + '</span></div></div></div>',

      bannedCard(st),
      backtestCard(),

      '<div class="card"><div class="hd"><h2>Live log</h2><div class="sp"></div><span class="muted" style="font-size:13px">newest first</span></div>',
      '<div class="bd flush"><div class="logs">' + (logs.map(function (l) {
        return '<div class="l ' + E(l.level || 'info') + '"><span class="ts">' + E(CLOCK(l.ts)) + '</span><span>' + E(l.message) + '</span></div>';
      }).join('') || '<div class="l"><span>No logs yet.</span></div>') + '</div></div></div>'
    ].join('');
  };
  P.activity.after = function () {
    if (S.history && S.historyAt && Date.now() - S.historyAt < 20000) {
      if (!S.backtest || !S.backtestAt || Date.now() - S.backtestAt > 120000) loadBacktest();
      return;
    }
    PD.refreshHistory();
    loadBacktest();
  };
  function loadBacktest() {
    PD.api('/api/backtest/moon').then(function (r) {
      if (r && r.ok) { S.backtest = r; S.backtestAt = Date.now(); PD.mount(); }
    });
  }

  /* ============================== SETTINGS ============================== */
  const ALERTS = [
    ['discord_alerts', 'Discord alerts (master)', 'the switch everything else obeys'],
    ['alert_buys', 'Buy pings', 'every entry the desk takes'],
    ['alert_sells', 'Sell pings', 'every exit'],
    ['alert_stops', 'Stop / trail exits', 'the ones that cost money'],
    ['alert_safety', 'Halts & crashes', 'breaker, daily halt, safety refusals'],
    ['alert_morning', 'Morning summary', 'what happened overnight'],
    ['alert_nightly', 'Nightly digest', 'the day in one message']
  ];
  P.settings = function (st) {
    st = st || {};
    return [
      '<div class="grid g2">',
      '<div class="card"><div class="hd"><h2>Dashboard token</h2></div><div class="bd">',
      '<div class="note" style="margin-bottom:12px">Every button on this page sends <code>X-Dashboard-Token</code>. Without it the desk answers <b>401</b> and nothing happens. Reading stays open; writing needs the token.</div>',
      '<div style="display:flex;gap:8px;align-items:center">',
      '<input type="password" id="tokInput" placeholder="' + (S.token ? '•••••••• (saved)' : 'paste DASHBOARD_TOKEN') + '" style="flex:1">',
      '<button class="btn sm primary" data-a="token.save">Save</button></div>',
      '<div class="kv" style="margin-top:12px"><span class="k">Current state</span><span class="v">' + (S.token ? '<span class="up">token set</span>' : '<span class="down">no token</span>') + '</span></div>',
      '</div></div>',
      '<div class="card"><div class="hd"><h2>Desk</h2></div><div class="bd">',
      kv('Version', E(S.version || '—')),
      kv('Mode', st.mode === 'LIVE' ? '<span class="down">LIVE money</span>' : 'PAPER (desk-level)'),
      kv('Paper mode flag', st.paper_mode ? 'on' : 'off'),
      kv('Exchange', E(st.exchange_label || st.exchange || '—')),
      kv('Spray mode', '<label class="ck"><input type="checkbox"' + (st.spray_mode ? ' checked' : '') +
        ' onchange="PD.api(\'/api/spray\',{method:\'POST\',body:{enabled:this.checked}}).then(r=>{PD.toast(r.ok===false?r.error:\'Spray mode updated\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})"> many small tickets instead of few big ones</label>'),
      kv('Gaming mode', '<label class="ck"><input type="checkbox"' + (st.gaming_mode ? ' checked' : '') +
        ' onchange="PD.api(\'/api/gaming\',{method:\'POST\',body:{enabled:this.checked}}).then(r=>{PD.toast(r.ok===false?r.error:\'Gaming mode updated\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})"> pause the AI layers and free the CPU</label>'),
      kv('Adopt on sync', st.adopt_on_sync ? 'yes' : 'no'),
      '</div></div>',
      '</div>',

      '<div class="card" style="margin-top:16px"><div class="hd"><h2>Alerts</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">Discord ' + (st.discord_webhook_set ? 'webhook set' : 'webhook missing') + '</span>',
      '<button class="btn sm" data-a="webhook.test">Test ping</button></div><div class="bd">',
      '<div style="display:flex;gap:8px;margin-bottom:12px">',
      '<input type="password" id="hookInput" placeholder="https://discord.com/api/webhooks/…" style="flex:1">',
      '<button class="btn sm" onclick="PD.api(\'/api/webhook\',{method:\'POST\',body:{url:document.getElementById(\'hookInput\').value}}).then(r=>{PD.toast(r.ok===false?r.error:\'Saved — test ping sent\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">Save &amp; ping</button></div>',
      ALERTS.map(function (a) {
        const on = !!(st.alerts || {})[a[0]];
        return '<div class="rowline"><span class="t">' + E(a[1]) + '</span><span class="d">' + E(a[2]) + '</span>' +
          '<label class="ck"><input type="checkbox"' + (on ? ' checked' : '') + ' onchange="PD.api(\'/api/alerts\',{method:\'POST\',body:{alerts:{' + a[0] + ':this.checked}}}).then(r=>{PD.toast(r.ok===false?r.error:\'Saved\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})"></label></div>';
      }).join(''),
      '</div></div>',

      '<div class="card" style="margin-top:16px"><div class="hd"><h2>Danger zone</h2></div><div class="bd">',
      '<div class="note bad" style="margin-bottom:12px">These wipe tracking history. Neither one sells anything, but the numbers cannot be recovered.</div>',
      '<div style="display:flex;gap:8px">',
      '<button class="btn sm" onclick="if(confirm(\'Reset stats?\\n\\nZeroes P&L, wins/losses and trade history. Open positions are kept.\'))PD.api(\'/api/reset_stats\',{method:\'POST\'}).then(r=>{PD.toast(r.ok===false?r.error:\'Stats reset\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">Reset stats</button>',
      '<button class="btn sm stop" onclick="if(confirm(\'Wipe ALL tracking data?\\n\\nEvery book goes back to zero.\')&&confirm(\'Are you absolutely sure? This cannot be undone.\'))PD.api(\'/api/reset_all\',{method:\'POST\'}).then(r=>{PD.toast(r.ok===false?r.error:\'All data reset\',r.ok===false?\'bad\':\'good\');PD.refresh(true)})">Reset all data</button>',
      '</div></div></div>'
    ].join('');
  };

  /* ============================== TESTING (paper only) ============================== */
  /* Real tournament timing. The desk stores no run start and no deadline, so the
     start is derived from this engine's first hourly snapshot, published to the
     static dir by tools/tournament-meta.py on a systemd timer. */
  function timingBlock(eng) {
    const m = S.tourMeta;
    if (!m || !m.ok) return '<div class="note" style="margin-top:12px">Reading the snapshot log…</div>';
    const info = m.engines || {};
    /* The target comes from the server (data/tournament_run.json → published by
       tools/tournament-meta.py), so every browser agrees. Falls back to the
       local field only if the server has not published one. */
    let target = m.target_days || 0;
    if (!target) {
      try { target = parseInt(localStorage.getItem('pulse.tourDays') || '14', 10) || 14; } catch (e) { target = 14; }
    }
    const rows = (eng || []).map(function (e) {
      const i = info[e.engine] || {};
      const day = i.day_number || 0;
      const prog = day ? Math.min(100, Math.round(day / target * 100)) : 0;
      return '<div class="kv"><span class="k">' + E(e.label) + '</span><span class="v">' +
        (day ? 'day ' + day + ' of ' + target + ' · ' + i.snapshots + ' snapshots · last ' + PD.ago(i.last_ts) +
          '<div style="height:5px;border-radius:3px;background:var(--grouped);margin-top:6px;overflow:hidden">' +
          '<div style="height:5px;width:' + prog + '%;background:var(--accent)"></div></div>'
          : 'no snapshots yet') +
        '</span></div>';
    }).join('');
    const first = Object.keys(info).length ? (info[Object.keys(info)[0]] || {}) : {};
    return '<div class="card" style="margin-top:14px"><div class="hd"><h2>Timing</h2><div class="sp"></div>' +
      '<span class="muted" style="font-size:13px">from the hourly snapshot log · updated every 10 min</span>' +
      '<button class="btn sm" onclick="PD.state.tourMetaAt=0;PD.pages.testing.after()">Refresh</button></div>' +
      '<div class="bd">' + rows +
      '<div class="note warn" style="margin-top:12px"><b>The desk has no deadline.</b> A paper run starts when you press Start and stops when you press Stop — ' +
      'nothing auto-stops it and no "day 6 of 14" is stored anywhere in the engine. What is above is the truth from the log: the race began <b>' +
      E(first.started_iso || '—') + '</b> and has written <b>' + N(m.total_snapshots, 0) + ' snapshots</b> so far. ' +
      'Enforcing a real duration needs one small engine change (Phase 3), and that needs a service restart — which I will not do while Core is live and holding positions.</div>' +
      '</div></div>';
  }
  P.testing = function () {
    const t = S.tournament;
    const sel = (function () { try { return JSON.parse(localStorage.getItem('pulse.tourEngines') || '["core","wish","moonshot","alpha"]'); } catch (e) { return ['core', 'wish', 'moonshot', 'alpha']; } })();
    if (!t || !t.ok) return '<div class="loading">Loading the paper tournament…</div>';
    const eng = t.engines || [];
    const running = eng.filter(e => e.running).length;

    const picker = eng.map(function (e) {
      const on = sel.indexOf(e.engine) >= 0;
      return '<label class="ck" style="border:1px solid var(--border);border-radius:12px;padding:10px 12px">' +
        '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="PD.state.tourPick(\'' + e.engine + '\',this.checked)"> ' +
        '<b>' + E(e.label) + '</b> <span class="muted">$' + N(t.stake_usd, 0) + ' paper</span></label>';
    }).join('');

    const cards = eng.map(function (e) {
      return tile(e.label,
        '<span class="' + CLS(e.return_pct) + '">' + PCT(e.return_pct) + '</span>',
        M(e.equity) + ' from ' + M(e.start_equity) + ' · ' + e.trades + ' trades · ' + N(e.win_rate, 1) + '% win' +
        '<br>costs ' + M(e.costs_paid) + ' · max drawdown ' + N(e.max_drawdown, 1) + '%' + (e.leader ? ' · <b>leader</b>' : ''),
        'tourdetail:' + e.engine, e.running ? 'paper' : '');
    }).join('');

    return [
      '<div class="note" style="margin-bottom:16px"><b>Paper only.</b> Nothing here is a real order and none of these numbers are mixed with live money. ' +
      'Each engine starts with a <b>$' + N(t.stake_usd, 0) + ' paper stake</b> and pays honest costs: CEX ' + N(t.costs.cex_fee_pct, 2) + '% fee + ' + N(t.costs.cex_slippage_pct, 2) + '% slippage per side; ' +
      'on-chain ' + M(t.costs.chain_rent_usd) + ' rent + ' + M(t.costs.chain_gas_usd) + ' gas + ' + N(t.costs.chain_slippage_pct, 1) + '% slippage per side.</div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Run a test</h2><div class="sp"></div>',
      '<span class="muted" style="font-size:13px">' + running + ' of ' + eng.length + ' running</span>',
      '<span class="muted" style="font-size:13px">run for</span>',
      '<input type="number" id="tourDays" min="1" max="90" value="' + ((S.tourMeta && S.tourMeta.target_days) || (function () { try { return localStorage.getItem('pulse.tourDays') || '14'; } catch (e) { return '14'; } })()) + '" style="width:70px">',
      '<span class="muted" style="font-size:13px">days</span>',
      '<button class="btn sm go" onclick="PD.state.tourStart()">Start selected</button>',
      '<button class="btn sm stop" data-a="tour.stop"' + (running ? '' : ' disabled') + '>Stop all</button></div>',
      '<div class="bd"><div class="grid g2">' + picker + '</div>',
      '<div class="note" style="margin-top:12px">Tick exactly which methods to test — Core only, or Core + Moonshot, whatever you want. The desk accepts a list of engines.</div>',
      timingBlock(eng),
      '</div></div>',
      '<div class="card" style="margin-bottom:16px"><div class="hd"><h2>Scoreboard</h2><div class="sp"></div><span class="muted" style="font-size:13px">return on the $100 stake</span></div>',
      '<div class="bd"><div class="sq">' + cards + '</div></div></div>',
      '<div class="card"><div class="hd"><h2>Detail</h2></div><div class="bd flush"><table><thead><tr><th>Engine</th><th>State</th><th class="num">Equity</th><th class="num">Return</th><th class="num">Realised</th><th class="num">Open</th><th class="num">Trades</th><th class="num">Win %</th><th class="num">Expectancy</th><th class="num">Costs</th><th class="num">Max DD</th></tr></thead><tbody>' +
      eng.map(function (e) {
        return '<tr class="clk" data-a="tourdetail:' + e.engine + '"><td><b>' + E(e.label) + '</b>' + (e.leader ? ' <span class="tag buy">leader</span>' : '') + '</td>' +
          '<td>' + (e.started ? (e.running ? '<span class="tag paper">running</span>' : '<span class="tag">stopped</span>') : '<span class="tag">never run</span>') + '</td>' +
          '<td class="num">' + M(e.equity) + '</td><td class="num ' + CLS(e.return_pct) + '">' + PCT(e.return_pct) + '</td>' +
          '<td class="num ' + CLS(e.realized) + '">' + PD.signed(e.realized) + '</td>' +
          '<td class="num">' + e.open_count + '</td><td class="num">' + e.trades + '</td><td class="num">' + N(e.win_rate, 1) + '</td>' +
          '<td class="num ' + CLS(e.expectancy_per_trade) + '">' + PD.signed(e.expectancy_per_trade, 3) + '</td>' +
          '<td class="num">' + M(e.costs_paid) + '</td><td class="num">' + N(e.max_drawdown, 1) + '%</td></tr>';
      }).join('') + '</tbody></table></div></div>',
      '<div class="note" style="margin-top:16px">Everything above is losing money right now — Core −0.5%, Wish −19%, Moonshot −9%, Alpha −9%. That is the honest result of a paper race with real fees, and it is exactly why these numbers are kept away from the live pages.</div>'
    ].join('');
  };
  P.testing.after = function () {
    if (S.tourMeta && S.tourMetaAt && Date.now() - S.tourMetaAt < 60000) return;
    /* Cache-buster: this file is rewritten every 10 min by a timer, and the
       browser would otherwise happily serve the old copy and look "dead". */
    PD.api('/static/tournament-meta.json?t=' + Date.now()).then(function (r) {
      if (r && r.ok) { S.tourMeta = r; S.tourMetaAt = Date.now(); PD.mount(); }
      else PD.toast('Could not read the snapshot log', 'bad');
    });
  };
  /* Big version of the daily chart, used by the Enlarge button. */
  S.barsBig = function () { return bars((S.history || {}).daily, true); };
  S.tourPick = function (engine, on) {    let sel;
    try { sel = JSON.parse(localStorage.getItem('pulse.tourEngines') || '["core","wish","moonshot","alpha"]'); } catch (e) { sel = []; }
    const i = sel.indexOf(engine);
    if (on && i < 0) sel.push(engine);
    if (!on && i >= 0) sel.splice(i, 1);
    localStorage.setItem('pulse.tourEngines', JSON.stringify(sel));
    PD.mount();
  };
  S.tourStart = function () {
    let sel;
    try { sel = JSON.parse(localStorage.getItem('pulse.tourEngines') || '["core","wish","moonshot","alpha"]'); } catch (e) { sel = []; }
    if (!sel.length) { PD.toast('Tick at least one method to test', 'bad'); return; }
    const days = Math.max(1, parseInt((document.getElementById('tourDays') || {}).value, 10) || 10);
    try { localStorage.setItem('pulse.tourDays', String(days)); } catch (e) { }
    const running = ((S.tournament || {}).engines || []).filter(e => e.running).map(e => e.label);

    const go = function (replace) {
      const work = replace
        ? PD.api('/api/tournament/stop', { method: 'POST' }).then(() => PD.api('/api/tournament/start', { method: 'POST', body: { engine: sel.join(',') } }))
        : PD.api('/api/tournament/start', { method: 'POST', body: { engine: sel.join(',') } });
      work.then(function (r) {
        if (r && r.ok === false) { PD.toast(r.error || 'Refused', 'bad'); return; }
        const failed = (r && r.results) ? Object.keys(r.results).filter(k => !r.results[k].ok) : [];
        if (failed.length) {
          PD.toast('Started ' + sel.filter(x => failed.indexOf(x) < 0).join(', ') + ' — ' + failed.join(', ') + ' refused', 'bad');
        } else {
          PD.toast('Paper test started: ' + sel.join(', ') + ' · ' + days + '-day plan', 'good');
        }
        PD.refreshTournament();
      });
    };

    if (running.length) {
      /* The operator asked for this exact choice instead of a bare "refused". */
      const replace = window.confirm(
        running.join(', ') + ' is already running as a paper test.\n\n' +
        'OK  = stop the current run and start a fresh one for: ' + sel.join(', ') + '\n' +
        'Cancel = keep the running test as it is\n\n' +
        'Note: stopping wipes the current paper book for those engines — the $100 stake starts again from zero.');
      if (!replace) { PD.toast('Kept the running test', 'good'); return; }
      go(true);
      return;
    }
    if (!window.confirm('Start a PAPER test for: ' + sel.join(', ') + '?\n\n$100 paper stake each, honest fees, ' + days + '-day plan.\nNo real orders.')) return;
    go(false);
  };

  /* detail handlers used by data-a="tourdetail:<engine>" */
  document.addEventListener('click', function (e) {
    const el = e.target.closest ? e.target.closest('[data-a^="tourdetail:"]') : null;
    if (!el) return;
    const name = el.dataset.a.split(':')[1];
    const t = S.tournament || {};
    const e2 = (t.engines || []).filter(x => x.engine === name)[0];
    if (!e2) return;
    PD.modal(e2.label + ' — paper', [
      '<div class="grid g4" style="margin-bottom:14px">',
      stat('Equity', M(e2.equity), 'started ' + M(e2.start_equity)),
      stat('Return', '<span class="' + CLS(e2.return_pct) + '">' + PCT(e2.return_pct) + '</span>', 'vs the paper stake'),
      stat('Realised', PD.signed(e2.realized), 'unrealised ' + PD.signed(e2.unrealized)),
      stat('Open', String(e2.open_count), 'positions in the paper book'),
      '</div>',
      '<div class="grid g2">',
      '<div>' + kv('Trades', String(e2.trades)) + kv('Wins', String(e2.wins)) + kv('Losses', String(e2.losses)) + kv('Win rate', N(e2.win_rate, 1) + '%') + '</div>',
      '<div>' + kv('Expectancy / trade', PD.signed(e2.expectancy_per_trade, 3)) + kv('Costs paid', M(e2.costs_paid)) + kv('Max drawdown', N(e2.max_drawdown, 1) + '%') + kv('State', e2.running ? 'running (paper)' : 'stopped') + '</div>',
      '</div>',
      '<div class="note" style="margin-top:14px">Paper book — stored separately from the live books, so these numbers never touch your real money or the live pages.</div>'
    ].join(''));
  });
})();
