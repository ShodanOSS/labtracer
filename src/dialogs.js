// Modals, popups, toasts.
import { h, clear } from './util.js';

const layer = () => document.getElementById('overlay');

export function toast(msg, kind = 'info', ms = 2600) {
  const t = h('div', { class: 'toast ' + kind }, msg);
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Open a modal. Returns {close, el}. buttons: [{label, primary, danger, onClick(close) => bool|void}] */
export function modal(title, body, buttons = [{ label: 'Close' }], opts = {}) {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); opts.onClose && opts.onClose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  const foot = h('div', { class: 'modal-foot' }, buttons.map(b => h('button', {
    class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
    onclick: async () => { const keep = b.onClick ? await b.onClick(close) : false; if (keep !== true) close(); },
  }, b.label)));
  const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog' },
    h('div', { class: 'modal-head' }, h('span', null, title), h('button', { class: 'x', title: 'Close', onclick: close }, '×')),
    h('div', { class: 'modal-body' }, body), foot);
  back.appendChild(box);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  layer().appendChild(back);
  const first = box.querySelector('input,select,textarea');
  if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
  return { close, el: box };
}

export function promptText(title, label, value = '', ok = 'OK') {
  return new Promise(res => {
    const inp = h('input', { class: 'inp', value, onkeydown: e => { if (e.key === 'Enter') { done = true; res(inp.value.trim()); m.close(); } } });
    let done = false;
    const m = modal(title, h('label', { class: 'fld' }, h('span', null, label), inp), [
      { label: 'Cancel' }, { label: ok, primary: true, onClick: () => { done = true; res(inp.value.trim()); } },
    ], { onClose: () => { if (!done) res(null); } });
    setTimeout(() => inp.select(), 40);
  });
}

export function confirmBox(title, text, ok = 'OK', danger = false) {
  return new Promise(res => {
    let done = false;
    modal(title, h('p', null, text), [{ label: 'Cancel' }, { label: ok, primary: !danger, danger, onClick: () => { done = true; res(true); } }], { onClose: () => { if (!done) res(false); } });
  });
}

/** Small popup menu at a screen position. items: [{label, sub, disabled, onClick}] or '-' */
export function popup(x, y, title, items) {
  closePopup();
  const el = h('div', { class: 'popup', id: 'popup' },
    title ? h('div', { class: 'popup-title' }, title) : null,
    h('div', { class: 'popup-list' }, items.map(it => it === '-' ? h('hr') : h('button', {
      class: 'popup-item' + (it.disabled ? ' disabled' : '') + (it.cls ? ' ' + it.cls : ''),
      disabled: it.disabled, onclick: () => { closePopup(); it.onClick && it.onClick(); },
    }, h('span', null, it.label), it.sub ? h('small', null, it.sub) : null))));
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(x + 6, innerWidth - r.width - 8) + 'px';
  el.style.top = Math.min(y + 6, innerHeight - r.height - 8) + 'px';
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  return el;
}
function outside(e) { const p = document.getElementById('popup'); if (p && !p.contains(e.target)) closePopup(); }
export function closePopup() { document.getElementById('popup')?.remove(); document.removeEventListener('mousedown', outside, true); }

export { clear };
