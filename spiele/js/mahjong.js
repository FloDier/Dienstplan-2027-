'use strict';
/* Mahjong-Solitär: Paare freier Steine entfernen. Jede Partie ist garantiert lösbar. */
registerGame({
  id: 'mahjong', name: 'Mahjong', icon: '🀄', desc: 'Solitär mit 84 Steinen – immer lösbar',
  mount(view, api) {
    const FACES = ['🐉', '🌸', '🎋', '🍀', '🌙', '⭐', '🔥', '💧', '🍎', '🍇', '🍋', '🍒', '🐼', '🐟', '🦋', '🐢', '🎍', '🏮', '🌻', '💎', '🍄'];
    // Positionen in Halb-Einheiten, jeder Stein belegt 2×2
    const POS = [];
    for (let y = 0; y <= 10; y += 2) for (let x = 0; x <= 14; x += 2) POS.push({ x, y, z: 0 });
    for (let y = 2; y <= 8; y += 2) for (let x = 2; x <= 12; x += 2) POS.push({ x, y, z: 1 });
    for (let y = 4; y <= 6; y += 2) for (let x = 4; x <= 10; x += 2) POS.push({ x, y, z: 2 });
    POS.push({ x: 6, y: 5, z: 3 }, { x: 8, y: 5, z: 3 }, { x: -2, y: 5, z: 0 }, { x: 16, y: 5, z: 0 });

    let face = [], alive = [], sel = -1, hist = [], hint = [], done = false;
    const timer = makeTimer(() => status());
    const wrap = h('div', { class: 'mj-wrap' });
    const boardEl = h('div', { class: 'mj-board' });
    wrap.append(boardEl); view.append(wrap);

    function isFree(i, live) {
      const t = POS[i]; let left = false, right = false;
      for (let j = 0; j < POS.length; j++) {
        if (j === i || !live[j]) continue;
        const u = POS[j];
        if (u.z === t.z + 1 && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2) return false;
        if (u.z === t.z && Math.abs(u.y - t.y) < 2) {
          if (u.x === t.x - 2) left = true;
          if (u.x === t.x + 2) right = true;
        }
      }
      return !(left && right);
    }

    // Lösbare Zuordnung: Spiel vorwärts simulieren und Paare freier Felder ziehen
    function solvableOrder(indices) {
      for (let attempt = 0; attempt < 500; attempt++) {
        const live = Array(POS.length).fill(false); indices.forEach(i => live[i] = true);
        let left = indices.length; const order = [];
        while (left > 0) {
          const free = indices.filter(i => live[i] && isFree(i, live));
          if (free.length < 2) break;
          shuffle(free);
          const a = free[0], b = free[1];
          order.push([a, b]); live[a] = live[b] = false; left -= 2;
        }
        if (left === 0) return order;
      }
      return null;
    }
    function assign(indices, pairs) {
      const order = solvableOrder(indices);
      if (!order) return false;
      shuffle(pairs);
      order.forEach(([a, b], k) => { face[a] = face[b] = pairs[k]; });
      return true;
    }

    function newGame(count) {
      if (count && hist.length && !done) recordGame('mahjong', false);
      face = Array(POS.length); alive = Array(POS.length).fill(true);
      const pairs = []; for (let k = 0; k < POS.length / 2; k++) pairs.push(k % FACES.length);
      assign(POS.map((_, i) => i), pairs);
      sel = -1; hist = []; hint = []; done = false; timer.reset(); render();
    }

    function reshuffle() {
      const idx = POS.map((_, i) => i).filter(i => alive[i]);
      const cnt = {}; idx.forEach(i => cnt[face[i]] = (cnt[face[i]] || 0) + 1);
      const pairs = []; for (const f in cnt) for (let k = 0; k < cnt[f] / 2; k++) pairs.push(+f);
      if (!assign(idx, pairs)) { toast('Mischen nicht möglich'); return; }
      sel = -1; hint = []; render(); toast('Neu gemischt');
    }

    function findPairs() {
      const free = POS.map((_, i) => i).filter(i => alive[i] && isFree(i, alive));
      const res = [];
      for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++)
        if (face[free[a]] === face[free[b]]) res.push([free[a], free[b]]);
      return res;
    }

    function click(i) {
      if (done) return;
      if (!isFree(i, alive)) { toast('Stein ist blockiert'); return; }
      hint = [];
      if (sel === -1 || sel === i) { sel = sel === i ? -1 : i; render(); return; }
      if (face[sel] === face[i]) {
        alive[sel] = alive[i] = false; hist.push([sel, i]); sel = -1; timer.start();
        render(); afterMove();
      } else { sel = i; render(); }
    }

    async function afterMove() {
      if (alive.every(a => !a)) {
        done = true; timer.stop();
        const s = recordGame('mahjong', true, timer.sec);
        const r = await modal('🎉 Geschafft!', `Alle Steine abgeräumt in ${fmtTime(timer.sec)}. Siege: ${s.won}`, [{ label: 'Schließen' }, { label: 'Neues Spiel', primary: true }]);
        if (r === 1) newGame(false);
        return;
      }
      if (!findPairs().length) {
        const r = await modal('Keine Züge mehr', 'Es gibt kein passendes freies Paar.', [{ label: 'Zurück' }, { label: 'Mischen', primary: true }]);
        if (r === 1) reshuffle(); else doUndo();
      }
    }

    function doUndo() {
      if (!hist.length || done) return;
      const [a, b] = hist.pop(); alive[a] = alive[b] = true; sel = -1; hint = []; render();
    }
    function doHint() {
      const p = findPairs();
      if (!p.length) { toast('Kein Paar – bitte mischen'); return; }
      hint = p[Math.floor(Math.random() * p.length)]; sel = -1; render();
    }

    function status() {
      const left = alive.filter(Boolean).length;
      api.setStatus(`${left} Steine · ${fmtTime(timer.sec)}`);
    }

    function render() {
      const cols = 10, rows = 6;
      const availW = view.clientWidth - 24, availH = view.clientHeight - 24;
      let tw = Math.min(70, availW / (cols + 0.6));
      let th = tw * 1.3;
      if (th * (rows + 0.5) > availH && availH > 200) { th = availH / (rows + 0.5); tw = th / 1.3; }
      const d = tw * 0.1;
      boardEl.style.width = cols * tw + 4 * d + 6 + 'px';
      boardEl.style.height = rows * th + 4 * d + 6 + 'px';
      boardEl.innerHTML = '';
      const order = POS.map((p, i) => i).filter(i => alive[i]).sort((a, b) => POS[a].z - POS[b].z || POS[b].x - POS[a].x || POS[a].y - POS[b].y);
      for (const i of order) {
        const p = POS[i];
        const free = isFree(i, alive);
        const el = h('div', {
          class: 'mj-tile' + (free ? '' : ' blocked') + (i === sel ? ' sel' : '') + (hint.includes(i) ? ' hint' : ''),
          style: {
            left: ((p.x + 2) / 2) * tw - p.z * d + 3 * d + 'px', top: (p.y / 2) * th - p.z * d + 3 * d + 'px',
            width: tw - 2 + 'px', height: th - 2 + 'px', fontSize: tw * 0.62 + 'px', zIndex: p.z * 1000 + (20 - p.x) * 10 + p.y,
          },
          onclick: () => click(i),
        }, FACES[face[i]]);
        boardEl.append(el);
      }
      status();
    }

    api.setActions([
      { label: 'Neu', onclick: () => newGame(true) },
      { label: '↶ Zurück', onclick: doUndo },
      { label: '💡 Tipp', onclick: doHint },
      { label: '🔀 Mischen', onclick: reshuffle },
    ]);
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    newGame(false);
    return () => { timer.stop(); window.removeEventListener('resize', onResize); if (hist.length && !done) recordGame('mahjong', false); };
  },
});
