'use strict';
/* Nonogramm (Picross): Zahlen geben die Blocklängen je Zeile/Spalte an */
registerGame({
  id: 'nonogramm', name: 'Logikrätsel', icon: '🧩', desc: 'Nonogramm – Bild aus Zahlenhinweisen aufdecken',
  mount(view, api) {
    let n = Store.get('ng.size', 10), sol, cells, tool = 1, done = false, hist = [];
    const timer = makeTimer(() => status());
    const root = h('div', { class: 'ng' }); view.append(root);

    const runs = line => { const r = []; let c = 0; for (const v of line) { if (v === 1) c++; else if (c) { r.push(c); c = 0; } } if (c) r.push(c); return r.length ? r : [0]; };
    const row = (g, y) => g.slice(y * n, y * n + n);
    const col = (g, x) => { const r = []; for (let y = 0; y < n; y++) r.push(g[y * n + x]); return r; };
    const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    let rowClues, colClues;

    function newGame(count) {
      if (count && hist.length && !done) recordGame('nonogramm', false);
      do {
        sol = Array.from({ length: n * n }, () => Math.random() < 0.58 ? 1 : 0);
      } while ([...Array(n).keys()].some(i => !row(sol, i).some(Boolean) || !col(sol, i).some(Boolean)));
      rowClues = [...Array(n).keys()].map(y => runs(row(sol, y)));
      colClues = [...Array(n).keys()].map(x => runs(col(sol, x)));
      cells = Array(n * n).fill(0); done = false; hist = []; timer.reset(); render();
    }
    const fillOnly = g => g.map(v => v === 1 ? 1 : 0);

    function status() { api.setStatus(`${n}×${n} · ${fmtTime(timer.sec)}`); }

    function checkWin() {
      const f = fillOnly(cells);
      for (let i = 0; i < n; i++) if (!eq(runs(row(f, i)), rowClues[i]) || !eq(runs(col(f, i)), colClues[i])) return;
      done = true; timer.stop();
      cells = cells.map(v => v === 1 ? 1 : 0); render();
      const s = recordGame('nonogramm', true, timer.sec);
      setTimeout(async () => {
        const r = await modal('🎉 Gelöst!', `${n}×${n} in ${fmtTime(timer.sec)}. Siege: ${s.won}`, [{ label: 'Schließen' }, { label: 'Neues Rätsel', primary: true }]);
        if (r === 1) newGame(false);
      }, 300);
    }

    let gridEl, paintVal = null, cellEls = [];
    function render() {
      root.innerHTML = '';
      const f = fillOnly(cells);
      const maxR = Math.max(...rowClues.map(c => c.length)), maxC = Math.max(...colClues.map(c => c.length));
      const W = Math.min(view.clientWidth - 24, 640), H = view.clientHeight - 90;
      const cs = Math.max(18, Math.floor(Math.min(W / (n + maxR * 0.62), H / (n + maxC * 0.62))));
      const fs = Math.max(10, Math.round(cs * 0.5));
      gridEl = h('div', { class: 'ng-grid', style: { gridTemplateColumns: `auto repeat(${n}, ${cs}px)`, '--cs': cs + 'px', '--fs': fs + 'px' } });
      gridEl.style.setProperty('--cs', cs + 'px'); gridEl.style.setProperty('--fs', fs + 'px');
      gridEl.append(h('div', { class: 'ng-corner' }));
      for (let x = 0; x < n; x++) gridEl.append(h('div', { class: 'ng-cc' + (eq(runs(col(f, x)), colClues[x]) ? ' done' : ''), style: x % 5 === 4 && x < n - 1 ? { borderRight: '2px solid #111' } : null }, colClues[x].map(v => h('span', null, v))));
      cellEls = [];
      for (let y = 0; y < n; y++) {
        gridEl.append(h('div', { class: 'ng-rc' + (eq(runs(row(f, y)), rowClues[y]) ? ' done' : ''), style: y % 5 === 4 && y < n - 1 ? { borderBottom: '2px solid #111' } : null }, rowClues[y].map(v => h('span', null, v))));
        for (let x = 0; x < n; x++) {
          const i = y * n + x, v = cells[i];
          const el = h('div', { class: 'ng-cell' + (v === 1 ? ' f' : '') + (x % 5 === 4 && x < n - 1 ? ' r5' : '') + (y % 5 === 4 && y < n - 1 ? ' b5' : ''), 'data-i': i }, v === 2 ? '✕' : '');
          cellEls.push(el); gridEl.append(el);
        }
      }
      gridEl.addEventListener('pointerdown', down);
      gridEl.addEventListener('pointermove', move);
      const tools = h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
        h('button', { class: 'btn' + (tool === 1 ? ' on' : ''), onclick: () => { tool = 1; render(); } }, '⬛ Füllen'),
        h('button', { class: 'btn' + (tool === 2 ? ' on' : ''), onclick: () => { tool = 2; render(); } }, '✕ Markieren'));
      root.append(gridEl, tools);
      status();
    }

    function cellAt(e) { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.dataset && t.dataset.i != null ? +t.dataset.i : -1; }
    function setCell(i) {
      if (i < 0 || cells[i] === paintVal) return;
      // nur über Zellen malen, die zum Startzustand passen (verhindert versehentliches Überschreiben)
      if (paintVal !== 0 && cells[i] !== 0) return;
      cells[i] = paintVal;
      const el = cellEls[i]; el.classList.toggle('f', paintVal === 1); el.textContent = paintVal === 2 ? '✕' : '';
    }
    function down(e) {
      if (done) return;
      const i = cellAt(e); if (i < 0) return;
      e.preventDefault();
      hist.push(cells.slice()); if (hist.length > 200) hist.shift();
      paintVal = cells[i] === tool ? 0 : tool;
      if (paintVal !== 0 && cells[i] !== 0) cells[i] = 0;
      setCell(i); timer.start();
      const up = () => { paintVal = null; window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); render(); checkWin(); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }
    function move(e) { if (paintVal == null) return; setCell(cellAt(e)); }

    function doUndo() { if (!hist.length || done) return; cells = hist.pop(); render(); }
    function hint() {
      if (done) return;
      const wrong = cells.map((v, i) => i).filter(i => (cells[i] === 1) !== (sol[i] === 1) || (cells[i] === 0));
      if (!wrong.length) return;
      // bevorzugt falsch gefüllte Zellen korrigieren
      const bad = wrong.filter(i => cells[i] === 1 && !sol[i]);
      const i = bad.length ? bad[0] : wrong[Math.floor(Math.random() * wrong.length)];
      hist.push(cells.slice());
      cells[i] = sol[i] ? 1 : 2; render();
      cellEls[i].classList.add('hl'); setTimeout(() => cellEls[i] && cellEls[i].classList.remove('hl'), 900);
      checkWin();
    }
    function clearAll() { if (done) return; hist.push(cells.slice()); cells.fill(0); render(); }

    async function chooseSize() {
      const r = await modal('Neues Rätsel', 'Größe wählen:', [5, 10, 15].map(s => ({ label: `${s}×${s}`, value: s, primary: s === n })).concat([{ label: 'Abbrechen', value: 0 }]));
      if (!r) return;
      n = r; Store.set('ng.size', n); newGame(true);
    }

    api.setActions([
      { label: 'Neu', onclick: chooseSize },
      { label: '↶ Zurück', onclick: doUndo },
      { label: '💡 Tipp', onclick: hint },
      { label: '🗑 Leeren', onclick: clearAll },
      { label: '❓ Regeln', onclick: () => modal('So geht\'s', 'Die Zahlen links und oben geben an, wie lang die zusammenhängenden schwarzen Blöcke in der Zeile/Spalte sind – in dieser Reihenfolge, mit mindestens einem leeren Feld dazwischen. Mit „✕“ markierst du sicher leere Felder. Ziehen färbt mehrere Felder.') },
    ]);
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    newGame(false);
    return () => { timer.stop(); window.removeEventListener('resize', onResize); if (hist.length && !done) recordGame('nonogramm', false); };
  },
});
