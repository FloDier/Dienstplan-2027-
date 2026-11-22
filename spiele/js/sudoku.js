'use strict';
/* Sudoku mit Generator (eindeutige Lösung), Notizen, Fehleranzeige und Autosave */
const SudokuGen = (() => {
  const ROW = i => Math.floor(i / 9), COL = i => i % 9, BOX = i => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const s = new Set();
    for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
    PEERS.push([...s]);
  }
  function cands(g, i) {
    let m = 0x3fe;
    for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]);
    return m;
  }
  const bits = m => { const r = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) r.push(d); return r; };
  function pick(g) {
    let best = -1, bm = 0, bn = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = cands(g, i); let n = 0; for (let x = m; x; x &= x - 1) n++;
      if (n < bn) { bn = n; best = i; bm = m; if (n <= 1) break; }
    }
    return [best, bm, bn];
  }
  function count(g, limit) {
    const [i, m, n] = pick(g);
    if (i === -1) return 1;
    if (n === 0) return 0;
    let c = 0;
    for (const d of bits(m)) { g[i] = d; c += count(g, limit - c); if (c >= limit) break; }
    g[i] = 0; return c;
  }
  function fill(g) {
    const [i, m, n] = pick(g);
    if (i === -1) return true;
    if (n === 0) return false;
    for (const d of shuffle(bits(m))) { g[i] = d; if (fill(g)) return true; }
    g[i] = 0; return false;
  }
  function generate(givens) {
    const sol = Array(81).fill(0); fill(sol);
    const puz = sol.slice(); let left = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (left <= givens) break;
      const v = puz[i]; puz[i] = 0;
      if (count(puz.slice(), 2) !== 1) puz[i] = v; else left--;
    }
    return { puz, sol };
  }
  return { generate, PEERS, ROW, COL, BOX };
})();

registerGame({
  id: 'sudoku', name: 'Sudoku', icon: '🔢', desc: 'Vier Schwierigkeitsstufen, Notizen & Tipps',
  mount(view, api) {
    const LEVELS = [['Leicht', 38], ['Mittel', 31], ['Schwer', 26], ['Experte', 22]];
    let G = null, sel = -1, notesMode = false, done = false;
    const timer = makeTimer(() => { status(); if (timer.sec % 5 === 0) save(); });
    const root = h('div', { class: 'sud' }); view.append(root);

    function save() { if (G && !done) Store.set('sud.save', { ...G, notes: G.notes, sec: timer.sec }); }
    function status() { if (G) api.setStatus(`${LEVELS[G.lvl][0]} · Fehler ${G.mistakes} · ${fmtTime(timer.sec)}`); }

    async function chooseNew() {
      const r = await modal('Neues Sudoku', 'Schwierigkeit wählen:', [...LEVELS.map(([n], i) => ({ label: n, value: i, primary: i === (G ? G.lvl : 1) })), { label: 'Abbrechen', value: -1 }]);
      if (r < 0) return;
      if (G && !done && G.cur.some((v, i) => v && !G.puz[i])) recordGame('sudoku', false);
      toast('Erzeuge Sudoku …');
      setTimeout(() => newGame(r), 30);
    }
    function newGame(lvl) {
      const { puz, sol } = SudokuGen.generate(LEVELS[lvl][1]);
      G = { lvl, puz, sol, cur: puz.slice(), notes: Array(81).fill(0), mistakes: 0, undo: [] };
      sel = -1; done = false; timer.reset(); render(); save();
    }

    function push() { G.undo.push(JSON.stringify([G.cur, G.notes])); if (G.undo.length > 200) G.undo.shift(); }
    function doUndo() { if (!G.undo.length || done) return; [G.cur, G.notes] = JSON.parse(G.undo.pop()); render(); save(); }

    function input(d) {
      if (done || sel < 0 || G.puz[sel]) return;
      if (G.cur[sel] && G.cur[sel] === G.sol[sel]) return; // korrekt gesetzte Zahl bleibt
      push();
      if (notesMode && d) {
        G.cur[sel] = 0; G.notes[sel] ^= (1 << d);
      } else if (!d) {
        G.cur[sel] = 0; G.notes[sel] = 0;
      } else {
        G.cur[sel] = d; G.notes[sel] = 0;
        if (d !== G.sol[sel]) { G.mistakes++; navigator.vibrate && navigator.vibrate(60); }
        else for (const p of SudokuGen.PEERS[sel]) G.notes[p] &= ~(1 << d);
        timer.start();
      }
      render(); save(); checkWin();
    }
    function hint() {
      if (done) return;
      let i = sel >= 0 && !G.puz[sel] && G.cur[sel] !== G.sol[sel] ? sel : -1;
      if (i < 0) { const open = G.cur.map((v, k) => k).filter(k => G.cur[k] !== G.sol[k]); if (!open.length) return; i = open[Math.floor(Math.random() * open.length)]; }
      push(); G.cur[i] = G.sol[i]; G.notes[i] = 0;
      for (const p of SudokuGen.PEERS[i]) G.notes[p] &= ~(1 << G.sol[i]);
      sel = i; render(); save(); checkWin();
    }
    function autoNotes() {
      if (done) return; push();
      for (let i = 0; i < 81; i++) if (!G.cur[i]) {
        let m = 0x3fe; for (const p of SudokuGen.PEERS[i]) if (G.cur[p]) m &= ~(1 << G.cur[p]);
        G.notes[i] = m;
      }
      render(); save();
    }
    async function checkWin() {
      if (!G.cur.every((v, i) => v === G.sol[i])) return;
      done = true; timer.stop(); Store.del('sud.save');
      const s = recordGame('sudoku', true, timer.sec);
      const r = await modal('🎉 Gelöst!', `${LEVELS[G.lvl][0]} in ${fmtTime(timer.sec)} mit ${G.mistakes} Fehler(n). Siege: ${s.won}`, [{ label: 'Schließen' }, { label: 'Neues Sudoku', primary: true }]);
      if (r === 1) chooseNew();
    }

    function render() {
      root.innerHTML = '';
      const sv = sel >= 0 ? G.cur[sel] : 0;
      const grid = h('div', { class: 'sud-grid' });
      for (let i = 0; i < 81; i++) {
        const r = SudokuGen.ROW(i), c = SudokuGen.COL(i), v = G.cur[i];
        let cls = 'sud-cell';
        if (G.puz[i]) cls += ' g';
        if (c === 2 || c === 5) cls += ' br';
        if (r === 2 || r === 5) cls += ' bb';
        if (sel >= 0) {
          if (i === sel) cls += ' sel';
          else if (sv && v === sv) cls += ' same';
          else if (SudokuGen.ROW(sel) === r || SudokuGen.COL(sel) === c || SudokuGen.BOX(sel) === SudokuGen.BOX(i)) cls += ' peer';
        }
        if (v && v !== G.sol[i]) cls += ' err';
        let content = v || '';
        if (!v && G.notes[i]) {
          content = h('div', { class: 'sud-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => h('span', null, G.notes[i] & (1 << d) ? d : '')));
        }
        grid.append(h('button', { class: cls, onclick: () => { sel = i; render(); } }, content));
      }
      const counts = Array(10).fill(0); G.cur.forEach((v, i) => { if (v && v === G.sol[i]) counts[v]++; });
      const pad = h('div', { class: 'sud-pad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
        h('button', { disabled: counts[d] >= 9, onclick: () => input(d) }, d, h('small', null, 9 - counts[d]))));
      const tools = h('div', { class: 'sud-tools' },
        h('button', { class: 'btn', onclick: doUndo }, '↶ Zurück'),
        h('button', { class: 'btn', onclick: () => input(0) }, '⌫ Löschen'),
        h('button', { class: 'btn' + (notesMode ? ' on' : ''), onclick: () => { notesMode = !notesMode; render(); } }, '✏️ Notizen'),
        h('button', { class: 'btn', onclick: hint }, '💡 Tipp'));
      root.append(grid, pad, tools);
      status();
    }

    function onKey(e) {
      if (!G || document.querySelector('.modal-bg')) return;
      if (e.key >= '1' && e.key <= '9') input(+e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') input(0);
      else if (e.key === 'n') { notesMode = !notesMode; render(); }
      else if (e.key.startsWith('Arrow')) {
        if (sel < 0) sel = 0;
        else sel = { ArrowUp: (sel + 72) % 81, ArrowDown: (sel + 9) % 81, ArrowLeft: sel - (sel % 9 === 0 ? -8 : 1), ArrowRight: sel + (sel % 9 === 8 ? -8 : 1) }[e.key];
        render(); e.preventDefault();
      }
    }
    document.addEventListener('keydown', onKey);

    api.setActions([
      { label: 'Neu', onclick: chooseNew },
      { label: '✨ Auto-Notizen', onclick: autoNotes },
    ]);

    const saved = Store.get('sud.save', null);
    if (saved && saved.puz) {
      G = saved; delete G.sec; timer.sec = saved.sec || 0; render(); toast('Spielstand geladen');
    } else { toast('Erzeuge Sudoku …'); setTimeout(() => newGame(1), 30); }

    return () => { save(); timer.stop(); document.removeEventListener('keydown', onKey); };
  },
});
