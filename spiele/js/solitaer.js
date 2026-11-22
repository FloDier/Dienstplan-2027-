'use strict';
/* Klondike-Solitär: Tippen verschiebt eine Karte automatisch an den besten Platz */
registerGame({
  id: 'solitaer', name: 'Solitär', icon: '🃏', desc: 'Klondike – der Kartenklassiker',
  mount(view, api) {
    const R = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];
    let draw = Store.get('sol.draw', 1);
    let S, undo = [], moves = 0, done = false, autoT = null;
    const timer = makeTimer(() => status());
    const board = h('div', { class: 'sol' });
    view.append(board);
    const red = c => isRedSuit(c.s);

    function status() { api.setStatus(`Züge ${moves} · ${fmtTime(timer.sec)}`); }
    function actions() {
      api.setActions([
        { label: 'Neu', onclick: () => newGame(true) },
        { label: '↶ Zurück', onclick: doUndo },
        { label: draw === 1 ? 'Ziehen: 1' : 'Ziehen: 3', onclick: toggleDraw },
        canAuto() && !done ? { label: '⚡ Auto', on: true, onclick: autoFinish } : null,
      ]);
    }
    async function toggleDraw() {
      const r = await modal('Ziehmodus ändern?', 'Dafür wird ein neues Spiel gestartet.', [{ label: 'Abbrechen' }, { label: 'Neues Spiel', primary: true }]);
      if (r !== 1) return;
      draw = draw === 1 ? 3 : 1; Store.set('sol.draw', draw); newGame(false);
    }
    function newGame(count) {
      if (count && moves > 0 && !done) recordGame('solitaer', false);
      const deck = [];
      for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
      shuffle(deck);
      S = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []] };
      for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) { const c = deck.pop(); c.up = j === i; S.tab[i].push(c); }
      S.stock = deck; undo = []; moves = 0; done = false;
      clearTimeout(autoT); timer.reset(); render();
    }
    function snap() { undo.push(JSON.stringify([S, moves])); if (undo.length > 300) undo.shift(); }
    function doUndo() { if (!undo.length || done) return; [S, moves] = JSON.parse(undo.pop()); render(); }

    const top = a => a[a.length - 1];
    function canTab(card, col) {
      const t = S.tab[col];
      if (!t.length) return card.r === 13;
      const tp = top(t); return tp.up && red(tp) !== red(card) && tp.r === card.r + 1;
    }
    function canFound(card) { const f = S.found[card.s]; return (f.length ? top(f).r : 0) === card.r - 1; }
    function flipTops() { for (const t of S.tab) if (t.length && !top(t).up) top(t).up = true; }

    function clickStock() {
      if (done) return;
      if (!S.stock.length && !S.waste.length) return;
      snap();
      if (S.stock.length) {
        for (let i = 0; i < draw && S.stock.length; i++) { const c = S.stock.pop(); c.up = true; S.waste.push(c); }
      } else {
        S.stock = S.waste.reverse().map(c => ({ ...c, up: false })); S.waste = [];
      }
      moves++; timer.start(); render();
    }

    function tryMove(src, col, idx, el) {
      if (done) return;
      let cards;
      if (src === 'waste') { if (!S.waste.length) return; cards = [top(S.waste)]; }
      else if (src === 'found') { const f = S.found[col]; if (!f.length) return; cards = [top(f)]; }
      else { const t = S.tab[col]; if (!t[idx] || !t[idx].up) return; cards = t.slice(idx); }
      const lead = cards[0];
      let dest = null;
      if (cards.length === 1 && src !== 'found' && canFound(lead)) dest = { f: true };
      if (!dest) {
        // Ziel-Spalten ab der aktuellen Spalte reihum, damit wiederholtes Tippen durchwechselt
        const start = src === 'tab' ? col + 1 : 0;
        const order = [...Array(7).keys()].map(i => (i + start) % 7).filter(i => !(src === 'tab' && i === col));
        for (const i of order) if (S.tab[i].length && canTab(lead, i)) { dest = { i }; break; }
        const pointlessKing = src === 'tab' && idx === 0;
        if (!dest && lead.r === 13 && !pointlessKing) for (const i of order) if (!S.tab[i].length) { dest = { i }; break; }
      }
      if (!dest) { if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } return; }
      snap();
      if (src === 'waste') S.waste.pop(); else if (src === 'found') S.found[col].pop(); else S.tab[col].splice(idx);
      if (dest.f) S.found[lead.s].push(lead); else S.tab[dest.i].push(...cards);
      flipTops(); moves++; timer.start(); render(); checkWin();
    }

    function canAuto() { return S.stock.length === 0 && S.waste.length === 0 && S.tab.every(t => t.every(c => c.up)) && !S.found.every(f => f.length === 13); }
    function autoFinish() {
      clearTimeout(autoT);
      // niedrigste passende Karte auf die Ablage
      let best = null;
      S.tab.forEach((t, i) => { if (t.length && canFound(top(t)) && (!best || top(t).r < best.r)) best = { i, r: top(t).r }; });
      if (!best) return;
      const c = S.tab[best.i].pop(); S.found[c.s].push(c); moves++;
      render();
      if (!checkWin()) autoT = setTimeout(autoFinish, 90);
    }

    function checkWin() {
      if (!S.found.every(f => f.length === 13)) return false;
      done = true; timer.stop(); actions();
      const s = recordGame('solitaer', true, timer.sec);
      setTimeout(async () => {
        const r = await modal('🎉 Gewonnen!', `${moves} Züge in ${fmtTime(timer.sec)}. Siege gesamt: ${s.won}`, [{ label: 'Schließen' }, { label: 'Neues Spiel', primary: true }]);
        if (r === 1) newGame(false);
      }, 400);
      return true;
    }

    function render() {
      const W = Math.min(view.clientWidth, 720) - 16;
      const gap = Math.max(4, Math.round(W * 0.012));
      const cw = Math.floor((W - gap * 6) / 7);
      const ch = Math.round(cw * 1.4);
      board.style.width = W + 16 + 'px';
      board.style.setProperty('--cw', cw + 'px');
      board.style.setProperty('--ch', ch + 'px');
      board.innerHTML = '';
      const X = i => 8 + i * (cw + gap);
      const add = (node, x, y, onclick) => { node.style.left = x + 'px'; node.style.top = y + 'px'; if (onclick) node.onclick = e => { e.stopPropagation(); onclick(node); }; board.append(node); return node; };

      // Talon
      add(S.stock.length ? h('div', { class: 'card back' }, h('div', { style: { position: 'absolute', bottom: '3px', right: '5px', fontSize: '11px', color: '#fff' } }, S.stock.length)) : h('div', { class: 'card empty' }, '↻'), X(0), 8, clickStock);
      // Ablage (Waste)
      const vis = S.waste.slice(draw === 3 ? -3 : -1);
      if (!vis.length) add(h('div', { class: 'card empty' }), X(1), 8);
      vis.forEach((c, i) => {
        const isTop = i === vis.length - 1;
        add(cardNode(R[c.r], c.s), X(1) + i * cw * 0.32, 8, isTop ? n => tryMove('waste', 0, 0, n) : null);
      });
      // Fundamente
      for (let s = 0; s < 4; s++) {
        const f = S.found[s];
        if (f.length) add(cardNode(R[top(f).r], s), X(3 + s), 8, n => tryMove('found', s, 0, n));
        else add(h('div', { class: 'card empty' }, SUIT_CH[s]), X(3 + s), 8);
      }
      // Tableau – Abstände an verfügbare Höhe anpassen
      const y0 = 8 + ch + gap * 2;
      const availH = Math.max(view.clientHeight - y0 - 16, ch * 3);
      let maxH = 0;
      for (let i = 0; i < 7; i++) {
        const t = S.tab[i];
        let dDown = ch * 0.14, dUp = ch * 0.27;
        const need = t.reduce((a, c, k) => a + (k === t.length - 1 ? 0 : (c.up ? dUp : dDown)), 0) + ch;
        if (need > availH) { const f = (availH - ch) / (need - ch); dDown *= f; dUp *= f; }
        if (!t.length) add(h('div', { class: 'card empty' }, 'K'), X(i), y0);
        let y = y0;
        t.forEach((c, k) => {
          add(cardNode(R[c.r], c.s, c.up), X(i), y, c.up ? n => tryMove('tab', i, k, n) : null);
          y += c.up ? dUp : dDown;
        });
        maxH = Math.max(maxH, y + ch);
      }
      board.style.height = Math.max(maxH, y0 + ch) + 16 + 'px';
      status(); actions();
    }

    const onResize = () => render();
    window.addEventListener('resize', onResize);
    newGame(false);
    return () => { timer.stop(); clearTimeout(autoT); window.removeEventListener('resize', onResize); if (moves > 0 && !done) recordGame('solitaer', false); };
  },
});
