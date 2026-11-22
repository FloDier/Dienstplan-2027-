'use strict';
/* Texas Hold'em (No Limit) gegen 3 Computergegner */
const Poker = (() => {
  const NAMES = ['Höchste Karte', 'Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];
  function eval5(cs) {
    const rs = cs.map(c => c.r).sort((a, b) => b - a);
    const flush = cs[0].s === cs[1].s && cs[1].s === cs[2].s && cs[2].s === cs[3].s && cs[3].s === cs[4].s;
    let sh = 0;
    if (rs[0] !== rs[1] && rs[1] !== rs[2] && rs[2] !== rs[3] && rs[3] !== rs[4]) {
      if (rs[0] - rs[4] === 4) sh = rs[0];
      else if (rs[0] === 14 && rs[1] === 5) sh = 5;
    }
    const cnt = {}; for (const r of rs) cnt[r] = (cnt[r] || 0) + 1;
    const g = Object.keys(cnt).map(r => [cnt[r], +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    let cat, k;
    if (sh && flush) { cat = 8; k = [sh]; }
    else if (g[0][0] === 4) { cat = 7; k = [g[0][1], g[1][1]]; }
    else if (g[0][0] === 3 && g[1][0] === 2) { cat = 6; k = [g[0][1], g[1][1]]; }
    else if (flush) { cat = 5; k = rs; }
    else if (sh) { cat = 4; k = [sh]; }
    else if (g[0][0] === 3) { cat = 3; k = g.map(x => x[1]); }
    else if (g[0][0] === 2 && g[1][0] === 2) { cat = 2; k = g.map(x => x[1]); }
    else if (g[0][0] === 2) { cat = 1; k = g.map(x => x[1]); }
    else { cat = 0; k = rs; }
    let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (k[i] || 0);
    return v;
  }
  function best(cs) {
    let b = -1; const n = cs.length, t = [0, 0, 0, 0, 0];
    for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) for (let f = e + 1; f < n; f++) {
      t[0] = cs[a]; t[1] = cs[c]; t[2] = cs[d]; t[3] = cs[e]; t[4] = cs[f];
      const v = eval5(t); if (v > b) b = v;
    }
    return b;
  }
  const catOf = v => Math.floor(v / 759375); // 15^5
  function name(v) { const c = catOf(v); if (c === 8 && Math.floor(v / 50625) % 15 === 14) return 'Royal Flush'; return NAMES[c]; }
  function deck() { const d = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s }); return d; }
  function equity(hole, board, nOpp, iters) {
    const used = new Set([...hole, ...board].map(c => c.r * 4 + c.s));
    const rest = deck().filter(c => !used.has(c.r * 4 + c.s));
    const need = nOpp * 2 + (5 - board.length);
    let score = 0;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const b = board.concat(rest.slice(nOpp * 2, need));
      const my = best(hole.concat(b));
      let win = true, ties = 0;
      for (let o = 0; o < nOpp; o++) {
        const ov = best([rest[o * 2], rest[o * 2 + 1]].concat(b));
        if (ov > my) { win = false; break; }
        if (ov === my) ties++;
      }
      if (win) score += 1 / (ties + 1);
    }
    return score / iters;
  }
  return { best, name, deck, equity };
})();

registerGame({
  id: 'holdem', name: "Texas Hold'em", icon: '♠️', desc: 'No-Limit-Poker gegen 3 Gegner', timed: false,
  mount(view, api) {
    const RT = { 11: 'B', 12: 'D', 13: 'K', 14: 'A' };
    const rtxt = r => RT[r] || String(r);
    const LEVELS = [[10, 20], [15, 30], [25, 50], [50, 100], [100, 200], [200, 400], [400, 800]];
    const BOTS = [{ name: 'Lena', aggr: 0.9, loose: 0.05 }, { name: 'Max', aggr: 1.4, loose: 0.12 }, { name: 'Ida', aggr: 0.6, loose: 0.0 }];
    let dead = false, gen = 0;
    let P, dealer, board, pot, curBet, minRaise, handNo, deckC, acting = -1, showdown = false, logTxt = '', humanResolve = null, level = 0;

    const root = h('div', { class: 'pk' }); view.append(root);
    const sleep = ms => { const g = gen; return new Promise((res, rej) => setTimeout(() => (dead || g !== gen) ? rej('abort') : res(), ms)); };

    function init() {
      P = [{ name: 'Du', human: true, chips: 1000 }, ...BOTS.map(b => ({ ...b, chips: 1000 }))];
      dealer = Math.floor(Math.random() * 4); handNo = 0; level = 0;
      board = []; pot = 0; showdown = false; logTxt = '';
    }
    const nextIdx = (i, pred) => { for (let k = 1; k <= P.length; k++) { const j = (i + k) % P.length; if (pred(P[j])) return j; } return -1; };
    const inHand = p => p.inHand && !p.folded;
    const canAct = p => inHand(p) && !p.allIn;
    const blinds = () => LEVELS[Math.min(level, LEVELS.length - 1)];

    function put(p, amt) {
      amt = Math.min(amt, p.chips);
      p.chips -= amt; p.bet += amt; p.total += amt; pot += amt;
      if (p.chips === 0) p.allIn = true;
      return amt;
    }
    function log(t) { logTxt = t; render(); }

    async function loop() {
      const g = gen;
      try {
        while (!dead && g === gen) {
          await playHand();
          if (P[0].chips <= 0) {
            recordGame('holdem', false);
            const r = await modal('Ausgeschieden', `Du hast nach ${handNo} Händen alle Chips verloren.`, [{ label: 'Neues Turnier', primary: true }]);
            init(); continue;
          }
          if (P.slice(1).every(p => p.chips <= 0)) {
            const s = recordGame('holdem', true);
            await modal('🏆 Turnier gewonnen!', `Du hast alle Gegner nach ${handNo} Händen besiegt. Siege: ${s.won}`, [{ label: 'Neues Turnier', primary: true }]);
            init(); continue;
          }
          await waitNext();
        }
      } catch (e) { if (e !== 'abort') console.error(e); }
    }
    function waitNext() {
      return new Promise(res => { humanResolve = () => res(); renderCtrl({ next: true }); });
    }

    async function playHand() {
      handNo++;
      if (handNo > 1 && (handNo - 1) % 10 === 0 && level < LEVELS.length - 1) { level++; toast(`Blinds steigen auf ${blinds()[0]}/${blinds()[1]}`); }
      const [SB, BB] = blinds();
      deckC = shuffle(Poker.deck()); board = []; pot = 0; showdown = false;
      for (const p of P) Object.assign(p, { inHand: p.chips > 0, folded: false, allIn: false, bet: 0, total: 0, hand: [], msg: '', win: false, value: null });
      dealer = nextIdx(dealer, p => p.inHand);
      const nActive = P.filter(p => p.inHand).length;
      const sb = nActive === 2 ? dealer : nextIdx(dealer, p => p.inHand);
      const bb = nextIdx(sb, p => p.inHand);
      put(P[sb], SB); P[sb].msg = 'Small Blind';
      put(P[bb], BB); P[bb].msg = 'Big Blind';
      curBet = BB; minRaise = BB;
      for (let k = 0; k < 2; k++) for (const p of P) if (p.inHand) p.hand.push(deckC.pop());
      log(`Hand ${handNo} – Blinds ${SB}/${BB}`);
      await sleep(500);
      await betting(nextIdx(bb, p => p.inHand));
      const streets = [[3, 'Flop'], [1, 'Turn'], [1, 'River']];
      for (const [n, nm] of streets) {
        if (P.filter(inHand).length < 2) break;
        for (const p of P) { p.bet = 0; if (inHand(p) && !p.allIn) p.msg = ''; }
        curBet = 0; minRaise = BB;
        deckC.pop(); for (let k = 0; k < n; k++) board.push(deckC.pop());
        log(nm); await sleep(700);
        await betting(nextIdx(dealer, p => p.inHand));
      }
      for (const p of P) p.bet = 0;
      await settle();
    }

    async function betting(start) {
      const actors = () => P.filter(canAct);
      if (actors().length === 0) return;
      if (actors().length === 1 && actors()[0].bet >= curBet) return;
      const need = new Set(P.map((p, i) => i).filter(i => canAct(P[i])));
      let i = start;
      let guard = 0;
      while (need.size && guard++ < 200) {
        if (P.filter(inHand).length < 2) return;
        if (!need.has(i) || !canAct(P[i])) { need.delete(i); i = (i + 1) % P.length; continue; }
        const p = P[i];
        // Einziger Handlungsfähiger, der bereits mitgegangen ist
        if (actors().length === 1 && p.bet >= curBet) { need.delete(i); break; }
        acting = i; render();
        const a = p.human ? await humanAct(p) : await botAct(p);
        const toCall = curBet - p.bet;
        if (a.type === 'fold') { p.folded = true; p.msg = 'Fold'; }
        else if (a.type === 'call') {
          if (toCall <= 0) p.msg = 'Check';
          else { const x = put(p, toCall); p.msg = p.allIn ? `All-In ${p.total}` : `Call ${x}`; }
        } else if (a.type === 'raise') {
          let to = Math.min(a.to, p.bet + p.chips);
          const old = curBet;
          put(p, to - p.bet);
          if (p.bet > old) {
            if (p.bet - old >= minRaise) minRaise = p.bet - old;
            curBet = p.bet;
            for (const j of P.keys()) if (j !== i && canAct(P[j])) need.add(j);
            p.msg = p.allIn ? `All-In ${p.bet}` : (old === 0 ? `Bet ${p.bet}` : `Raise ${p.bet}`);
          } else p.msg = p.allIn ? `All-In ${p.total}` : `Call`;
        }
        need.delete(i);
        acting = -1; render();
        if (!p.human) await sleep(350);
        i = (i + 1) % P.length;
      }
      acting = -1;
    }

    function humanAct(p) {
      return new Promise(res => {
        humanResolve = a => { humanResolve = null; renderCtrl(null); res(a); };
        renderCtrl({ p });
      });
    }

    async function botAct(p) {
      await sleep(600 + Math.random() * 500);
      const toCall = curBet - p.bet;
      const nOpp = P.filter(inHand).length - 1;
      const eq = Poker.equity(p.hand, board, nOpp, board.length ? 220 : 160);
      const fair = 1 / (nOpp + 1);
      const potOdds = toCall / (pot + toCall);
      const r = Math.random();
      const BB = blinds()[1];
      const raiseTo = f => { const amt = Math.max(minRaise, Math.round((pot * f * p.aggr) / 5) * 5); return curBet + amt; };
      const strong = eq > fair + 0.25 || eq > 0.72;
      const good = eq > fair + 0.08;
      if (toCall <= 0) {
        if (strong && r < 0.75) return { type: 'raise', to: raiseTo(0.6 + Math.random() * 0.5) };
        if (good && r < 0.35 * p.aggr) return { type: 'raise', to: raiseTo(0.5) };
        if (r < p.loose) return { type: 'raise', to: raiseTo(0.5) }; // Bluff
        return { type: 'call' };
      }
      const commit = toCall / (p.chips + p.bet);
      if (eq > 0.85 && r < 0.5) return { type: 'raise', to: p.bet + p.chips };
      if (strong && r < 0.55 * p.aggr && commit < 0.5) return { type: 'raise', to: raiseTo(0.8) };
      if (eq >= potOdds + 0.03 - p.loose || (toCall <= BB && eq > fair * 0.6)) {
        if (commit > 0.6 && eq < 0.5 && r > p.loose * 3) return { type: 'fold' };
        return { type: 'call' };
      }
      if (r < p.loose * 0.5) return { type: 'call' };
      return { type: 'fold' };
    }

    async function settle() {
      const live = P.filter(inHand);
      if (live.length === 1) {
        const w = live[0], amt = pot; w.chips += amt; w.win = true; pot = 0;
        log(`${w.name} gewinnt ${amt} Chips`);
        return;
      }
      // Restliche Boardkarten aufdecken (z. B. bei All-In)
      while (board.length < 5) { if (board.length === 0) { deckC.pop(); board.push(deckC.pop(), deckC.pop(), deckC.pop()); } else { deckC.pop(); board.push(deckC.pop()); } render(); await sleep(700); }
      showdown = true;
      for (const p of live) { p.value = Poker.best(p.hand.concat(board)); p.msg = Poker.name(p.value); }
      const levels = [...new Set(P.filter(p => p.total > 0).map(p => p.total))].sort((a, b) => a - b);
      let prev = 0; const won = new Map();
      for (const lv of levels) {
        let amt = 0; for (const p of P) amt += Math.max(0, Math.min(p.total, lv) - prev);
        let elig = live.filter(p => p.total >= lv);
        if (!elig.length) elig = live;
        const bestV = Math.max(...elig.map(p => p.value));
        const ws = elig.filter(p => p.value === bestV);
        const share = Math.floor(amt / ws.length); let rem = amt - share * ws.length;
        for (const w of ws) { const g = share + (rem-- > 0 ? 1 : 0); w.chips += g; won.set(w, (won.get(w) || 0) + g); w.win = true; }
        prev = lv;
      }
      pot = 0;
      log([...won.entries()].map(([p, g]) => `${p.name} gewinnt ${g} (${Poker.name(p.value)})`).join(' · '));
    }

    function seat(i, area) {
      const p = P[i];
      const show = p.human || (showdown && inHand(p));
      const cards = h('div', { class: 'pk-cards' }, (p.hand || []).map((c, k) => {
        const n = cardNode(rtxt(c.r), c.s, show);
        n.style.left = k * (parseFloat(getComputedStyle(root).getPropertyValue('--cw')) + 4) + 'px';
        if (p.folded) n.style.opacity = '.35';
        return n;
      }));
      return h('div', { class: 'pk-seat' + (p.human ? ' me' : '') + (i === acting ? ' act' : '') + (p.chips <= 0 && !p.inHand ? ' out' : '') + (p.win ? ' win' : ''), style: { gridArea: area } },
        i === dealer ? h('div', { class: 'pk-dealer' }, 'D') : null,
        h('div', { class: 'nm' }, p.name), h('div', { class: 'ch' }, p.chips + ' 🪙'),
        cards,
        h('div', { class: 'msg' }, p.msg || (p.bet ? 'Einsatz ' + p.bet : '')));
    }

    let ctrlEl;
    function render() {
      if (dead) return;
      const W = Math.min(view.clientWidth, 760);
      const cw = Math.max(30, Math.min(56, Math.floor((W - 40) / 7.2)));
      root.style.setProperty('--cw', cw + 'px'); root.style.setProperty('--ch', Math.round(cw * 1.4) + 'px');
      root.innerHTML = '';
      const center = h('div', { class: 'pk-center' },
        h('div', { class: 'pk-board' }, board.map((c, k) => { const n = cardNode(rtxt(c.r), c.s); n.style.left = k * (cw + 4) + 'px'; return n; })),
        h('div', { class: 'pk-pot' }, 'Pot: ' + (pot + 0)),
        h('div', { class: 'pk-log' }, logTxt));
      root.append(seat(1, 'l'), seat(2, 't'), seat(3, 'r'), center, seat(0, 'y'));
      ctrlEl = h('div', { class: 'pk-ctrl' });
      root.append(ctrlEl);
      renderCtrl(lastCtrl);
      api.setStatus(`Hand ${handNo} · Blinds ${blinds()[0]}/${blinds()[1]}`);
    }

    let lastCtrl = null;
    function renderCtrl(st) {
      lastCtrl = st;
      if (!ctrlEl) return;
      ctrlEl.innerHTML = '';
      if (!st) return;
      if (st.next) {
        ctrlEl.append(h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { const r = humanResolve; humanResolve = null; lastCtrl = null; r && r(); } }, 'Nächste Hand ▶')));
        return;
      }
      const p = st.p; const toCall = Math.min(curBet - p.bet, p.chips);
      const maxTo = p.bet + p.chips;
      const minTo = Math.min(curBet + minRaise, maxTo);
      let to = Math.min(maxTo, Math.max(minTo, curBet + Math.round(pot / 2 / 5) * 5));
      const lbl = h('span', null);
      const raiseBtn = h('button', { class: 'btn primary', onclick: () => humanResolve && humanResolve({ type: 'raise', to }) });
      const upd = () => { raiseBtn.textContent = (to >= maxTo ? 'All-In ' : (curBet ? 'Raise auf ' : 'Bet ')) + to; };
      const slider = h('input', { type: 'range', min: minTo, max: maxTo, step: 5, value: to, oninput: e => { to = +e.target.value; if (to > maxTo - 5) to = maxTo; upd(); } });
      upd();
      const quick = (lab, v) => h('button', { class: 'btn', onclick: () => { to = Math.max(minTo, Math.min(maxTo, v)); slider.value = to; upd(); } }, lab);
      const canRaise = maxTo > curBet;
      ctrlEl.append(
        canRaise ? h('div', { class: 'row' }, quick('½ Pot', curBet + Math.round(pot / 2)), quick('Pot', curBet + pot + toCall), quick('Max', maxTo)) : null,
        canRaise ? slider : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => humanResolve && humanResolve({ type: toCall > 0 ? 'fold' : 'call' }) }, toCall > 0 ? 'Fold' : 'Check'),
          toCall > 0 ? h('button', { class: 'btn', onclick: () => humanResolve && humanResolve({ type: 'call' }) }, (toCall >= p.chips ? 'All-In ' : 'Call ') + toCall) : null,
          canRaise ? raiseBtn : null));
    }

    api.setActions([
      { label: 'Neues Turnier', onclick: async () => {
        const r = await modal('Neues Turnier?', 'Das aktuelle Turnier wird abgebrochen.', [{ label: 'Abbrechen' }, { label: 'Neu starten', primary: true }]);
        if (r === 1) { gen++; humanResolve = null; lastCtrl = null; acting = -1; init(); render(); loop(); }
      } },
      { label: 'Regeln', onclick: () => modal('Rangfolge', 'Royal Flush › Straight Flush › Vierling › Full House › Flush › Straße › Drilling › Zwei Paare › Paar › Höchste Karte. Alle 10 Hände steigen die Blinds.') },
    ]);

    const onResize = () => render();
    window.addEventListener('resize', onResize);
    init(); render(); loop();
    return () => { dead = true; window.removeEventListener('resize', onResize); };
  },
});
