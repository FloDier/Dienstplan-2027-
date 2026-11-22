'use strict';
/* Router & Startseite */
(function () {
  const view = document.getElementById('view');
  const title = document.getElementById('title');
  const back = document.getElementById('back');
  const status = document.getElementById('status');
  const actions = document.getElementById('actions');
  let cleanup = null;

  const api = {
    setStatus(t) { status.textContent = t || ''; },
    setActions(list) {
      actions.innerHTML = '';
      for (const a of list) {
        if (!a) continue;
        actions.append(h('button', { class: a.on ? 'on' : '', onclick: a.onclick }, a.label));
      }
    },
  };

  function home() {
    title.textContent = 'Spielesammlung';
    back.hidden = true; api.setStatus(''); api.setActions([]);
    view.append(h('div', { class: 'home' }, GAMES.map(g => {
      const s = stats(g.id);
      let st = s.played ? `Gespielt ${s.played} · Gewonnen ${s.won}` : 'Noch nicht gespielt';
      if (s.best != null && g.timed !== false) st += ` · Best ${fmtTime(s.best)}`;
      return h('button', { class: 'tile', onclick: () => { location.hash = '#/' + g.id; } },
        h('span', { class: 'ic' }, g.icon), h('b', null, g.name), h('small', null, g.desc), h('span', { class: 'st' }, st));
    })));
  }

  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    document.querySelectorAll('.modal-bg').forEach(m => m.remove());
    view.innerHTML = ''; view.scrollTop = 0;
    const id = location.hash.replace(/^#\/?/, '');
    const g = GAMES.find(x => x.id === id);
    if (!g) return home();
    title.textContent = g.name; back.hidden = false;
    api.setStatus(''); api.setActions([]);
    cleanup = g.mount(view, api) || null;
  }

  back.onclick = () => { location.hash = ''; };
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
