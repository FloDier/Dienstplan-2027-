'use strict';
/* Gemeinsame Hilfsfunktionen für alle Spiele */
const GAMES = [];
function registerGame(g) { GAMES.push(g); }

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

const Store = {
  get(k, d) { try { const v = localStorage.getItem('spiele.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('spiele.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('spiele.' + k); } catch {} },
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let toastT;
function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

function modal(title, text, buttons = [{ label: 'OK', primary: true }]) {
  return new Promise(res => {
    const bg = h('div', { class: 'modal-bg' },
      h('div', { class: 'modal' },
        h('h2', null, title),
        text ? h('p', null, text) : null,
        h('div', { class: 'row' }, buttons.map((b, i) =>
          h('button', { class: 'btn' + (b.primary ? ' primary' : ''), onclick: () => { bg.remove(); res(b.value ?? i); } }, b.label)))));
    document.body.append(bg);
  });
}

function fmtTime(s) { const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }

function makeTimer(onTick) {
  let sec = 0, iv = null;
  return {
    get sec() { return sec; },
    set sec(v) { sec = v; },
    start() { if (!iv) iv = setInterval(() => { sec++; onTick && onTick(sec); }, 1000); },
    stop() { clearInterval(iv); iv = null; },
    reset() { this.stop(); sec = 0; onTick && onTick(0); },
    get running() { return !!iv; },
  };
}

/* Statistik pro Spiel: {played, won, best} */
function stats(id) { return Store.get('stats.' + id, { played: 0, won: 0, best: null }); }
function recordGame(id, won, timeSec) {
  const s = stats(id);
  s.played++;
  if (won) { s.won++; if (timeSec != null && (s.best == null || timeSec < s.best)) s.best = timeSec; }
  Store.set('stats.' + id, s);
  return s;
}

const SUIT_CH = ['♠', '♥', '♦', '♣'];
const isRedSuit = s => s === 1 || s === 2;
/* Karte rendern; rank: Anzeige-Text */
function cardNode(rankTxt, suit, faceUp = true, extra = '') {
  if (!faceUp) return h('div', { class: 'card back ' + extra });
  return h('div', { class: 'card' + (isRedSuit(suit) ? ' red ' : ' ') + extra },
    h('span', { class: 'cr' }, rankTxt + SUIT_CH[suit]),
    h('span', { class: 'cs' }, SUIT_CH[suit]));
}
