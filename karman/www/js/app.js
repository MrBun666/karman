// Интерфейс приложения
import { S, loadState, save, saveNow, replaceState } from './state.js';
import * as U from './util.js';
import * as F from './finance.js';
import * as K from './kaspi.js';
import * as AI from './ai.js';
import { LESSONS } from './lessons.js';
import * as N from './native.js';

const APP = self.APP_NAME || 'Карман';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = U.esc, money = U.money;
const ui = { repKind: 'week', repDate: U.today(), txMonth: U.curYm(), calMonth: U.curYm(), calDay: U.today(), statsMonth: U.curYm(), txFilter: 'all', txSearch: '', chatBusy: false, debtExtra: null, priceQ: '' };
let swReg = null, updating = false, hiddenAt = 0, locked = false;

// ============ Общие элементы ============
function toast(text, action) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  $('#toast-root').append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, action ? 6000 : 2800);
}

const sheets = [];
let ignorePops = 0;
function sheet(html, { title = '', onMount, full = false, cls = '' } = {}) {
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet-bg"></div><div class="sheet ${full ? 'full' : ''} ${cls}"><div class="sheet-head"><div class="sheet-handle"></div>${title ? `<h3>${esc(title)}</h3>` : '<span></span>'}<button class="sheet-x" type="button" aria-label="Закрыть">✕</button></div><div class="sheet-body">${html}</div></div>`;
  document.body.append(w);
  document.body.classList.add('noscroll');
  const close = (fromNav = false) => {
    const i = sheets.indexOf(close);
    if (i < 0) return;
    sheets.splice(i, 1);
    w.classList.remove('open');
    setTimeout(() => w.remove(), 220);
    if (!sheets.length) document.body.classList.remove('noscroll');
    if (!fromNav) { ignorePops++; history.back(); }
  };
  w.querySelector('.sheet-bg').onclick = () => close();
  w.querySelector('.sheet-x').onclick = () => close();
  sheets.push(close);
  history.pushState({ sheet: true }, '');
  requestAnimationFrame(() => w.classList.add('open'));
  onMount?.(w.querySelector('.sheet-body'), close);
  return close;
}
window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; return; }
  if (sheets.length) sheets[sheets.length - 1](true);
});
const closeAllSheets = () => [...sheets].reverse().forEach(c => c(true));

function ask(title, text, ok = 'Да', danger = false) {
  return new Promise(res => {
    let done = false;
    const close = sheet(`<p class="muted">${text}</p><div class="actions"><button class="btn ghost grow" data-no type="button">Отмена</button><button class="btn ${danger ? 'danger' : 'primary'} grow" data-yes type="button">${esc(ok)}</button></div>`, {
      title, onMount(r, c) {
        r.querySelector('[data-yes]').onclick = () => { done = true; c(); res(true); };
        r.querySelector('[data-no]').onclick = () => { done = true; c(); res(false); };
      },
    });
    const obs = setInterval(() => { if (!sheets.includes(close)) { clearInterval(obs); if (!done) res(false); } }, 300);
  });
}

function loading(text) {
  const w = document.createElement('div');
  w.className = 'loading';
  w.innerHTML = `<div class="loading-box"><div class="spinner"></div><div class="lt">${esc(text)}</div></div>`;
  document.body.append(w);
  return { close: () => w.remove(), set: t => { w.querySelector('.lt').textContent = t; } };
}

function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}

function md(t) {
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', list = null;
  for (const raw of esc(t).split('\n')) {
    const l = raw.trim();
    const li = l.match(/^([-•*]|\d+[.)])\s+(.*)/);
    if (li) {
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== tag) { if (list) html += `</${list}>`; html += `<${tag}>`; list = tag; }
      html += `<li>${inline(li[2])}</li>`; continue;
    }
    if (list) { html += `</${list}>`; list = null; }
    if (!l) continue;
    const h = l.match(/^#{1,4}\s+(.*)/);
    html += h ? `<p><b>${inline(h[1])}</b></p>` : `<p>${inline(l)}</p>`;
  }
  if (list) html += `</${list}>`;
  return html;
}

const kfmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'м' : n >= 1000 ? Math.round(n / 1000) + 'к' : Math.round(n) + '';
const fv = (f, n) => f.elements[n]?.value ?? '';
const fc = (f, n) => !!f.elements[n]?.checked;
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function catChips(type, selected, name = 'cat') {
  return `<div class="catgrid">${S.categories.filter(c => c.type === type && (!c.hidden || c.id === selected)).map(c => `<label class="catchip"><input type="radio" name="${name}" value="${c.id}" ${c.id === selected ? 'checked' : ''}><span><i>${c.icon}</i>${esc(c.name)}</span></label>`).join('')}</div>`;
}
function accChips(name, selected, except) {
  return `<div class="chips">${S.accounts.filter(a => a.id !== except && (!a.hidden || a.id === selected)).map(a => `<label class="pill"><input type="radio" name="${name}" value="${a.id}" ${a.id === selected ? 'checked' : ''}><span>${a.icon} ${esc(a.name)}</span></label>`).join('')}</div>`;
}
function catSelect(type, selected, attrs = '') {
  return `<select ${attrs}>${S.categories.filter(c => c.type === type).map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>`;
}
const monthSwitch = (key) => `<div class="mswitch"><button data-a="month" data-k="${key}" data-d="-1" aria-label="Предыдущий месяц">‹</button><b>${U.fmtMonth(ui[key])}</b><button data-a="month" data-k="${key}" data-d="1" aria-label="Следующий месяц">›</button></div>`;
const bar = (p, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.round(U.clamp(p, 0, 1) * 100)}%"></i></div>`;

function txTitle(t) { return t.note || t.merchant || (t.type === 'transfer' ? 'Перевод между счетами' : F.catName(S, t.categoryId)); }
function txRow(t) {
  const c = F.cat(S, t.categoryId), a = F.acc(S, t.accountId);
  const isT = t.type === 'transfer';
  const sub = isT ? `${a?.name || ''} → ${F.acc(S, t.toAccountId)?.name || ''}` : `${c?.name || 'Без категории'} · ${a?.name || ''}`;
  return `<div class="tx" data-a="tx-edit" data-id="${t.id}">
    <div class="ic">${isT ? '🔄' : (c?.icon || '•')}</div>
    <div class="grow min0"><div class="t1">${esc(txTitle(t))}</div><div class="sub">${esc(sub)}${t.items?.length ? ` · 🧾 ${t.items.length}` : ''}</div></div>
    <div class="amt ${t.type === 'income' ? 'pos' : isT ? 'muted' : ''}">${t.type === 'income' ? '+' : isT ? '' : '−'}${money(t.amount)}</div></div>`;
}
function occRow(o, withDate = true) {
  const ev = o.ev, c = F.cat(S, ev.categoryId);
  const paid = !!o.paidTx, late = !paid && !o.skipped && o.date < U.today();
  const inc = ev.type === 'income';
  return `<div class="occ ${paid ? 'paid' : ''} ${late ? 'late' : ''} ${o.skipped ? 'skipped' : ''}" data-a="occ" data-id="${ev.id}" data-ym="${o.ym}">
    <div class="ic">${c?.icon || '📌'}</div>
    <div class="grow min0"><div class="t1">${esc(ev.title)}${ev.recurring ? ' <span class="rep" title="На постоянку">🔁</span>' : ''}</div>
    <div class="sub">${withDate ? U.fmtDateRel(o.date) : ''}${ev.months ? `${withDate ? ' · ' : ''}${o.index}/${ev.months}` : ''}${late ? ' · просрочено' : ''}${paid ? ' · оплачено' : ''}${o.skipped ? ' · пропуск' : ''}</div></div>
    <div class="amt ${inc ? 'pos' : ''}">${inc ? '+' : ''}${money(ev.amount)}</div>
    ${!paid && !o.skipped ? `<button class="btn-mini" data-a="occ-pay" data-id="${ev.id}" data-ym="${o.ym}">${inc ? 'Пришло' : 'Оплачено'}</button>` : paid ? '<span class="okmark">✓</span>' : ''}
  </div>`;
}

// ============ Экраны ============
const ROUTES = {
  home: { title: APP, tab: 'home', render: vHome },
  tx: { title: 'Операции', tab: 'tx', render: vTx },
  cal: { title: 'Календарь', tab: 'cal', render: vCal },
  chat: { title: 'ИИ-помощник', tab: 'chat', render: vChat },
  more: { title: 'Ещё', tab: 'more', render: vMore },
  goals: { title: 'Цели', tab: 'more', back: 'more', render: vGoals },
  debts: { title: 'Кредиты', tab: 'more', back: 'more', render: vDebts },
  stats: { title: 'Аналитика', tab: 'more', back: 'more', render: vStats },
  reports: { title: 'Отчёты', tab: 'more', back: 'home', render: vReports },
  prices: { title: 'Цены по чекам', tab: 'more', back: 'more', render: vPrices },
  learn: { title: 'Финграмотность', tab: 'more', back: 'more', render: vLearn },
  import: { title: 'Импорт', tab: 'more', back: 'more', render: vImport },
  settings: { title: 'Настройки', tab: 'more', back: 'more', render: vSettings },
};
const route = () => (location.hash.slice(1).split('?')[0]) || 'home';

function render(scrollTop = false) {
  const r = ROUTES[route()] || ROUTES.home;
  const res = r.render();
  const v = $('#view');
  v.className = 'view view-' + route();
  v.innerHTML = res.html;
  const right = res.right || '';
  $('#topbar').innerHTML = `${r.back ? `<a class="back" href="#${r.back}" aria-label="Назад">‹</a>` : ''}<h1>${esc(res.title || r.title)}</h1><div class="tb-right">${right}</div>`;
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === r.tab));
  res.mount?.(v);
  if (scrollTop) window.scrollTo(0, 0);
}
const refresh = () => render(false);
function commit(msg, action) { save(); scheduleSync(); refresh(); if (msg) toast(msg, action); }

// ----- Главная -----
function vHome() {
  const bal = F.totalBalance(S), sts = F.safeToSpend(S), st = F.monthStats(S, U.curYm());
  const over = F.overdue(S), up = F.upcoming(S, 7);
  const sugg = F.detectRecurring(S).slice(0, 2);
  const tips = F.tips(S).slice(0, 2);
  const hour = new Date().getHours();
  const hi = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const topCats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCat = topCats[0]?.[1] || 1;
  const needBackup = S.transactions.length > 10 && (!S.settings.lastBackup || U.daysBetween(S.settings.lastBackup, U.today()) > 14);
  const goals = S.goals.filter(g => !F.goalPlan(g).done).slice(0, 2);
  const today = F.rangeStats(S, U.today(), U.today());

  const html = `
  <section class="hero">
    <div class="muted small">${hi}${S.settings.name ? ', ' + esc(S.settings.name) : ''} · ${U.fmtDateRel(U.today())}</div>
    <div class="big ${bal < 0 ? 'neg' : ''}">${money(bal)}</div>
    <div class="acc-list">${S.accounts.filter(a => !a.hidden).map(a => `<button class="acc-chip" data-a="acc-edit" data-id="${a.id}"><span>${a.icon}</span><span class="grow">${esc(a.name)}</span><b>${money(F.accountBalance(S, a))}</b></button>`).join('')}</div>
  </section>

  <section class="card sts">
    <div class="row"><div class="grow"><div class="muted small">Можно тратить в день</div><div class="big2 ${sts.perDay < 0 ? 'neg' : 'pos'}">${money(sts.perDay)}</div></div>
    <div class="right small muted">до ${U.fmtDate(sts.until)}<br>${sts.days} ${U.plural(sts.days, 'день', 'дня', 'дней')}</div></div>
    <div class="small muted mt6">${money(sts.bal)} на счетах − ${money(sts.due)} платежей${sts.goals ? ` − ${money(sts.goals)} на цели` : ''}</div>
    <div class="row mt6 small"><span>Сегодня потрачено <b>${money(today.spending)}</b></span><a href="#reports" data-a="rep-open" data-k="day">Отчёт за день ›</a></div>
  </section>
  ${periodCard()}

  <section class="quick">
    <button data-a="add" data-type="expense"><i>➖</i>Расход</button>
    <button data-a="add" data-type="income"><i>➕</i>Доход</button>
    <button data-a="voice"><i>🎤</i>Голосом</button>
    <button data-a="receipt"><i>🧾</i>Чек</button>
    <button data-a="import-pdf"><i>📄</i>Kaspi</button>
  </section>

  ${over.length || up.length ? `<section class="card"><div class="card-h"><h2>Платежи</h2><a href="#cal">Календарь ›</a></div>
    ${over.map(o => occRow(o)).join('')}${up.map(o => occRow(o)).join('')}</section>` : `<section class="card empty-mini"><div>📅 Добавь регулярные платежи — коммуналку, связь, кредиты. Приложение будет напоминать каждый месяц.</div><button class="btn small" data-a="ev-add">+ Платёж</button></section>`}

  ${sugg.map(s => `<section class="card suggest"><div class="row"><div class="ic">🔁</div><div class="grow"><b>Похоже на регулярный платёж</b><div class="small muted">${esc(s.title)} · ~${money(s.amount)} около ${s.day}-го, ${s.months} мес. подряд</div></div></div>
    <div class="actions"><button class="btn ghost small" data-a="sugg-hide" data-key="${esc(s.key)}">Скрыть</button><button class="btn primary small" data-a="sugg-add" data-key="${esc(s.key)}">В календарь на постоянку</button></div></section>`).join('')}

  <section class="card">
    <div class="card-h"><h2>${U.cap(U.MONTHS[+U.curYm().slice(5) - 1])}</h2><a href="#stats">Аналитика ›</a></div>
    <div class="trio"><div><span class="muted small">Доход</span><b class="pos">${money(st.income)}</b></div><div><span class="muted small">Расход</span><b>${money(st.spending)}</b></div><div><span class="muted small">Отложено</span><b>${money(st.savings)}</b></div></div>
    ${topCats.length ? `<div class="catbars">${topCats.map(([c, v]) => `<div class="cb"><span>${F.cat(S, c)?.icon || '•'} ${esc(F.catName(S, c))}</span><b>${money(v)}</b>${bar(v / maxCat)}</div>`).join('')}</div>` : '<p class="muted small">Пока нет трат в этом месяце.</p>'}
    <div class="rep-links"><span class="small muted">Отчёт:</span><button class="pill" data-a="rep-open" data-k="day">День</button><button class="pill" data-a="rep-open" data-k="week">Неделя</button><button class="pill" data-a="rep-open" data-k="month">Месяц</button></div>
  </section>

  <section class="card"><div class="card-h"><h2>Советы</h2><a href="#stats">Все ›</a></div>${tips.map(tipHtml).join('')}</section>

  ${goals.length ? `<section class="card"><div class="card-h"><h2>Цели</h2><a href="#goals">Все ›</a></div>${goals.map(g => { const p = F.goalPlan(g); return `<div class="goal-mini" data-a="goal-open" data-id="${g.id}"><div class="row"><span>${g.icon || '🎯'} ${esc(g.name)}</span><span class="small muted">${money(g.saved)} из ${money(g.target)}</span></div>${bar(p.progress, 'accent')}</div>`; }).join('')}</section>` : ''}

  ${needBackup ? `<section class="card warnbox"><div>💾 Данные хранятся только на этом телефоне. Сделай резервную копию — на случай потери или смены телефона.</div><button class="btn small" data-a="backup-export">Сохранить копию</button></section>` : ''}
  ${!S.transactions.length ? `<section class="card intro"><h2>С чего начать</h2><ol><li>Загрузи выписку Kaspi (кнопка «Kaspi» выше).</li><li>Записывай наличные: «такси 2000 нал» на вкладке «Операции».</li><li>Фотографируй чеки — ИИ разложит покупки по категориям.</li><li>Добавь платежи в календарь «на постоянку».</li><li>Задай вопрос ИИ-помощнику во вкладке «Чат».</li></ol></section>` : ''}
  `;
  return { html, right: `<button class="icon-btn" data-a="go" data-to="settings" aria-label="Настройки">⚙️</button>` };
}

function tipHtml(t, i) {
  return `<div class="tip lvl-${t.lvl}"><div class="ic">${t.icon}</div><div class="grow"><b>${esc(t.title)}</b><div class="small">${esc(t.text)}</div>${t.action ? `<button class="btn small mt6" data-a="${t.action.a}" ${t.action.to ? `data-to="${t.action.to}"` : ''}>${esc(t.action.label)}</button>` : ''}</div></div>`;
}

// ----- Операции -----
function txFiltered() {
  let list = S.transactions.filter(t => t.date.startsWith(ui.txMonth));
  const f = ui.txFilter;
  if (['expense', 'income', 'transfer'].includes(f)) list = list.filter(t => t.type === f);
  else if (f.startsWith('acc:')) { const id = f.slice(4); list = list.filter(t => t.accountId === id || t.toAccountId === id); }
  if (ui.txSearch) {
    const q = ui.txSearch.toLowerCase();
    list = list.filter(t => `${t.note} ${t.merchant} ${F.catName(S, t.categoryId)} ${(t.items || []).map(i => i.name).join(' ')} ${t.amount}`.toLowerCase().includes(q));
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
}
function txListHtml() {
  const list = txFiltered();
  if (!list.length) return `<div class="empty">${ui.txSearch ? 'Ничего не найдено' : 'Операций за этот месяц нет.<br>Добавь расход кнопкой «+» или загрузи выписку Kaspi.'}</div>`;
  const byDay = {};
  for (const t of list) (byDay[t.date] ||= []).push(t);
  const inc = U.sum(list.filter(t => t.type === 'income' && !F.cat(S, t.categoryId)?.excluded), t => t.amount);
  const exp = U.sum(list.filter(t => t.type === 'expense'), t => t.amount);
  return `<div class="tx-sum small muted">${list.length} ${U.plural(list.length, 'операция', 'операции', 'операций')} · <span class="pos">+${money(inc)}</span> · −${money(exp)}</div>` +
    Object.entries(byDay).map(([d, arr]) => {
      const dayExp = U.sum(arr.filter(t => t.type === 'expense'), t => t.amount);
      return `<div class="day-h"><span>${U.fmtDateRel(d)}</span><span>${dayExp ? '−' + money(dayExp) : ''}</span></div><div class="card list">${arr.map(txRow).join('')}</div>`;
    }).join('');
}
function vTx() {
  const filters = [['all', 'Все'], ['expense', 'Расходы'], ['income', 'Доходы'], ['transfer', 'Переводы'], ...S.accounts.filter(a => !a.hidden).map(a => ['acc:' + a.id, a.icon + ' ' + a.name])];
  const html = `
    ${monthSwitch('txMonth')}
    <form class="quickin" id="quickf" autocomplete="off">
      <input name="q" placeholder="Быстро: такси 2000 нал · +150к зарплата" enterkeyhint="done">
      <button type="button" class="btn" data-a="voice" aria-label="Голосом">🎤</button>
      <button class="btn primary" aria-label="Записать">↵</button>
    </form>
    <div class="search"><input id="txsearch" type="search" placeholder="🔍 Поиск по операциям" value="${esc(ui.txSearch)}"></div>
    <div class="chips scroll">${filters.map(([v, l]) => `<button class="pill ${ui.txFilter === v ? 'on' : ''}" data-a="tx-filter" data-f="${v}">${esc(l)}</button>`).join('')}</div>
    <div id="txlist">${txListHtml()}</div>
    <button class="fab" data-a="add-menu" aria-label="Добавить">+</button>`;
  return {
    html, mount(v) {
      $('#quickf', v).onsubmit = e => {
        e.preventDefault();
        const text = fv(e.target, 'q').trim();
        if (!text) return;
        const p = F.parseQuick(S, text);
        if (!p) { toast('Не нашёл сумму. Пример: «кофе 1500 нал»'); return; }
        const tx = { id: U.uid(), ...p, source: 'manual', created: Date.now() };
        S.transactions.push(tx);
        ui.txMonth = tx.date.slice(0, 7);
        commit(`${p.type === 'income' ? '➕' : '➖'} ${money(p.amount)} · ${F.catName(S, p.categoryId)} · ${F.acc(S, p.accountId)?.name}`, { label: 'Изменить', fn: () => openTxForm(S.transactions.find(t => t.id === tx.id)) });
        setTimeout(() => $('#quickf input')?.focus(), 50);
      };
      $('#txsearch', v).oninput = e => { ui.txSearch = e.target.value; $('#txlist').innerHTML = txListHtml(); };
    },
  };
}

// ----- Календарь -----
function vCal() {
  const ym = ui.calMonth;
  const [y, m] = ym.split('-').map(Number);
  if (!ui.calDay.startsWith(ym)) ui.calDay = ym === U.curYm() ? U.today() : ym + '-01';
  const occ = F.monthOccurrences(S, ym);
  const byDay = {};
  for (const o of occ) (byDay[o.date] ||= []).push(o);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = U.daysInMonth(y, m), t = U.today();
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="day empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const date = `${ym}-${U.pad(d)}`, list = byDay[date] || [];
    const open = list.filter(o => F.isOpen(o) && o.ev.type === 'expense');
    const dots = list.slice(0, 3).map(o => `<i class="dot ${o.paidTx ? 'paid' : o.skipped ? 'skip' : o.ev.type === 'income' ? 'inc' : date < t ? 'late' : 'exp'}"></i>`).join('');
    cells += `<button class="day ${date === ui.calDay ? 'sel' : ''} ${date === t ? 'today' : ''} ${list.length ? 'has' : ''}" data-a="cal-day" data-d="${date}"><span class="dn">${d}</span>${open.length ? `<span class="da">${kfmt(U.sum(open, o => o.ev.amount))}</span>` : ''}<span class="dots">${dots}</span></button>`;
  }
  const dayList = byDay[ui.calDay] || [];
  const exp = occ.filter(o => o.ev.type === 'expense'), inc = occ.filter(o => o.ev.type === 'income');
  const expAll = U.sum(exp, o => o.ev.amount), expPaid = U.sum(exp.filter(o => o.paidTx), o => o.ev.amount);
  const html = `
    ${monthSwitch('calMonth')}
    <div class="card cal">
      <div class="wd">${U.WD_SHORT.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="grid">${cells}</div>
      <div class="legend small muted"><span><i class="dot exp"></i>платёж</span><span><i class="dot inc"></i>поступление</span><span><i class="dot paid"></i>оплачено</span><span><i class="dot late"></i>просрочено</span></div>
    </div>
    <div class="card">
      <div class="card-h"><h2>${U.fmtDateRel(ui.calDay)}</h2><button class="btn small" data-a="ev-add" data-d="${ui.calDay}">+ На этот день</button></div>
      ${dayList.length ? dayList.map(o => occRow(o, false)).join('') : '<p class="muted small">Нет платежей на этот день.</p>'}
    </div>
    <div class="card">
      <div class="card-h"><h2>Весь месяц</h2></div>
      <div class="trio"><div><span class="muted small">Платежи</span><b>${money(expAll)}</b></div><div><span class="muted small">Оплачено</span><b class="pos">${money(expPaid)}</b></div><div><span class="muted small">Осталось</span><b>${money(expAll - expPaid)}</b></div></div>
      ${expAll ? bar(expPaid / expAll, 'accent') : ''}
      ${inc.length ? `<div class="small muted mt6">Поступления: ${money(U.sum(inc, o => o.ev.amount))}</div>` : ''}
      <div class="mt6">${occ.length ? occ.map(o => occRow(o)).join('') : '<p class="muted small">В этом месяце платежей нет. Добавь регулярные платежи с галочкой «На постоянку» — они появятся во всех следующих месяцах.</p>'}</div>
    </div>
    <div class="row gap"><button class="btn primary grow" data-a="ev-add">+ Платёж или поступление</button><button class="btn grow" data-a="chat-ask" data-q="Добавь в календарь: ">🤖 Через ИИ</button></div>`;
  return { html };
}

// ----- Чат -----
const CHAT_SUGGEST = [
  'Где я трачу больше всего и что можно сократить?',
  'Как мне быстрее закрыть кредиты?',
  'Составь план, как накопить 1 000 000 ₸ за год',
  'Каждое 10 число плачу за интернет 6000 — добавь в календарь',
  'Хватит ли мне денег до зарплаты?',
  'Найди мои подписки и регулярные платежи',
];
function msgHtml(m, i) {
  if (m.role === 'user') return `<div class="msg user"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
  return `<div class="msg ai ${m.error ? 'err' : ''}"><div class="bubble">${md(m.content)}${(m.actions || []).map((a, j) => `<div class="action ${a.undone ? 'undone' : ''}"><span>${a.undone ? '↩️ Отменено: ' : '✅ '}${esc(a.label)}</span>${a.undone ? '' : `<button data-a="chat-undo" data-i="${i}" data-j="${j}">Отменить</button>`}</div>`).join('')}</div></div>`;
}
function vChat() {
  const noKey = !S.settings.apiKey;
  const html = `
    <div class="chat" id="chat">
      ${noKey ? `<div class="card warnbox"><b>Нужен ключ ИИ</b><p class="small">ИИ-помощник работает через Claude API. Получи ключ на console.anthropic.com → API Keys, пополни баланс на несколько долларов и вставь ключ в настройках. Ключ хранится только на этом телефоне.</p><button class="btn primary small" data-a="go" data-to="settings">Открыть настройки</button></div>` : ''}
      ${!S.chat.length ? `<div class="msg ai"><div class="bubble"><p>Привет! Я вижу твои операции, календарь, цели и кредиты. Могу:</p><ul><li>разобрать расходы и подсказать, где сэкономить;</li><li>составить план погашения кредита или накопления;</li><li>сам поставить платежи в календарь — разовые или «на постоянку».</li></ul></div></div>
        <div class="chips wrap">${CHAT_SUGGEST.map(q => `<button class="pill" data-a="chat-ask" data-q="${esc(q)}" data-send="1">${esc(q)}</button>`).join('')}</div>` : ''}
      ${S.chat.map(msgHtml).join('')}
      ${ui.chatBusy ? '<div class="msg ai"><div class="bubble typing"><i></i><i></i><i></i></div></div>' : ''}
    </div>
    <form class="chat-input" id="chatf"><textarea name="q" rows="1" placeholder="Спроси или попроси добавить платёж…" ${ui.chatBusy ? 'disabled' : ''}>${esc(ui.chatDraft || '')}</textarea><button class="send" ${ui.chatBusy ? 'disabled' : ''} aria-label="Отправить">➤</button></form>`;
  return {
    html,
    right: S.chat.length ? `<button class="icon-btn" data-a="chat-clear" aria-label="Очистить">🗑️</button>` : '',
    mount(v) {
      const f = $('#chatf', v), ta = f.elements.q;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
      ta.oninput = () => { ui.chatDraft = ta.value; fit(); };
      fit();
      f.onsubmit = e => { e.preventDefault(); const q = ta.value.trim(); if (q) { ui.chatDraft = ''; sendChat(q); } };
      ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); f.requestSubmit(); } };
      requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
    },
  };
}
async function sendChat(text) {
  if (ui.chatBusy) return;
  if (!S.settings.apiKey) { toast('Сначала добавь API-ключ в настройках'); location.hash = '#settings'; return; }
  const hist = S.chat.filter(m => !m.error);
  S.chat.push({ role: 'user', content: text, ts: Date.now() });
  ui.chatBusy = true; save();
  if (route() === 'chat') refresh();
  try {
    const r = await AI.chat(S, text, hist);
    S.chat.push({ role: 'assistant', content: r.text, actions: r.actions, ts: Date.now() });
  } catch (e) {
    S.chat.push({ role: 'assistant', content: '⚠️ ' + (e.message === 'NO_KEY' ? 'Добавь API-ключ в настройках.' : e.message), error: true, ts: Date.now() });
  }
  ui.chatBusy = false;
  scheduleSync();
  if (S.chat.length > 200) S.chat = S.chat.slice(-200);
  save();
  if (route() === 'chat') refresh(); else toast('Ответ ИИ готов', { label: 'Открыть', fn: () => { location.hash = '#chat'; } });
}

// ----- Ещё -----
function vMore() {
  const items = [
    ['goals', '🎯', 'Цели', 'Накопления и план'], ['debts', '🏦', 'Кредиты', 'Как закрыть быстрее'],
    ['reports', '📈', 'Отчёты', 'День, неделя, месяц'], ['stats', '📊', 'Аналитика', 'Куда уходят деньги'], ['prices', '🏷️', 'Цены по чекам', 'Где дешевле'],
    ['import', '📥', 'Импорт', 'Kaspi, чеки, текст'], ['learn', '📚', 'Финграмотность', 'Короткие уроки'],
    ['settings', '⚙️', 'Настройки', 'Счета, ИИ, PIN'],
  ];
  return {
    html: `<div class="tiles">${items.map(([r, i, t, s]) => `<a class="tile" href="#${r}"><i>${i}</i><b>${t}</b><span>${s}</span></a>`).join('')}
      <button class="tile" data-a="backup-export"><i>💾</i><b>Резервная копия</b><span>${S.settings.lastBackup ? 'последняя ' + U.fmtDate(S.settings.lastBackup) : 'ещё не делали'}</span></button></div>
      <p class="small muted center mt12">${esc(APP)} v${esc(self.APP_VERSION)} · данные хранятся только на этом телефоне</p>`,
  };
}

// ----- Отчёты -----
// Карточка «Итоги прошлой недели/месяца» на главной (первые дни нового периода)
function periodCard() {
  const t = U.today(), d = +t.slice(8), dow = (U.parseYmd(t).getDay() + 6) % 7;
  let kind = null, date = null, key = null;
  if (d <= 5) { date = U.addMonthsYm(U.curYm(), -1) + '-01'; kind = 'month'; key = 'mo:' + date.slice(0, 7); }
  if ((!kind || S.dismissed[key]) && dow <= 2) { date = U.addDays(t, -7); kind = 'week'; key = 'wk:' + F.period('week', date).from; }
  if (!kind || S.dismissed[key]) return '';
  const r = F.report(S, kind, date);
  if (!r.st.count) return '';
  return `<section class="card period-card"><div class="row"><div class="ic">📊</div><div class="grow"><b>Итоги ${kind === 'week' ? 'недели' : 'месяца'}: ${esc(r.p.label)}</b>
    <div class="small muted">Потрачено ${money(r.st.spending)}${r.change != null ? ` · <span class="${r.change > 0 ? 'neg' : 'pos'}">${r.change > 0 ? '▲' : '▼'} ${Math.abs(r.change)}%</span>` : ''}${r.st.income ? ` · доход ${money(r.st.income)}` : ''}</div></div></div>
    <div class="actions"><button class="btn ghost small" data-a="period-hide" data-key="${key}">Скрыть</button><button class="btn primary small grow" data-a="rep-open" data-k="${kind}" data-d="${date}">Открыть отчёт</button></div></section>`;
}

function dayBarsSvg(r) {
  const days = [];
  for (let d = r.p.from; d <= r.p.to; d = U.addDays(d, 1)) days.push(d);
  const W = 320, H = 150, pb = 20, top = 12, n = days.length, step = W / n;
  const bw = Math.max(4, Math.min(26, step - (n > 10 ? 3 : 10)));
  const vals = days.map(d => r.st.byDay[d] || 0);
  const mx = Math.max(1, ...vals);
  const y = v => H - pb - (v / mx) * (H - pb - top);
  const t = U.today();
  const bars = days.map((d, i) => {
    const v = vals[i], x = i * step + (step - bw) / 2;
    const lbl = r.p.kind === 'week' ? U.WD_SHORT[i] : ([1, 5, 10, 15, 20, 25, 30].includes(i + 1) ? String(i + 1) : '');
    return `${v > 0 ? `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - pb - y(v)).toFixed(1)}" rx="3" class="s1 ${d === t ? 'today' : ''}" data-a="rep-open" data-k="day" data-d="${d}"><title>${U.fmtDate(d)}: ${money(v)}</title></rect>` : ''}
      ${lbl ? `<text x="${(i * step + step / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" class="ax ${d === t ? 'now' : ''}">${lbl}</text>` : ''}`;
  }).join('');
  const avg = r.avgDay;
  const ay = y(avg);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Траты по дням">
    <line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="base"/>${bars}
    ${avg > 0 ? `<line x1="0" x2="${W}" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" class="avgline"/><text x="${W - 2}" y="${(ay - 4).toFixed(1)}" text-anchor="end" class="ax">среднее ${kfmt(avg)}</text>` : ''}
  </svg>`;
}

function vReports() {
  const r = F.report(S, ui.repKind, ui.repDate);
  const { p, st, prev } = r;
  const kinds = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']];
  const canNext = p.next <= U.today();
  const prevName = { day: 'Вчера', week: 'Прошлая неделя', month: 'Прошлый месяц' }[p.kind];
  const toName = { day: 'ко вчерашнему дню', week: 'к прошлой неделе', month: 'к прошлому месяцу' }[p.kind];
  const showChange = r.change != null && !(r.current && p.kind !== 'day');
  const cats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]);
  const maxC = cats[0]?.[1] || 1;
  const accs = Object.entries(st.byAcc).sort((a, b) => b[1] - a[1]);
  const lim = r.limit;
  const html = `
    <div class="seg rep-seg">${kinds.map(([k, l]) => `<button class="${ui.repKind === k ? 'on' : ''}" data-a="rep-kind" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="mswitch"><button data-a="rep-nav" data-d="-1" aria-label="Назад">‹</button><b>${esc(p.label)}</b><button data-a="rep-nav" data-d="1" ${canNext ? '' : 'disabled'} aria-label="Вперёд">›</button></div>

    <div class="card">
      <div class="muted small">Потрачено</div>
      <div class="big2">${money(st.spending)}</div>
      <div class="small mt6">${showChange ? `<span class="${r.change > 0 ? 'neg' : 'pos'}">${r.change > 0 ? '▲' : '▼'} ${Math.abs(r.change)}%</span> ${toName} (${money(prev.spending)})` : prev.spending ? `<span class="muted">${prevName}: ${money(prev.spending)}</span>` : ''}</div>
      <div class="trio mt12"><div><span class="muted small">Доход</span><b class="pos">${money(st.income)}</b></div><div><span class="muted small">Отложено</span><b>${money(st.savings)}</b></div>
        <div><span class="muted small">${p.kind === 'day' ? 'Операций' : 'В среднем/день'}</span><b>${p.kind === 'day' ? st.txs.length : money(r.avgDay)}</b></div></div>
      ${lim ? `<div class="limit mt12"><div class="row small"><span>Лимит на сегодня <b>${money(lim.limit)}</b></span><span class="${lim.left < 0 ? 'neg' : 'pos'}">${lim.left < 0 ? 'перерасход ' + money(-lim.left) : 'осталось ' + money(lim.left)}</span></div>${bar(lim.limit > 0 ? lim.spent / lim.limit : 1, lim.left < 0 ? 'over' : 'accent')}</div>` : ''}
    </div>

    ${p.kind !== 'day' && st.spending > 0 ? `<div class="card"><div class="card-h"><h2>Траты по дням</h2><span class="small muted">нажми на столбик</span></div>${dayBarsSvg(r)}</div>` : ''}

    <div class="card"><div class="card-h"><h2>Выводы</h2></div><ul class="insights">${r.insights.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>

    ${cats.length ? `<div class="card"><div class="card-h"><h2>По категориям</h2></div>${cats.map(([c, v]) => {
      const pv = prev.byCat[c] || 0;
      return `<div class="cb2" data-a="rep-cat" data-id="${c}"><div class="row"><span>${F.cat(S, c)?.icon || '•'} ${esc(F.catName(S, c))}</span><span><b>${money(v)}</b> <span class="muted small">${Math.round(v / (st.spending || 1) * 100)}%</span></span></div>${bar(v / maxC, 'series')}${!r.current || p.kind === 'day' ? `<div class="small muted">${prevName.toLowerCase()}: ${pv ? money(pv) : 'не было'}</div>` : ''}</div>`;
    }).join('')}</div>` : ''}

    ${p.kind === 'day' ? `<div class="card list">${st.txs.length ? [...st.txs].sort((a, b) => (b.created || 0) - (a.created || 0)).map(txRow).join('') : '<div class="empty">В этот день операций нет</div>'}</div>`
      : st.top.length ? `<div class="card list"><div class="card-h list-h"><h2>Крупные траты</h2></div>${st.top.map(txRow).join('')}</div>` : ''}

    ${accs.length > 1 ? `<div class="card"><div class="card-h"><h2>Откуда тратил</h2></div>${accs.map(([a, v]) => `<div class="cb2"><div class="row"><span>${F.acc(S, a)?.icon || ''} ${esc(F.acc(S, a)?.name || a)}</span><b>${money(v)}</b></div>${bar(v / (st.spending || 1), 'series')}</div>`).join('')}</div>` : ''}

    ${r.pays.count ? `<div class="card"><div class="card-h"><h2>Платежи по календарю</h2></div><div class="small">Оплачено ${money(r.pays.paid)} из ${money(r.pays.total)}</div>${bar(r.pays.total ? r.pays.paid / r.pays.total : 0, 'accent')}
      ${r.pays.open.length ? `<div class="mt6">${r.pays.open.map(o => occRow(o)).join('')}</div>` : '<p class="small pos">Все платежи периода оплачены ✓</p>'}</div>` : ''}

    <div class="row gap"><button class="btn grow" data-a="rep-share">📤 Поделиться</button><button class="btn primary grow" data-a="rep-ai">🤖 Разбор от ИИ</button></div>`;
  return { html };
}

// ----- Цели -----
function vGoals() {
  const avg = F.avgMonthly(S);
  const html = `
    ${S.goals.length ? S.goals.map(g => {
      const p = F.goalPlan(g);
      return `<div class="card goal" data-a="goal-open" data-id="${g.id}">
        <div class="row"><div class="gi">${g.icon || '🎯'}</div><div class="grow"><b>${esc(g.name)}</b><div class="small muted">${money(g.saved)} из ${money(g.target)} · ${Math.round(p.progress * 100)}%</div></div></div>
        ${bar(p.progress, 'accent')}
        <div class="small muted mt6">${p.done ? '🎉 Цель достигнута!' : p.late ? '⏰ Срок прошёл — обнови дату' : p.perMonth ? `Нужно ${money(p.perMonth)} в месяц (${money(p.perWeek || p.perMonth / 4.35)} в неделю)${g.deadline ? ` до ${U.fmtDate(g.deadline)}` : ''}${p.etaYm ? ` · накопишь к ${U.fmtMonthGen(p.etaYm).replace(/^(\S+)/, "началу $1")}` : ''}` : 'Укажи срок или сумму в месяц — посчитаю план'}</div>
      </div>`;
    }).join('') : `<div class="empty">Целей пока нет.<br>Начни с подушки безопасности — это главная цель.</div>`}
    <div class="row gap"><button class="btn primary grow" data-a="goal-add">+ Новая цель</button>${!S.goals.some(g => /подушк/i.test(g.name)) ? '<button class="btn grow" data-a="goal-fund">🛟 Подушка</button>' : ''}</div>
    ${avg ? `<p class="small muted mt12">Средние расходы: ${money(avg.spending)}/мес. Подушка на 3–6 месяцев: ${money(avg.spending * 3)}–${money(avg.spending * 6)}.</p>` : ''}`;
  return { html };
}

// ----- Кредиты -----
function debtCompareHtml() {
  const ds = S.debts.filter(d => d.balance > 0);
  if (!ds.length) return '';
  const extra = ui.debtExtra;
  const none = F.simulateDebts(ds, 0, 'none'), av = F.simulateDebts(ds, extra, 'avalanche'), sn = F.simulateDebts(ds, extra, 'snowball');
  const row = (name, r, best) => `<tr class="${best ? 'best' : ''}"><td>${name}</td><td>${r.stuck ? '∞' : `${r.months} мес.`}<div class="small muted">${r.stuck ? 'долг растёт' : U.fmtMonth(U.addMonthsYm(U.curYm(), r.months))}</div></td><td>${r.stuck ? '—' : money(r.interest)}</td></tr>`;
  const bestAv = av.interest <= sn.interest;
  return `<table class="tbl"><thead><tr><th>Способ</th><th>Срок</th><th>Переплата</th></tr></thead><tbody>
    ${row('Только минимальные', none, false)}${row('❄️ Лавина', av, bestAv)}${row('⛄ Снежный ком', sn, !bestAv)}</tbody></table>
    ${!none.stuck ? `<p class="small">Если добавлять <b>${money(extra)}</b> в месяц, кредиты закроются на <b>${none.months - av.months} мес.</b> раньше, а переплата уменьшится на <b>${money(none.interest - av.interest)}</b>.</p>` : '<p class="small neg">Минимальные платежи не покрывают проценты — долг растёт. Увеличь платёж.</p>'}
    <p class="small muted">Порядок погашения по лавине: ${av.order.map((o, i) => `${i + 1}. ${esc(o.name)} (${o.month ?? '∞'} мес.)`).join(' → ')}</p>`;
}
function vDebts() {
  const ds = S.debts;
  const minSum = U.sum(ds.filter(d => d.balance > 0), d => d.minPayment);
  if (ui.debtExtra == null) ui.debtExtra = Math.max(5000, Math.round(minSum * 0.1 / 1000) * 1000);
  const max = Math.max(100000, Math.ceil(minSum * 2 / 10000) * 10000);
  const html = `
    ${ds.length ? `<div class="card list">${ds.map(d => {
      const months = F.debtMonths(d), hasEv = S.events.some(e => e.debtId === d.id);
      return `<div class="tx" data-a="debt-edit" data-id="${d.id}"><div class="ic">🏦</div><div class="grow min0"><div class="t1">${esc(d.name)}</div><div class="sub">${d.rate}% · платёж ${money(d.minPayment)} · ${months >= 600 ? 'не гасится' : `закроется через ${months} мес.`}${hasEv ? ' · 📅' : ''}</div></div><div class="amt">${money(d.balance)}</div></div>`;
    }).join('')}</div>
    <div class="card"><div class="card-h"><h2>План погашения</h2></div>
      <label class="field"><span class="lbl">Готов платить сверх минимума: <b id="extraV">${money(ui.debtExtra)}</b> в месяц</span><input type="range" id="extra" min="0" max="${max}" step="1000" value="${ui.debtExtra}"></label>
      <div id="dcmp">${debtCompareHtml()}</div>
    </div>
    <div class="row gap"><button class="btn primary grow" data-a="debt-add">+ Кредит</button><button class="btn grow" data-a="debts-to-cal">📅 Платежи в календарь</button></div>
    <details class="card explain"><summary>Лавина или снежный ком?</summary><p class="small"><b>Лавина</b> — лишние деньги идут в кредит с самой высокой ставкой. Меньше всего переплата.</p><p class="small"><b>Снежный ком</b> — сначала гасишь самый маленький долг. Переплата чуть больше, зато первый кредит закрывается быстро, и это мотивирует.</p><p class="small">В обоих случаях по остальным кредитам платишь минимум, а когда кредит закрыт, его платёж переходит на следующий.</p></details>`
    : `<div class="empty">Кредитов нет — отлично! 🎉<br>Если есть кредит, рассрочка или Kaspi Red — добавь, и я посчитаю, как закрыть быстрее.</div><button class="btn primary block" data-a="debt-add">+ Добавить кредит</button>`}`;
  return {
    html, mount(v) {
      const r = $('#extra', v);
      if (r) r.oninput = () => { ui.debtExtra = +r.value; $('#extraV').textContent = money(ui.debtExtra); $('#dcmp').innerHTML = debtCompareHtml(); };
    },
  };
}

// ----- Аналитика -----
function vStats() {
  const ym = ui.statsMonth, st = F.monthStats(S, ym);
  const cats = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]);
  const tot = st.spending || 1, maxC = cats[0]?.[1] || 1;
  const base = st.income || F.avgMonthly(S)?.income || 0;
  const g = st.groups;
  const gTot = g.need + g.want + g.save || 1;
  // 6 месяцев
  const months = []; for (let i = 5; i >= 0; i--) months.push(F.monthStats(S, U.addMonthsYm(ym, -i)));
  const mx = Math.max(1, ...months.map(m => Math.max(m.income, m.spending)));
  const W = 320, H = 150, pb = 22, bw = 16, step = W / 6;
  const bars = months.map((m, i) => {
    const x = i * step + step / 2;
    const hi = (m.income / mx) * (H - pb - 8), hs = (m.spending / mx) * (H - pb - 8);
    return `<g><rect x="${x - bw - 1}" y="${H - pb - hi}" width="${bw}" height="${Math.max(0, hi)}" rx="3" class="s1"><title>${U.fmtMonth(m.ym)}: доход ${money(m.income)}</title></rect>
      <rect x="${x + 1}" y="${H - pb - hs}" width="${bw}" height="${Math.max(0, hs)}" rx="3" class="s2"><title>${U.fmtMonth(m.ym)}: расход ${money(m.spending)}</title></rect>
      <text x="${x}" y="${H - 6}" text-anchor="middle" class="ax">${U.fmtMonthShort(m.ym)}</text></g>`;
  }).join('');
  const recurring = F.detectRecurring(S);
  const html = `
    ${monthSwitch('statsMonth')}
    <div class="card"><div class="trio"><div><span class="muted small">Доход</span><b class="pos">${money(st.income)}</b></div><div><span class="muted small">Расход</span><b>${money(st.spending)}</b></div><div><span class="muted small">Отложено</span><b>${money(st.savings)}</b></div></div>
    ${st.income ? `<div class="small muted mt6">Остаток месяца: <b class="${st.income - st.spending - st.savings < 0 ? 'neg' : 'pos'}">${money(st.income - st.spending - st.savings)}</b> · норма сбережений ${Math.round(st.savings / st.income * 100)}%</div>` : ''}</div>

    <div class="card"><div class="card-h"><h2>Куда ушли деньги</h2></div>
      ${cats.length ? cats.map(([c, v]) => `<div class="cb2" data-a="cat-tx" data-id="${c}"><div class="row"><span>${F.cat(S, c)?.icon || '•'} ${esc(F.catName(S, c))}</span><span><b>${money(v)}</b> <span class="muted small">${Math.round(v / tot * 100)}%</span></span></div>${bar(v / maxC, 'series')}</div>`).join('') : '<p class="muted small">Нет расходов за этот месяц.</p>'}
    </div>

    <div class="card"><div class="card-h"><h2>Правило 50/30/20</h2></div>
      <div class="stack">${[['need', 's1'], ['want', 's2'], ['save', 's3']].map(([k, c]) => g[k] ? `<i class="${c}" style="flex:${g[k]}"></i>` : '').join('')}</div>
      <div class="legend3">
        <div><i class="sw s1"></i>Обязательное <b>${base ? Math.round(g.need / base * 100) + '%' : Math.round(g.need / gTot * 100) + '%'}</b> <span class="muted">цель ≤50%</span><span class="r">${money(g.need)}</span></div>
        <div><i class="sw s2"></i>Желания <b>${base ? Math.round(g.want / base * 100) + '%' : Math.round(g.want / gTot * 100) + '%'}</b> <span class="muted">цель ≤30%</span><span class="r">${money(g.want)}</span></div>
        <div><i class="sw s3"></i>Накопления <b>${base ? Math.round(g.save / base * 100) + '%' : Math.round(g.save / gTot * 100) + '%'}</b> <span class="muted">цель ≥20%</span><span class="r">${money(g.save)}</span></div>
      </div>
      <p class="small muted">${base ? 'Проценты — от дохода месяца.' : 'Дохода за месяц нет — проценты от всех трат.'} Группу категории можно поменять в настройках.</p>
    </div>

    <div class="card"><div class="card-h"><h2>Полгода</h2><div class="legend small"><span><i class="sw s1"></i>доход</span><span><i class="sw s2"></i>расход</span></div></div>
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Доходы и расходы за 6 месяцев"><line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="base"/>${bars}</svg>
      <table class="tbl small"><thead><tr><th>Месяц</th><th>Доход</th><th>Расход</th><th>Итог</th></tr></thead><tbody>${months.map(m => `<tr><td>${U.fmtMonthShort(m.ym)}</td><td>${U.num(m.income)}</td><td>${U.num(m.spending)}</td><td class="${m.income - m.spending < 0 ? 'neg' : ''}">${U.num(m.income - m.spending)}</td></tr>`).join('')}</tbody></table>
    </div>

    ${recurring.length ? `<div class="card"><div class="card-h"><h2>Регулярные траты</h2></div>${recurring.map(r => `<div class="row li"><span>${F.cat(S, r.categoryId)?.icon || '🔁'} ${esc(r.title)}</span><span>${money(r.amount)}/мес <button class="btn-mini" data-a="sugg-add" data-key="${esc(r.key)}">В календарь</button></span></div>`).join('')}<p class="small muted">Это ${money(U.sum(recurring, r => r.amount) * 12)} в год.</p></div>` : ''}

    <div class="card"><div class="card-h"><h2>Советы</h2></div>${F.tips(S).map(tipHtml).join('')}</div>`;
  return { html };
}

// ----- Цены -----
function vPrices() {
  const idx = F.priceIndex(S);
  const q = ui.priceQ.toLowerCase();
  const list = q ? idx.filter(x => x.name.toLowerCase().includes(q)) : idx;
  const html = `
    <div class="search"><input id="pq" type="search" placeholder="🔍 Найти товар: молоко, хлеб…" value="${esc(ui.priceQ)}"></div>
    <div id="plist">${pricesListHtml(list, idx.length)}</div>`;
  return {
    html, mount(v) {
      $('#pq', v).oninput = e => { ui.priceQ = e.target.value; const qq = ui.priceQ.toLowerCase(); $('#plist').innerHTML = pricesListHtml(qq ? idx.filter(x => x.name.toLowerCase().includes(qq)) : idx, idx.length); };
    },
  };
}
function pricesListHtml(list, total) {
  if (!total) return '<div class="empty">Сфотографируй несколько чеков — здесь появятся цены на товары, их изменение и магазины, где дешевле.</div>';
  if (!list.length) return '<div class="empty">Не найдено</div>';
  return `<div class="card list">${list.slice(0, 150).map(x => {
    const ch = x.first.price ? (x.last.price / x.first.price - 1) * 100 : 0;
    return `<div class="tx" data-a="price-open" data-k="${esc(x.name.toLowerCase())}"><div class="grow min0"><div class="t1">${esc(x.name)}</div><div class="sub">${x.count}× · мин ${money(x.min)} · ${esc(x.last.store)}</div></div><div class="amt">${money(x.last.price)}${x.count > 1 && Math.abs(ch) >= 1 ? `<div class="small ${ch > 0 ? 'neg' : 'pos'}">${ch > 0 ? '▲' : '▼'}${Math.abs(Math.round(ch))}%</div>` : ''}</div></div>`;
  }).join('')}</div>`;
}

// ----- Уроки -----
function vLearn() {
  return { html: LESSONS.map(l => `<details class="card lesson"><summary><span>${l.icon}</span> ${esc(l.title)}</summary><div class="lbody">${md(l.body)}</div></details>`).join('') + `<button class="btn block mt12" data-a="chat-ask" data-q="Объясни простыми словами: ">🤖 Спросить ИИ про финансы</button>` };
}

// ----- Импорт -----
function vImport() {
  const html = `
    <div class="card"><h2>📄 Выписка Kaspi (PDF)</h2>
      <p class="small muted">В приложении Kaspi: <b>Мой Банк → Kaspi Gold → Выписка</b>, выбери период и нажми «Отправить». Сохрани файл или сразу выбери «${esc(APP)}» в списке «Поделиться» (Android).</p>
      <button class="btn primary block" data-a="import-pdf">Выбрать PDF</button>
      <p class="small muted mt6">Повторный импорт той же выписки не создаст дублей.</p></div>
    <div class="card"><h2>🧾 Чек из магазина</h2>
      <p class="small muted">Сфотографируй чек целиком — ИИ прочитает товары и цены и разложит по категориям. Если покупка уже есть из Kaspi, чек прикрепится к ней.</p>
      <button class="btn primary block" data-a="receipt">Сфотографировать или выбрать фото</button></div>
    <div class="card"><h2>📋 Текст уведомлений или SMS</h2>
      <p class="small muted">Скопируй текст пушей Kaspi (можно несколько сразу) и вставь — операции распознаются.</p>
      <button class="btn block" data-a="paste">Вставить текст</button></div>
    <div class="card"><h2>💾 Резервная копия</h2>
      <p class="small muted">Перенос на новый телефон или восстановление.</p>
      <div class="row gap"><button class="btn grow" data-a="backup-export">Сохранить</button><button class="btn grow" data-a="backup-import">Восстановить</button></div></div>`;
  return { html };
}

// ----- Настройки -----
function vSettings() {
  const st = S.settings;
  const html = `
    <form class="card form" id="setf">
      <h2>Профиль</h2>
      <label class="field"><span class="lbl">Имя</span><input name="name" value="${esc(st.name)}" placeholder="Как к тебе обращаться"></label>
      <div class="row2">
        <label class="field"><span class="lbl">День зарплаты</span><input name="payday" inputmode="numeric" value="${st.payday || ''}" placeholder="например 5"></label>
        <label class="field"><span class="lbl">Доход в месяц</span><input name="monthlyIncome" inputmode="decimal" value="${st.monthlyIncome || ''}" placeholder="для «часов работы»"></label>
      </div>
      <label class="field"><span class="lbl">Счёт для быстрого ввода</span>${accChips('defaultAccount', st.defaultAccount)}</label>
      <h2 class="mt12">ИИ (Claude)</h2>
      <label class="field"><span class="lbl">API-ключ</span><input name="apiKey" type="password" autocomplete="off" value="${esc(st.apiKey)}" placeholder="sk-ant-…"></label>
      <label class="field"><span class="lbl">Модель</span><select name="model">${AI.MODELS.map(m => `<option value="${m.id}" ${m.id === st.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}${!AI.MODELS.some(m => m.id === st.model) ? `<option value="${esc(st.model)}" selected>${esc(st.model)}</option>` : ''}</select></label>
      <p class="small muted">Ключ: console.anthropic.com → API Keys. Поставь там месячный лимит расходов, чтобы не было сюрпризов. Ключ хранится только на этом телефоне и не попадает в резервную копию.</p>
      <div class="row gap"><button class="btn primary grow">Сохранить</button><button type="button" class="btn grow" data-a="ai-test">Проверить ИИ</button></div>
    </form>

    <div class="card"><div class="card-h"><h2>Счета</h2><button class="btn small" data-a="acc-add">+ Счёт</button></div>
      ${S.accounts.map(a => `<div class="row li" data-a="acc-edit" data-id="${a.id}"><span>${a.icon} ${esc(a.name)}${a.hidden ? ' <span class="muted small">(скрыт)</span>' : ''}</span><b>${money(F.accountBalance(S, a))}</b></div>`).join('')}
      <p class="small muted">Нажми на счёт, чтобы указать точный остаток, если он разошёлся с банком.</p></div>

    <div class="card"><div class="card-h"><h2>Категории</h2><button class="btn small" data-a="cat-add">+ Категория</button></div>
      <div class="chips wrap">${S.categories.map(c => `<button class="pill ${c.hidden ? 'dim' : ''}" data-a="cat-edit" data-id="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}</div></div>

    ${N.isNative ? autoCardHtml() : `<div class="card"><h2>⚡ Автоматический учёт</h2><p class="small muted">Запись трат из уведомлений банков, напоминания о платежах и виджет работают в Android-версии (APK). Голосовой ввод работает и здесь, если браузер его поддерживает.</p></div>`}

    <div class="card"><h2>Безопасность и вид</h2>
      <div class="row li"><span>🔒 PIN-код при входе</span>${st.pinHash ? '<button class="btn small" data-a="pin-remove">Убрать</button>' : '<button class="btn small" data-a="pin-set">Включить</button>'}</div>
      <div class="row li"><span>🎨 Тема</span><span class="chips">${[['auto', 'Авто'], ['dark', 'Тёмная'], ['light', 'Светлая']].map(([v, l]) => `<button class="pill ${st.theme === v ? 'on' : ''}" data-a="theme" data-v="${v}">${l}</button>`).join('')}</span></div></div>

    <div class="card"><h2>Данные</h2>
      <div class="row gap"><button class="btn grow" data-a="backup-export">💾 Сохранить копию</button><button class="btn grow" data-a="backup-import">📂 Восстановить</button></div>
      <p class="small muted">Операций: ${S.transactions.length} · платежей в календаре: ${S.events.length}${st.lastBackup ? ` · копия от ${U.fmtDate(st.lastBackup)}` : ''}</p>
      <button class="btn ghost danger block" data-a="wipe">Удалить все данные</button></div>

    <div class="card"><h2>О приложении</h2>
      <div class="row li"><span>Версия</span><b>${esc(self.APP_VERSION)}</b></div>
      <button class="btn block" data-a="check-update">Проверить обновления</button></div>`;
  return {
    html, mount(v) {
      $('#autocard', v)?.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.app) N.setApp(el.dataset.app, el.checked);
        else if (el.dataset.opt) S.settings[el.dataset.opt] = el.checked;
        else if (el.dataset.optTime != null && /^\d{2}:\d{2}$/.test(el.value)) S.settings.eveningTime = el.value;
        else return;
        save(); scheduleSync(); toast('Сохранено');
      });
      $('#setf', v).onsubmit = e => {
        e.preventDefault();
        const f = e.target;
        const pd = parseInt(fv(f, 'payday'));
        Object.assign(S.settings, {
          name: fv(f, 'name').trim(), payday: pd >= 1 && pd <= 31 ? pd : null,
          monthlyIncome: U.parseAmount(fv(f, 'monthlyIncome')) || null,
          defaultAccount: fv(f, 'defaultAccount') || S.settings.defaultAccount,
          apiKey: fv(f, 'apiKey').trim(), model: fv(f, 'model'),
        });
        commit('Сохранено');
      };
    },
  };
}

// ============ Формы ============
function openTxForm(tx = null, preset = {}) {
  const isNew = !tx;
  const t = tx ? { ...tx } : { type: 'expense', amount: '', categoryId: null, accountId: S.settings.defaultAccount, toAccountId: null, date: U.today(), note: '', ...preset };
  const otherAcc = S.accounts.find(a => a.id !== t.accountId)?.id;
  let pickedCat = !!t.categoryId;
  const html = `<form class="form" id="txf" autocomplete="off">
    <div class="seg">${[['expense', 'Расход'], ['income', 'Доход'], ['transfer', 'Перевод']].map(([v, l]) => `<label><input type="radio" name="type" value="${v}" ${t.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="amount-in"><input name="amount" inputmode="decimal" placeholder="0" value="${t.amount ? String(t.amount) : ''}"><span>₸</span></div>
    <div class="small muted center" id="hours"></div>
    <label class="field"><span class="lbl">Где / что</span><input name="note" value="${esc(t.note || t.merchant || '')}" placeholder="Magnum, такси домой, зарплата…"></label>
    <div id="catwrap"></div>
    <div class="field"><span class="lbl" id="acclbl">Счёт</span>${accChips('acc', t.accountId)}</div>
    <div class="field" id="towrap"><span class="lbl">Куда</span>${accChips('to', t.toAccountId || otherAcc)}</div>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${t.date}"></label>
    ${t.items?.length ? `<div class="field"><span class="lbl">Позиции чека</span><div class="items">${t.items.map((it, i) => `<div class="item"><div class="grow min0"><div>${esc(it.name)}</div><div class="small muted">${it.qty && it.qty !== 1 ? it.qty + ' × ' + money(it.price) : ''}</div></div><b>${money(it.sum)}</b>${catSelect('expense', it.categoryId, `data-item="${i}" class="mini"`)}</div>`).join('')}</div></div>` : ''}
    ${t.receiptLink ? `<a class="small" href="${esc(t.receiptLink)}" target="_blank" rel="noopener">🔗 Чек в ОФД</a>` : ''}
    ${t.source === 'kaspi' && t.merchant ? `<div class="small muted">Из выписки Kaspi: ${esc(t.op || '')} · ${esc(t.merchant)}</div>` : ''}
    <div class="actions">${!isNew ? '<button type="button" class="btn ghost danger" data-del>Удалить</button>' : ''}<button class="btn primary grow">Сохранить</button></div>
  </form>`;
  sheet(html, {
    title: isNew ? 'Новая операция' : 'Операция',
    onMount(root, close) {
      const f = $('#txf', root);
      const type = () => fv(f, 'type');
      const drawCats = () => {
        const ty = type();
        const sel = fv(f, 'cat') || t.categoryId;
        const valid = F.cat(S, sel)?.type === ty ? sel : (ty === 'income' ? F.guessCategory(S, fv(f, 'note'), 'income') : F.guessCategory(S, fv(f, 'note'), 'expense'));
        $('#catwrap', root).innerHTML = ty === 'transfer' ? '' : `<div class="field"><span class="lbl">Категория</span>${catChips(ty, valid)}</div>`;
        $('#towrap', root).hidden = ty !== 'transfer';
        $('#acclbl', root).textContent = ty === 'transfer' ? 'Откуда' : 'Счёт';
        $$('input[name=cat]', root).forEach(i => i.onchange = () => { pickedCat = true; });
      };
      const hours = () => {
        const a = U.parseAmount(fv(f, 'amount'));
        const h = type() === 'expense' && a > 0 ? F.hoursOfWork(S, a) : null;
        $('#hours', root).textContent = h ? `≈ ${h < 1 ? Math.round(h * 60) + ' мин' : h.toFixed(h < 10 ? 1 : 0).replace('.', ',') + ' ч'} твоей работы` : '';
      };
      drawCats(); hours();
      $$('input[name=type]', root).forEach(i => i.onchange = () => { pickedCat = false; drawCats(); hours(); });
      f.elements.amount.oninput = hours;
      f.elements.note.oninput = () => {
        if (pickedCat || type() === 'transfer') return;
        const g = F.guessCategory(S, fv(f, 'note'), type());
        const r = $(`input[name=cat][value="${g}"]`, root);
        if (r) r.checked = true;
      };
      if (isNew) setTimeout(() => f.elements.amount.focus(), 250);
      $('[data-del]', root)?.addEventListener('click', async () => {
        if (!(await ask('Удалить операцию?', esc(txTitle(tx)) + ' · ' + money(tx.amount), 'Удалить', true))) return;
        deleteTx(tx.id); close(); commit('Удалено');
      });
      f.onsubmit = e => {
        e.preventDefault();
        const amount = U.parseAmount(fv(f, 'amount'));
        if (!(amount > 0)) { toast('Введи сумму'); return; }
        const ty = type();
        const accountId = fv(f, 'acc');
        const to = fv(f, 'to');
        if (ty === 'transfer' && (!to || to === accountId)) { toast('Выбери другой счёт «Куда»'); return; }
        const note = fv(f, 'note').trim();
        const categoryId = ty === 'transfer' ? null : (fv(f, 'cat') || F.guessCategory(S, note, ty));
        const obj = { ...(tx || { id: U.uid(), created: Date.now(), source: 'manual' }), type: ty, amount, accountId, toAccountId: ty === 'transfer' ? to : null, categoryId, date: fv(f, 'date') || U.today(), note };
        if (obj.items) $$('[data-item]', root).forEach(s => { obj.items[+s.dataset.item].categoryId = s.value; });
        if (isNew) S.transactions.push(obj);
        else S.transactions[S.transactions.findIndex(x => x.id === tx.id)] = obj;
        close();
        // Запоминаем категорию для этого магазина
        const key = F.normalizeMerchant(obj.merchant || obj.note);
        let action;
        if (!isNew && tx.categoryId !== categoryId && key && categoryId) {
          S.rules[key] = categoryId;
          const similar = S.transactions.filter(x => x.id !== obj.id && x.type === ty && x.categoryId !== categoryId && F.normalizeMerchant(x.merchant || x.note) === key);
          if (similar.length) action = { label: `Ещё ${similar.length}`, fn: () => { similar.forEach(x => { x.categoryId = categoryId; }); commit(`Обновлено: ${similar.length}`); } };
          ui.txMonth = obj.date.slice(0, 7);
          commit(`Запомнил: «${key}» → ${F.catName(S, categoryId)}`, action);
          return;
        }
        ui.txMonth = obj.date.slice(0, 7);
        commit(isNew ? 'Записано' : 'Сохранено');
      };
    },
  });
}

function deleteTx(id) {
  const tx = S.transactions.find(t => t.id === id);
  S.transactions = S.transactions.filter(t => t.id !== id);
  for (const ev of S.events) for (const [ym, tid] of Object.entries(ev.paid || {})) if (tid === id) delete ev.paid[ym];
  return tx;
}

function openAddMenu() {
  sheet(`<div class="menu">
    <button data-m="expense"><i>➖</i>Расход</button><button data-m="income"><i>➕</i>Доход</button>
    <button data-m="transfer"><i>🔄</i>Перевод между счетами</button><button data-m="receipt"><i>🧾</i>Чек по фото</button>
    <button data-m="pdf"><i>📄</i>Выписка Kaspi</button><button data-m="paste"><i>📋</i>Вставить текст</button>
    <button data-m="event"><i>📅</i>Платёж в календарь</button></div>`, {
    title: 'Добавить', onMount(r, close) {
      $$('[data-m]', r).forEach(b => b.onclick = () => {
        const m = b.dataset.m; close();
        setTimeout(() => {
          if (['expense', 'income', 'transfer'].includes(m)) openTxForm(null, { type: m });
          else if (m === 'receipt') A.receipt();
          else if (m === 'pdf') A['import-pdf']();
          else if (m === 'paste') openPasteSheet();
          else if (m === 'event') openEventForm();
        }, 50);
      });
    },
  });
}

// ----- Календарь: формы -----
function openEventForm(ev = null, preset = {}) {
  const isNew = !ev;
  const e = ev ? { ...ev } : { title: '', amount: '', type: 'expense', categoryId: null, accountId: 'kaspi', date: U.today(), recurring: false, months: '', note: '', ...preset };
  const html = `<form class="form" id="evf" autocomplete="off">
    <div class="seg">${[['expense', 'Платёж'], ['income', 'Поступление']].map(([v, l]) => `<label><input type="radio" name="type" value="${v}" ${e.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <label class="field"><span class="lbl">Название</span><input name="title" value="${esc(e.title)}" placeholder="Коммуналка, интернет, зарплата…" required></label>
    <div class="row2"><label class="field"><span class="lbl">Сумма, ₸</span><input name="amount" inputmode="decimal" value="${e.amount || ''}" placeholder="0"></label>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${e.date}"></label></div>
    <label class="toggle"><input type="checkbox" name="recurring" ${e.recurring ? 'checked' : ''}><span class="tg"></span><span><b>🔁 На постоянку</b><br><span class="small muted">повторять каждый месяц в этот день</span></span></label>
    <label class="field" id="monthsw"><span class="lbl">Сколько раз (пусто — бессрочно)</span><input name="months" inputmode="numeric" value="${e.months || ''}" placeholder="например 12 — для кредита или рассрочки"></label>
    <div id="ecat"></div>
    <div class="field"><span class="lbl">Счёт</span>${accChips('acc', e.accountId)}</div>
    <label class="field"><span class="lbl">Заметка</span><input name="note" value="${esc(e.note || '')}" placeholder="лицевой счёт, номер договора…"></label>
    <div class="actions">${!isNew ? '<button type="button" class="btn ghost danger" data-del>Удалить</button>' : ''}<button class="btn primary grow">Сохранить</button></div>
  </form>`;
  sheet(html, {
    title: isNew ? 'Новый платёж' : 'Изменить платёж',
    onMount(root, close) {
      const f = $('#evf', root);
      let picked = !!e.categoryId;
      const drawCat = () => {
        const ty = fv(f, 'type');
        const cur = fv(f, 'cat') || e.categoryId;
        const sel = F.cat(S, cur)?.type === ty ? cur : F.guessCategory(S, fv(f, 'title'), ty);
        $('#ecat', root).innerHTML = `<div class="field"><span class="lbl">Категория</span>${catChips(ty, sel)}</div>`;
        $$('input[name=cat]', root).forEach(i => i.onchange = () => { picked = true; });
      };
      const showMonths = () => { $('#monthsw', root).hidden = !fc(f, 'recurring'); };
      drawCat(); showMonths();
      $$('input[name=type]', root).forEach(i => i.onchange = () => { picked = false; drawCat(); });
      f.elements.recurring.onchange = showMonths;
      f.elements.title.oninput = () => {
        if (picked) return;
        const g = F.guessCategory(S, fv(f, 'title'), fv(f, 'type'));
        const r = $(`input[name=cat][value="${g}"]`, root); if (r) r.checked = true;
        if (/коммун|интернет|связь|аренд|кредит|рассроч|подписк|зарплат|аванс|садик|квартплат/i.test(fv(f, 'title')) && isNew && !f.elements.recurring.dataset.touched) { f.elements.recurring.checked = true; showMonths(); }
      };
      f.elements.recurring.addEventListener('change', () => { f.elements.recurring.dataset.touched = '1'; });
      $('[data-del]', root)?.addEventListener('click', async () => {
        if (!(await ask('Удалить платёж?', `«${esc(ev.title)}» исчезнет из всех месяцев. Уже записанные оплаты останутся в операциях.`, 'Удалить', true))) return;
        S.events = S.events.filter(x => x.id !== ev.id); close(); commit('Платёж удалён');
      });
      f.onsubmit = x => {
        x.preventDefault();
        const amount = U.parseAmount(fv(f, 'amount'));
        const title = fv(f, 'title').trim();
        if (!title) { toast('Введи название'); return; }
        if (!(amount > 0)) { toast('Введи сумму'); return; }
        const recurring = fc(f, 'recurring');
        const months = parseInt(fv(f, 'months'));
        const obj = {
          ...(ev || { id: U.uid(), paid: {}, skipped: {}, created: Date.now() }),
          title, amount, type: fv(f, 'type'), date: fv(f, 'date') || U.today(), recurring,
          months: recurring && months > 0 ? months : null, categoryId: fv(f, 'cat'), accountId: fv(f, 'acc') || 'kaspi', note: fv(f, 'note').trim(),
        };
        if (isNew) S.events.push(obj); else S.events[S.events.findIndex(y => y.id === ev.id)] = obj;
        close();
        ui.calMonth = obj.date.slice(0, 7); ui.calDay = obj.date;
        commit(recurring ? `Добавлено на постоянку: каждое ${+obj.date.slice(8)}-е число` : 'Платёж добавлен');
      };
    },
  });
}

function openOcc(evId, ym) {
  const ev = S.events.find(e => e.id === evId);
  if (!ev) return;
  const o = F.eventOcc(ev, ym);
  const c = F.cat(S, ev.categoryId);
  const paidTx = o?.paidTx ? S.transactions.find(t => t.id === o.paidTx) : null;
  const html = `
    <div class="occ-head"><div class="gi">${c?.icon || '📌'}</div><div><div class="big2">${ev.type === 'income' ? '+' : ''}${money(ev.amount)}</div><div class="muted small">${esc(c?.name || '')} · ${esc(F.acc(S, ev.accountId)?.name || '')}</div></div></div>
    <div class="row li"><span>Дата</span><b>${o ? U.fmtDateRel(o.date) : ''}</b></div>
    <div class="row li"><span>Повтор</span><b>${esc(F.recurrenceText(ev))}</b></div>
    ${ev.months && o ? `<div class="row li"><span>Платёж</span><b>${o.index} из ${ev.months}</b></div>` : ''}
    ${ev.note ? `<div class="row li"><span>Заметка</span><b>${esc(ev.note)}</b></div>` : ''}
    <div class="row li"><span>Статус</span><b>${paidTx ? `✓ ${ev.type === 'income' ? 'получено' : 'оплачено'} ${U.fmtDate(paidTx.date)}, ${money(paidTx.amount)}` : o?.skipped ? 'пропущен' : o && o.date < U.today() ? '⏰ просрочен' : 'ожидается'}</b></div>
    <div class="menu mt12">
      ${o && !o.paidTx && !o.skipped ? `<button data-m="pay"><i>✅</i>${ev.type === 'income' ? 'Деньги пришли' : 'Отметить оплату'}</button><button data-m="skip"><i>⏭️</i>Пропустить в этом месяце</button>` : ''}
      ${o?.paidTx ? '<button data-m="unpay"><i>↩️</i>Отменить отметку</button>' : ''}
      ${o?.skipped ? '<button data-m="unskip"><i>↩️</i>Вернуть в этот месяц</button>' : ''}
      <button data-m="edit"><i>✏️</i>Изменить</button>
      ${ev.recurring && !ev.endYm ? '<button data-m="stop"><i>⏹️</i>Больше не повторять после этого месяца</button>' : ''}
      ${ev.endYm ? '<button data-m="resume"><i>🔁</i>Снова повторять</button>' : ''}
    </div>`;
  sheet(html, {
    title: ev.title, onMount(r, close) {
      $$('[data-m]', r).forEach(b => b.onclick = () => {
        const m = b.dataset.m;
        if (m === 'pay') { close(); setTimeout(() => openPay(evId, ym), 50); return; }
        if (m === 'edit') { close(); setTimeout(() => openEventForm(ev), 50); return; }
        if (m === 'skip') { (ev.skipped ||= {})[ym] = true; close(); commit('Пропущено в этом месяце'); }
        if (m === 'unskip') { delete ev.skipped[ym]; close(); commit('Возвращено'); }
        if (m === 'unpay') { if (paidTx) deleteTx(paidTx.id); delete ev.paid[ym]; close(); commit('Отметка снята, операция удалена'); }
        if (m === 'stop') { ev.endYm = ym; close(); commit('Повтор остановлен'); }
        if (m === 'resume') { delete ev.endYm; close(); commit('Снова повторяется'); }
      });
    },
  });
}

function openPay(evId, ym) {
  const ev = S.events.find(e => e.id === evId);
  const o = F.eventOcc(ev, ym);
  const inc = ev.type === 'income';
  const html = `<form class="form" id="payf">
    <div class="amount-in"><input name="amount" inputmode="decimal" value="${ev.amount}"><span>₸</span></div>
    <div class="field"><span class="lbl">${inc ? 'На счёт' : 'Со счёта'}</span>${accChips('acc', ev.accountId)}</div>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${o.date < U.today() || o.date > U.today() ? U.today() : o.date}"></label>
    ${ev.recurring ? '<label class="check"><input type="checkbox" name="upd"> Запомнить эту сумму на следующие месяцы</label>' : ''}
    <button class="btn primary block mt12">${inc ? 'Деньги пришли' : 'Оплачено'}</button></form>`;
  sheet(html, {
    title: ev.title, onMount(r, close) {
      const f = $('#payf', r);
      f.onsubmit = e => {
        e.preventDefault();
        const amount = U.parseAmount(fv(f, 'amount'));
        if (!(amount > 0)) { toast('Введи сумму'); return; }
        markPaid(ev, ym, amount, fv(f, 'acc') || ev.accountId, fv(f, 'date') || U.today());
        if (fc(f, 'upd')) ev.amount = amount;
        close(); commit(inc ? 'Поступление записано' : 'Оплата записана');
      };
    },
  });
}
function markPaid(ev, ym, amount, accountId, date) {
  const tx = { id: U.uid(), type: ev.type, amount, categoryId: ev.categoryId, accountId, date, note: ev.title, source: 'calendar', eventId: ev.id, created: Date.now() };
  S.transactions.push(tx);
  (ev.paid ||= {})[ym] = tx.id;
  if (ev.debtId) {
    const d = S.debts.find(x => x.id === ev.debtId);
    if (d) { const interest = d.balance * (d.rate || 0) / 1200; d.balance = Math.max(0, Math.round(d.balance - Math.max(0, amount - interest))); }
  }
  return tx;
}

// ----- Цели -----
function openGoalForm(g = null, preset = {}) {
  const isNew = !g;
  const x = g ? { ...g } : { name: '', target: '', saved: 0, deadline: '', monthly: '', icon: '🎯', ...preset };
  const icons = ['🎯', '🛟', '🚗', '🏠', '✈️', '📱', '💍', '🎓', '👶', '💻', '🏖️', '🎁'];
  const html = `<form class="form" id="gf" autocomplete="off">
    <div class="chips wrap">${icons.map(i => `<label class="pill emoji"><input type="radio" name="icon" value="${i}" ${x.icon === i ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>
    <label class="field"><span class="lbl">Название</span><input name="name" value="${esc(x.name)}" placeholder="Машина, отпуск, подушка…" required></label>
    <div class="row2"><label class="field"><span class="lbl">Нужно, ₸</span><input name="target" inputmode="decimal" value="${x.target || ''}"></label>
    <label class="field"><span class="lbl">Уже есть, ₸</span><input name="saved" inputmode="decimal" value="${x.saved || ''}"></label></div>
    <div class="row2"><label class="field"><span class="lbl">К какой дате</span><input type="date" name="deadline" value="${x.deadline || ''}"></label>
    <label class="field"><span class="lbl">или ₸ в месяц</span><input name="monthly" inputmode="decimal" value="${x.monthly || ''}"></label></div>
    <div class="small muted" id="gcalc"></div>
    <div class="actions">${!isNew ? '<button type="button" class="btn ghost danger" data-del>Удалить</button>' : ''}<button class="btn primary grow">Сохранить</button></div></form>`;
  sheet(html, {
    title: isNew ? 'Новая цель' : 'Изменить цель', onMount(r, close) {
      const f = $('#gf', r);
      const read = () => ({ name: fv(f, 'name').trim(), icon: fv(f, 'icon') || '🎯', target: U.parseAmount(fv(f, 'target')), saved: U.parseAmount(fv(f, 'saved')), deadline: fv(f, 'deadline') || null, monthly: U.parseAmount(fv(f, 'monthly')) || null });
      const calc = () => {
        const p = F.goalPlan(read());
        $('#gcalc', r).textContent = p.done ? '' : p.perMonth ? `≈ ${money(p.perMonth)} в месяц${p.perWeek ? `, ${money(p.perWeek)} в неделю` : ''}${p.etaYm ? `, накопишь к началу ${U.fmtMonthGen(p.etaYm)}` : ''}` : '';
      };
      f.oninput = calc; calc();
      $('[data-del]', r)?.addEventListener('click', async () => { if (await ask('Удалить цель?', esc(g.name), 'Удалить', true)) { S.goals = S.goals.filter(y => y.id !== g.id); close(); commit('Цель удалена'); } });
      f.onsubmit = e => {
        e.preventDefault();
        const d = read();
        if (!d.name || !(d.target > 0)) { toast('Введи название и сумму'); return; }
        if (isNew) S.goals.push({ id: U.uid(), history: [], created: Date.now(), ...d });
        else Object.assign(S.goals.find(y => y.id === g.id), d);
        close(); commit('Цель сохранена');
      };
    },
  });
}
function openGoal(id) {
  const g = S.goals.find(x => x.id === id);
  if (!g) return;
  const p = F.goalPlan(g), avg = F.avgMonthly(S);
  let boost = '';
  if (!p.done && avg?.want > 0) {
    const cut = avg.want * 0.2;
    const per = p.perMonth || g.monthly;
    if (per) {
      const m1 = Math.ceil(p.remaining / per), m2 = Math.ceil(p.remaining / (per + cut));
      if (m1 - m2 > 0) boost = `<div class="tip lvl-info"><div class="ic">⚡</div><div class="grow"><b>Как ускорить</b><div class="small">Если сократить траты «на желания» на 20% (${money(cut)} в месяц) и класть их сюда — цель будет достигнута на ${m1 - m2} мес. раньше.</div></div></div>`;
    } else boost = `<div class="tip lvl-info"><div class="ic">⚡</div><div class="grow"><b>Совет</b><div class="small">Укажи срок или сумму в месяц. Например, 20% от трат «на желания» — это ${money(cut)} в месяц: цель за ${Math.ceil(p.remaining / cut)} мес.</div></div></div>`;
  }
  const html = `<div class="center"><div class="gi big">${g.icon || '🎯'}</div><div class="big2">${money(g.saved)}</div><div class="muted">из ${money(g.target)} · осталось ${money(p.remaining)}</div></div>
    ${bar(p.progress, 'accent')}
    ${p.perMonth && !p.done ? `<div class="trio mt12"><div><span class="muted small">В месяц</span><b>${money(p.perMonth)}</b></div><div><span class="muted small">В неделю</span><b>${money(p.perWeek || p.perMonth / 4.35)}</b></div><div><span class="muted small">${g.deadline ? 'Дней' : 'Месяцев'}</span><b>${g.deadline ? Math.max(0, p.daysLeft) : p.months}</b></div></div>` : ''}
    ${boost}
    ${(g.history || []).length ? `<div class="field mt12"><span class="lbl">История</span>${g.history.slice(-8).reverse().map(h => `<div class="row li small"><span>${U.fmtDate(h.date)}</span><b class="${h.amount < 0 ? 'neg' : 'pos'}">${money(h.amount, { sign: true })}</b></div>`).join('')}</div>` : ''}
    <div class="row gap mt12"><button class="btn primary grow" data-m="add">+ Пополнить</button><button class="btn grow" data-m="take">Снять</button></div>
    <button class="btn ghost block mt6" data-m="edit">Изменить цель</button>`;
  sheet(html, {
    title: g.name, onMount(r, close) {
      $$('[data-m]', r).forEach(b => b.onclick = () => {
        close();
        setTimeout(() => b.dataset.m === 'edit' ? openGoalForm(g) : openGoalMove(g, b.dataset.m === 'add' ? 1 : -1), 50);
      });
    },
  });
}
function openGoalMove(g, sign) {
  const p = F.goalPlan(g);
  const html = `<form class="form" id="gmf"><div class="amount-in"><input name="amount" inputmode="decimal" value="${sign > 0 && p.perMonth ? Math.round(p.perMonth) : ''}" placeholder="0"><span>₸</span></div>
    <label class="check"><input type="checkbox" name="tx" checked> ${sign > 0 ? 'Списать со счёта (перевод в накопления)' : 'Вернуть на счёт'}</label>
    <div class="field"><span class="lbl">Счёт</span>${accChips('acc', 'kaspi')}</div>
    <button class="btn primary block">${sign > 0 ? 'Пополнить' : 'Снять'}</button></form>`;
  sheet(html, {
    title: (sign > 0 ? 'Пополнить: ' : 'Снять: ') + g.name, onMount(r, close) {
      const f = $('#gmf', r);
      setTimeout(() => f.elements.amount.focus(), 250);
      f.onsubmit = e => {
        e.preventDefault();
        const a = U.parseAmount(fv(f, 'amount'));
        if (!(a > 0)) { toast('Введи сумму'); return; }
        g.saved = Math.max(0, (g.saved || 0) + sign * a);
        (g.history ||= []).push({ date: U.today(), amount: sign * a });
        if (fc(f, 'tx')) S.transactions.push({ id: U.uid(), type: sign > 0 ? 'expense' : 'income', amount: a, categoryId: sign > 0 ? 'savings' : 'own_in', accountId: fv(f, 'acc') || 'kaspi', date: U.today(), note: (sign > 0 ? 'На цель: ' : 'С цели: ') + g.name, source: 'goal', created: Date.now() });
        close();
        const pp = F.goalPlan(g);
        commit(pp.done ? '🎉 Цель достигнута!' : `${sign > 0 ? 'Пополнено' : 'Снято'}: ${money(a)}`);
      };
    },
  });
}

// ----- Кредиты -----
function openDebtForm(d = null) {
  const isNew = !d;
  const x = d || { name: '', balance: '', rate: '', minPayment: '', payDay: '' };
  const html = `<form class="form" id="df" autocomplete="off">
    <label class="field"><span class="lbl">Название</span><input name="name" value="${esc(x.name)}" placeholder="Кредит наличными, Kaspi Red, рассрочка на телефон" required></label>
    <div class="row2"><label class="field"><span class="lbl">Остаток долга, ₸</span><input name="balance" inputmode="decimal" value="${x.balance || ''}"></label>
    <label class="field"><span class="lbl">Ставка, % годовых</span><input name="rate" inputmode="decimal" value="${x.rate ?? ''}" placeholder="0 для рассрочки"></label></div>
    <div class="row2"><label class="field"><span class="lbl">Платёж в месяц, ₸</span><input name="minPayment" inputmode="decimal" value="${x.minPayment || ''}"></label>
    <label class="field"><span class="lbl">День платежа</span><input name="payDay" inputmode="numeric" value="${x.payDay || ''}"></label></div>
    <p class="small muted">Ставку бери ГЭСВ из договора — это реальная годовая цена кредита.</p>
    <div class="actions">${!isNew ? '<button type="button" class="btn ghost danger" data-del>Удалить</button>' : ''}<button class="btn primary grow">Сохранить</button></div></form>`;
  sheet(html, {
    title: isNew ? 'Новый кредит' : 'Кредит', onMount(r, close) {
      const f = $('#df', r);
      $('[data-del]', r)?.addEventListener('click', async () => { if (await ask('Удалить кредит?', esc(d.name), 'Удалить', true)) { S.debts = S.debts.filter(y => y.id !== d.id); close(); commit('Удалено'); } });
      f.onsubmit = e => {
        e.preventDefault();
        const pd = parseInt(fv(f, 'payDay'));
        const obj = { name: fv(f, 'name').trim(), balance: U.parseAmount(fv(f, 'balance')), rate: U.parseAmount(fv(f, 'rate')), minPayment: U.parseAmount(fv(f, 'minPayment')), payDay: pd >= 1 && pd <= 31 ? pd : null };
        if (!obj.name || !(obj.balance >= 0) || !(obj.minPayment > 0)) { toast('Заполни название, остаток и платёж'); return; }
        if (isNew) S.debts.push({ id: U.uid(), created: Date.now(), ...obj }); else Object.assign(S.debts.find(y => y.id === d.id), obj);
        ui.debtExtra = null;
        close(); commit('Сохранено');
      };
    },
  });
}
function debtsToCalendar() {
  let n = 0;
  for (const d of S.debts.filter(x => x.balance > 0)) {
    if (S.events.some(e => e.debtId === d.id)) continue;
    const months = F.debtMonths(d);
    const day = d.payDay || +U.today().slice(8);
    let date = U.dayInYm(U.curYm(), day);
    if (date < U.today()) date = U.dayInYm(U.addMonthsYm(U.curYm(), 1), day);
    S.events.push({ id: U.uid(), title: d.name, amount: d.minPayment, type: 'expense', categoryId: 'credit', accountId: 'kaspi', date, recurring: true, months: months < 600 ? months : null, paid: {}, skipped: {}, debtId: d.id, note: 'Платёж по кредиту', created: Date.now() });
    n++;
  }
  commit(n ? `Добавлено в календарь: ${n}. При отметке оплаты остаток долга уменьшается сам.` : 'Все кредиты уже в календаре');
}

// ----- Счета и категории -----
function openAccForm(a = null) {
  const isNew = !a;
  const x = a || { name: '', icon: '💳' };
  const bal = a ? F.accountBalance(S, a) : 0;
  const html = `<form class="form" id="af" autocomplete="off">
    <div class="row2"><label class="field" style="max-width:90px"><span class="lbl">Значок</span><input name="icon" value="${esc(x.icon)}" maxlength="4" class="center"></label>
    <label class="field"><span class="lbl">Название</span><input name="name" value="${esc(x.name)}" placeholder="Halyk, депозит, сейф…" required></label></div>
    <label class="field"><span class="lbl">Остаток сейчас, ₸</span><input name="bal" inputmode="decimal" value="${Math.round(bal * 100) / 100}"></label>
    <p class="small muted">Укажи точную сумму из банка — приложение будет считать от неё.</p>
    ${a ? `<label class="check"><input type="checkbox" name="hidden" ${a.hidden ? 'checked' : ''}> Скрыть счёт (не учитывать в балансе)</label>` : ''}
    <div class="actions">${a && !['kaspi', 'cash'].includes(a.id) ? '<button type="button" class="btn ghost danger" data-del>Удалить</button>' : ''}<button class="btn primary grow">Сохранить</button></div></form>`;
  sheet(html, {
    title: isNew ? 'Новый счёт' : a.name, onMount(r, close) {
      const f = $('#af', r);
      $('[data-del]', r)?.addEventListener('click', async () => {
        if (S.transactions.some(t => t.accountId === a.id || t.toAccountId === a.id)) { toast('По счёту есть операции — его можно только скрыть'); return; }
        if (await ask('Удалить счёт?', esc(a.name), 'Удалить', true)) { S.accounts = S.accounts.filter(y => y.id !== a.id); close(); commit('Удалено'); }
      });
      f.onsubmit = e => {
        e.preventDefault();
        const name = fv(f, 'name').trim();
        if (!name) { toast('Введи название'); return; }
        const nb = U.parseAmount(fv(f, 'bal'));
        let obj = a;
        if (isNew) { obj = { id: U.uid(), name, icon: fv(f, 'icon') || '💳', anchor: { amount: 0, date: '2000-01-01', ts: 0 } }; S.accounts.push(obj); }
        obj.name = name; obj.icon = fv(f, 'icon') || obj.icon; if (a) obj.hidden = fc(f, 'hidden');
        if (isNew || Math.abs(nb - bal) >= 0.01) F.setBalance(S, obj.id, nb);
        close(); commit('Сохранено');
      };
    },
  });
}
function openCatForm(c = null) {
  const isNew = !c;
  const x = c || { name: '', icon: '📌', type: 'expense', group: 'want' };
  const html = `<form class="form" id="cf" autocomplete="off">
    ${isNew ? `<div class="seg">${[['expense', 'Расход'], ['income', 'Доход']].map(([v, l]) => `<label><input type="radio" name="type" value="${v}" ${x.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>` : ''}
    <div class="row2"><label class="field" style="max-width:90px"><span class="lbl">Значок</span><input name="icon" value="${esc(x.icon)}" maxlength="4" class="center"></label>
    <label class="field"><span class="lbl">Название</span><input name="name" value="${esc(x.name)}" required></label></div>
    <div class="field" id="grp"><span class="lbl">Группа (для правила 50/30/20)</span><div class="chips">${[['need', 'Обязательное'], ['want', 'Желания'], ['save', 'Накопления']].map(([v, l]) => `<label class="pill"><input type="radio" name="group" value="${v}" ${x.group === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <label class="check"><input type="checkbox" name="excluded" ${x.excluded ? 'checked' : ''}> Не учитывать в доходах и расходах (перемещение своих денег)</label>
    ${!isNew ? `<label class="check"><input type="checkbox" name="hidden" ${x.hidden ? 'checked' : ''}> Скрыть из списка выбора</label>` : ''}
    <button class="btn primary block mt12">Сохранить</button></form>`;
  sheet(html, {
    title: isNew ? 'Новая категория' : 'Категория', onMount(r, close) {
      const f = $('#cf', r);
      const sync = () => { $('#grp', r).hidden = (isNew ? fv(f, 'type') : x.type) === 'income'; };
      sync(); $$('input[name=type]', r).forEach(i => i.onchange = sync);
      f.onsubmit = e => {
        e.preventDefault();
        const name = fv(f, 'name').trim();
        if (!name) { toast('Введи название'); return; }
        const type = isNew ? fv(f, 'type') : x.type;
        const obj = isNew ? { id: 'c_' + U.uid(), type } : c;
        Object.assign(obj, { name, icon: fv(f, 'icon') || '📌', group: type === 'income' ? 'income' : (fv(f, 'group') || 'want'), excluded: fc(f, 'excluded'), hidden: fc(f, 'hidden') });
        if (isNew) S.categories.push(obj);
        close(); commit('Сохранено');
      };
    },
  });
}

// ----- Импорт -----
async function importKaspiPdf(file) {
  if (!file) return;
  const l = loading('Читаю выписку…');
  let parsed = { rows: [], balance: null };
  let err = null;
  try { parsed = K.parseKaspiLines(await K.pdfLines(file)); } catch (e) { err = e; console.warn(e); }
  l.close();
  if (!parsed.rows.length) {
    if (!S.settings.apiKey) { toast(err ? err.message : 'Не удалось найти операции в файле. Добавь ключ ИИ — он распознает любую выписку.'); return; }
    if (!(await ask('Распознать через ИИ?', 'Автоматически разобрать файл не получилось. ИИ прочитает выписку любого формата (займёт до минуты).', 'Распознать'))) return;
    const l2 = loading('ИИ читает выписку…');
    try { parsed = await AI.readStatementPdf(S, file); } catch (e) { l2.close(); toast(e.message); return; }
    l2.close();
  }
  const txs = parsed.rows.filter(r => r.amount > 0 && validDate(r.date)).map(r => K.mapRow(S, r, 'kaspi'));
  if (!txs.length) { toast('Операций не найдено'); return; }
  openImportPreview(txs, parsed.balance);
}

function openImportPreview(txs, balance) {
  K.markDuplicates(S, txs);
  txs.sort((a, b) => b.date.localeCompare(a.date));
  txs.forEach(t => { t._on = !t._dup; });
  const kaspi = F.acc(S, 'kaspi');
  const canBal = balance && kaspi && balance.date >= (kaspi.anchor?.date || '2000-01-01');
  const rowHtml = (t, i) => `<div class="imp ${t._on ? '' : 'off'}" data-i="${i}">
    <input type="checkbox" data-chk="${i}" ${t._on ? 'checked' : ''} aria-label="Импортировать">
    <div class="grow min0"><div class="row"><span class="t1">${esc(t.merchant || t.op)}</span><b class="${t.type === 'income' ? 'pos' : ''}">${t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−'}${money(t.amount)}</b></div>
    <div class="row small muted"><span>${U.fmtDate(t.date)} · ${esc(t.op || '')}${t._dup ? ` · <span class="dup">${t._dup === 'exact' ? 'уже есть' : 'возможно дубль'}</span>` : ''}</span>
    ${t.type === 'transfer' ? '<span>→ Наличные</span>' : catSelect(t.type, t.categoryId, `data-cat="${i}" class="mini"`)}</div></div></div>`;
  const count = () => txs.filter(t => t._on).length;
  const html = `
    <p class="small muted">Найдено ${txs.length}. ${txs.filter(t => t._dup).length ? `Дубли сняты: ${txs.filter(t => t._dup).length}. ` : ''}Проверь категории — если поменяешь у одного магазина, поменяется у всех таких же и запомнится.</p>
    ${canBal ? `<label class="check"><input type="checkbox" id="setbal" checked> Обновить остаток Kaspi Gold: <b>${money(balance.amount)}</b> на ${U.fmtDate(balance.date)}</label>` : ''}
    <div class="imp-list">${txs.map(rowHtml).join('')}</div>
    <div class="sticky-foot"><button class="btn primary block" id="impgo">Добавить ${count()}</button></div>`;
  sheet(html, {
    title: 'Импорт из Kaspi', full: true, onMount(r, close) {
      const upd = () => { $('#impgo', r).textContent = `Добавить ${count()}`; };
      r.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.chk != null) { const t = txs[+el.dataset.chk]; t._on = el.checked; el.closest('.imp').classList.toggle('off', !el.checked); upd(); }
        if (el.dataset.cat != null) {
          const t = txs[+el.dataset.cat]; t.categoryId = el.value;
          const key = F.normalizeMerchant(t.merchant);
          if (key) {
            S.rules[key] = el.value;
            txs.forEach((o, j) => { if (j !== +el.dataset.cat && o.type === t.type && F.normalizeMerchant(o.merchant) === key) { o.categoryId = el.value; const s = $(`[data-cat="${j}"]`, r); if (s) s.value = el.value; } });
          }
        }
      });
      $('#impgo', r).onclick = () => {
        const sel = txs.filter(t => t._on).map(t => { const { _on, _dup, ...rest } = t; return rest; });
        S.transactions.push(...sel);
        if (canBal && $('#setbal', r)?.checked) F.setBalance(S, 'kaspi', balance.amount, balance.date);
        if (sel.length) ui.txMonth = sel[0].date.slice(0, 7);
        close();
        const rec = F.detectRecurring(S).length;
        commit(`Добавлено операций: ${sel.length}${rec ? `. Найдены регулярные платежи — смотри на главной` : ''}`);
      };
    },
  });
}

function openPasteSheet(text = '') {
  const html = `<form class="form" id="pf"><textarea name="t" rows="7" placeholder="Покупка 3 500 ₸ MAGNUM. Доступно 120 000 ₸&#10;Перевод 10 000 ₸ Айгерим Б.">${esc(text)}</textarea>
    <div class="field"><span class="lbl">Счёт</span>${accChips('acc', 'kaspi')}</div>
    <button class="btn primary block">Распознать</button></form>`;
  sheet(html, {
    title: 'Вставить текст', onMount(r, close) {
      const f = $('#pf', r);
      f.onsubmit = e => {
        e.preventDefault();
        const txs = K.parsePushText(S, fv(f, 't'));
        const accId = fv(f, 'acc') || 'kaspi';
        txs.forEach(t => { t.accountId = accId; t.source = accId === 'kaspi' ? 'kaspi' : 'manual'; if (t.type === 'transfer' && accId !== 'kaspi') { t.type = 'expense'; t.categoryId = 'other_exp'; } });
        if (!txs.length) { toast('Не нашёл сумм с ₸ в тексте'); return; }
        close(); setTimeout(() => openImportPreview(txs, null), 50);
      };
    },
  });
}

async function detectQr(file) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await det.detect(await createImageBitmap(file));
    const v = codes[0]?.rawValue;
    return v && /^https?:\/\//.test(v) ? v : null;
  } catch { return null; }
}

async function receiptFlow(file) {
  if (!file) return;
  const qr = await detectQr(file);
  if (!S.settings.apiKey) {
    sheet(`<p>Чтобы распознавать чеки по фото, нужен ключ ИИ (Claude API). Это стоит примерно несколько тенге за чек.</p>${qr ? `<p class="small">QR-код чека найден: <a href="${esc(qr)}" target="_blank" rel="noopener">открыть чек в ОФД</a></p>` : ''}<button class="btn primary block" data-a="go" data-to="settings">Добавить ключ</button><button class="btn block mt6" data-a="add" data-type="expense">Ввести вручную</button>`, { title: 'Нужен ключ ИИ' });
    return;
  }
  const l = loading('ИИ читает чек…');
  try { const r = await AI.readReceipt(S, file); l.close(); openReceiptPreview(r, qr); }
  catch (e) { l.close(); toast(e.message); }
}

function openReceiptPreview(r, qr) {
  const items = (r.items || []).map(it => ({ name: it.name, qty: it.qty || 1, price: it.price || (it.sum / (it.qty || 1)), sum: +it.sum || 0, categoryId: F.catByName(S, it.category, 'expense')?.id || F.guessCategory(S, it.name, 'expense') }));
  const itemsSum = U.sum(items, i => i.sum);
  const total = r.total || itemsSum;
  const date = validDate(r.date) && r.date <= U.today() ? r.date : U.today();
  const accountId = r.payment === 'cash' ? 'cash' : 'kaspi';
  const match = S.transactions.find(t => t.type === 'expense' && !t.items?.length && Math.abs(t.amount - total) < 1 && Math.abs(U.daysBetween(t.date, date)) <= 1);
  const html = `<form class="form" id="rf" autocomplete="off">
    <div class="row2"><label class="field"><span class="lbl">Магазин</span><input name="store" value="${esc(r.store || '')}"></label>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${date}"></label></div>
    <label class="field"><span class="lbl">Итого, ₸</span><input name="total" inputmode="decimal" value="${total}"></label>
    ${Math.abs(itemsSum - total) > 1 ? `<p class="small warn">Сумма позиций ${money(itemsSum)} не совпадает с итогом — проверь.</p>` : ''}
    ${match ? `<label class="check"><input type="checkbox" name="attach" checked> Это покупка «${esc(txTitle(match))}» от ${U.fmtDate(match.date)} — прикрепить чек к ней</label>` : ''}
    <div class="field" id="raccw"><span class="lbl">Оплата</span>${accChips('acc', accountId)}</div>
    <div class="field"><span class="lbl">Позиции (${items.length})</span><div class="items">${items.map((it, i) => `<div class="item"><div class="grow min0"><div>${esc(it.name)}</div><div class="small muted">${it.qty !== 1 ? `${it.qty} × ${money(it.price)}` : ''}</div></div><b>${money(it.sum)}</b>${catSelect('expense', it.categoryId, `data-item="${i}" class="mini"`)}</div>`).join('')}</div></div>
    ${qr ? `<a class="small" href="${esc(qr)}" target="_blank" rel="noopener">🔗 Проверить чек в ОФД</a>` : ''}
    <button class="btn primary block mt12">Сохранить чек</button></form>`;
  sheet(html, {
    title: '🧾 Чек', full: true, onMount(root, close) {
      const f = $('#rf', root);
      const syncAcc = () => { const w = $('#raccw', root); if (w) w.hidden = fc(f, 'attach'); };
      syncAcc(); if (f.elements.attach) f.elements.attach.onchange = syncAcc;
      f.onsubmit = e => {
        e.preventDefault();
        $$('[data-item]', root).forEach(s => { items[+s.dataset.item].categoryId = s.value; });
        const byCat = {};
        items.forEach(i => { byCat[i.categoryId] = (byCat[i.categoryId] || 0) + i.sum; });
        const mainCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] || 'food';
        const store = fv(f, 'store').trim();
        const amount = U.parseAmount(fv(f, 'total')) || itemsSum;
        if (match && fc(f, 'attach')) {
          Object.assign(match, { items, receiptLink: qr || match.receiptLink, categoryId: mainCat, note: match.note || store });
        } else {
          S.transactions.push({ id: U.uid(), type: 'expense', amount, categoryId: mainCat, accountId: fv(f, 'acc') || accountId, date: fv(f, 'date') || date, note: store, merchant: store, items, receiptLink: qr, time: r.time || null, source: 'receipt', created: Date.now() });
        }
        close(); commit('Чек сохранён');
      };
    },
  });
}

// ----- Резервная копия -----
async function backupExport() {
  const data = JSON.parse(JSON.stringify(S));
  data.settings.apiKey = ''; data.settings.pinHash = null;
  const blob = new Blob([JSON.stringify({ app: 'kalta', version: self.APP_VERSION, exported: new Date().toISOString(), state: data })], { type: 'application/json' });
  const name = `karman-backup-${U.today()}.json`;
  if (N.isNative) {
    if (N.shareFile(name, 'application/json', N.textToB64(await blob.text()))) {
      S.settings.lastBackup = U.today();
      commit('Выбери, куда сохранить: Telegram «Избранное», Google Диск…');
    } else toast('Не удалось подготовить файл');
    return;
  }
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `${APP} — резервная копия` }); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    S.settings.lastBackup = U.today();
    commit('Копия сохранена. Храни её в Telegram «Избранное» или на Google Диске.');
  } catch (e) { if (e.name !== 'AbortError') toast('Не удалось сохранить: ' + e.message); }
}
async function backupImport() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'kalta' || !j.state) throw new Error('Это не резервная копия приложения');
    if (!(await ask('Восстановить копию?', `Копия от ${esc(U.fmtDate(j.exported.slice(0, 10)))}: ${j.state.transactions?.length || 0} операций. Текущие данные заменятся.`, 'Восстановить', true))) return;
    const keep = { apiKey: S.settings.apiKey, pinHash: S.settings.pinHash };
    await replaceState(j.state);
    Object.assign(S.settings, keep, { onboarded: true });
    commit('Данные восстановлены');
  } catch (e) { toast(e.message); }
}

// ----- PIN -----
async function lock() {
  if (locked || !S.settings.pinHash) return;
  locked = true;
  return new Promise(res => {
    const w = document.createElement('div');
    w.className = 'lock';
    let pin = '';
    const draw = () => { $('.pins', w).innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
    w.innerHTML = `<div class="lock-in"><div class="logo">${esc(APP[0])}</div><div>Введи PIN-код</div><div class="pins"></div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('')}</div><button class="link small" data-forgot>Забыл PIN</button></div>`;
    document.body.append(w); draw();
    w.addEventListener('click', async e => {
      if (e.target.closest('[data-forgot]')) { toast('PIN можно сбросить, только удалив данные приложения в настройках браузера. Поэтому делай резервные копии.'); return; }
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
      draw();
      if (pin.length === 4) {
        if (await U.sha256(pin + 'kalta') === S.settings.pinHash) { w.remove(); locked = false; res(); }
        else { w.querySelector('.pins').classList.add('shake'); setTimeout(() => { pin = ''; draw(); w.querySelector('.pins').classList.remove('shake'); }, 450); }
      }
    });
  });
}
function openPinSet() {
  sheet(`<form class="form" id="pinf"><label class="field"><span class="lbl">Новый PIN (4 цифры)</span><input name="a" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
    <label class="field"><span class="lbl">Повтори</span><input name="b" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required></label>
    <p class="small muted">Если забудешь PIN, данные придётся сбросить. Сделай резервную копию.</p><button class="btn primary block">Включить</button></form>`, {
    title: 'PIN-код', onMount(r, close) {
      const f = $('#pinf', r);
      f.onsubmit = async e => {
        e.preventDefault();
        const a = fv(f, 'a'), b = fv(f, 'b');
        if (!/^\d{4}$/.test(a)) { toast('Нужно 4 цифры'); return; }
        if (a !== b) { toast('PIN не совпадает'); return; }
        S.settings.pinHash = await U.sha256(a + 'kalta');
        close(); commit('PIN включён');
      };
    },
  });
}

// ----- Первый запуск -----
function onboarding() {
  const html = `<div class="center"><div class="logo big">${esc(APP[0])}</div><p><b>${esc(APP)}</b> — твои деньги под контролем: Kaspi, наличные, чеки, календарь платежей и ИИ-советник.</p><p class="small muted">Все данные хранятся только на этом телефоне.</p></div>
    <form class="form" id="obf" autocomplete="off">
      <label class="field"><span class="lbl">Как тебя зовут?</span><input name="name" placeholder="Имя"></label>
      <div class="row2"><label class="field"><span class="lbl">Сейчас на Kaspi Gold, ₸</span><input name="kaspi" inputmode="decimal" placeholder="0"></label>
      <label class="field"><span class="lbl">Наличными, ₸</span><input name="cash" inputmode="decimal" placeholder="0"></label></div>
      <label class="field"><span class="lbl">День зарплаты (если есть)</span><input name="payday" inputmode="numeric" placeholder="например 5"></label>
      <button class="btn primary block">Начать</button>
    </form>`;
  sheet(html, {
    title: 'Добро пожаловать', onMount(r, close) {
      const f = $('#obf', r);
      f.onsubmit = e => {
        e.preventDefault();
        S.settings.name = fv(f, 'name').trim();
        const pd = parseInt(fv(f, 'payday'));
        S.settings.payday = pd >= 1 && pd <= 31 ? pd : null;
        F.setBalance(S, 'kaspi', U.parseAmount(fv(f, 'kaspi')));
        F.setBalance(S, 'cash', U.parseAmount(fv(f, 'cash')));
        S.settings.onboarded = true;
        close(); commit('Готово! Добавь первый расход или загрузи выписку Kaspi.');
        if (N.isNative && !N.hasAccess()) { S.settings.autoAsked = true; save(); setTimeout(autoSetupSheet, 400); }
      };
    },
  });
}

// ============ Действия по нажатию ============
const A = {
  go: el => { location.hash = '#' + el.dataset.to; },
  add: el => openTxForm(null, { type: el.dataset.type }),
  'add-menu': () => openAddMenu(),
  'tx-edit': el => { const t = S.transactions.find(x => x.id === el.dataset.id); if (t) openTxForm(t); },
  'tx-filter': el => { ui.txFilter = el.dataset.f; refresh(); },
  receipt: async () => receiptFlow(await pickFile('image/*')),
  'import-pdf': async () => importKaspiPdf(await pickFile('application/pdf,.pdf')),
  paste: () => openPasteSheet(),
  'backup-export': () => backupExport(),
  'backup-import': () => backupImport(),
  month: el => { const k = el.dataset.k; ui[k] = U.addMonthsYm(ui[k], +el.dataset.d); refresh(); },
  'cal-day': el => { ui.calDay = el.dataset.d; refresh(); },
  'ev-add': el => openEventForm(null, el.dataset.d ? { date: el.dataset.d } : {}),
  occ: el => openOcc(el.dataset.id, el.dataset.ym),
  'occ-pay': el => openPay(el.dataset.id, el.dataset.ym),
  'sugg-add': el => {
    const s = F.detectRecurring(S).find(x => x.key === el.dataset.key);
    if (!s) return;
    let date = U.dayInYm(U.curYm(), s.day);
    if (date < U.today()) date = U.dayInYm(U.addMonthsYm(U.curYm(), 1), s.day);
    openEventForm(null, { title: s.title, amount: s.amount, categoryId: s.categoryId, accountId: s.accountId, date, recurring: true });
  },
  'sugg-hide': el => { S.dismissed['rec:' + el.dataset.key] = true; commit('Скрыто'); },
  'rep-open': el => { ui.repKind = el.dataset.k; ui.repDate = el.dataset.d || U.today(); if (route() === 'reports') refresh(); else location.hash = '#reports'; },
  'rep-kind': el => { ui.repKind = el.dataset.k; refresh(); },
  'rep-nav': el => { const p = F.period(ui.repKind, ui.repDate); const d = +el.dataset.d > 0 ? p.next : p.prev; if (d <= U.today()) { ui.repDate = d; refresh(); } },
  'rep-cat': el => { const p = F.period(ui.repKind, ui.repDate); ui.txMonth = p.from.slice(0, 7); ui.txSearch = F.catName(S, el.dataset.id); ui.txFilter = 'all'; location.hash = '#tx'; },
  'rep-share': async () => {
    const text = F.reportText(S, F.report(S, ui.repKind, ui.repDate));
    if (N.isNative) { N.shareText('Отчёт', text); return; }
    try {
      if (navigator.share) await navigator.share({ title: 'Отчёт', text });
      else { await navigator.clipboard.writeText(text); toast('Отчёт скопирован'); }
    } catch (e) { if (e.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Отчёт скопирован'); } catch { toast('Не удалось поделиться'); } } }
  },
  'rep-ai': () => {
    const text = F.reportText(S, F.report(S, ui.repKind, ui.repDate));
    location.hash = '#chat';
    sendChat(`Сделай разбор этого отчёта: что хорошо, что тревожит, и 3 конкретных шага, что изменить в следующем периоде.\n\n${text}`);
  },
  'period-hide': el => { S.dismissed[el.dataset.key] = true; commit(); },
  'goal-add': () => openGoalForm(),
  'goal-open': el => openGoal(el.dataset.id),
  'goal-fund': () => { const a = F.avgMonthly(S); openGoalForm(null, { name: 'Подушка безопасности', icon: '🛟', target: a ? Math.round(a.spending * 3 / 10000) * 10000 : '' }); },
  'debt-add': () => openDebtForm(),
  'debt-edit': el => openDebtForm(S.debts.find(d => d.id === el.dataset.id)),
  'debts-to-cal': () => debtsToCalendar(),
  'acc-edit': el => openAccForm(S.accounts.find(a => a.id === el.dataset.id)),
  'acc-add': () => openAccForm(),
  'cat-edit': el => openCatForm(S.categories.find(c => c.id === el.dataset.id)),
  'cat-add': () => openCatForm(),
  'cat-tx': el => { ui.txMonth = ui.statsMonth; ui.txSearch = F.catName(S, el.dataset.id); ui.txFilter = 'all'; location.hash = '#tx'; },
  'chat-ask': el => {
    const q = el.dataset.q;
    if (el.dataset.send) { sendChat(q); return; }
    ui.chatDraft = q;
    if (route() !== 'chat') location.hash = '#chat'; else refresh();
    setTimeout(() => { const ta = $('#chatf textarea'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 100);
  },
  'chat-undo': el => {
    const a = S.chat[+el.dataset.i]?.actions?.[+el.dataset.j];
    if (!a || a.undone) return;
    const key = { event: 'events', tx: 'transactions', goal: 'goals', debt: 'debts' }[a.kind];
    if (key) S[key] = S[key].filter(x => x.id !== a.id);
    a.undone = true; commit('Отменено');
  },
  'chat-clear': async () => { if (await ask('Очистить чат?', 'История переписки удалится. Добавленные ИИ платежи останутся.', 'Очистить', true)) { S.chat = []; commit(); } },
  'price-open': el => {
    const x = F.priceIndex(S).find(p => p.name.toLowerCase() === el.dataset.k);
    if (!x) return;
    sheet(`<div class="trio"><div><span class="muted small">Последняя</span><b>${money(x.last.price)}</b></div><div><span class="muted small">Мин</span><b class="pos">${money(x.min)}</b></div><div><span class="muted small">Макс</span><b>${money(x.max)}</b></div></div>
      ${[...x.entries].reverse().map(e => `<div class="row li small"><span>${U.fmtDate(e.date)} · ${esc(e.store)}</span><b>${money(e.price)}</b></div>`).join('')}`, { title: x.name });
  },
  'pin-set': () => openPinSet(),
  'pin-remove': async () => { if (await ask('Убрать PIN?', 'Приложение будет открываться без кода.', 'Убрать')) { S.settings.pinHash = null; commit('PIN отключён'); } },
  theme: el => { S.settings.theme = el.dataset.v; applyTheme(); commit(); },
  wipe: async () => {
    if (!(await ask('Удалить ВСЕ данные?', 'Операции, календарь, цели — всё будет стёрто с телефона. Сначала сделай резервную копию!', 'Удалить всё', true))) return;
    if (!(await ask('Точно?', 'Отменить это нельзя.', 'Да, удалить', true))) return;
    const { defaultState } = await import('./state.js');
    await replaceState(defaultState());
    location.hash = '#home'; location.reload();
  },
  'ai-test': async () => {
    const f = $('#setf');
    if (f) { S.settings.apiKey = fv(f, 'apiKey').trim(); S.settings.model = fv(f, 'model'); save(); }
    const l = loading('Проверяю…');
    try { await AI.call(S, { max_tokens: 10, messages: [{ role: 'user', content: 'Ответь одним словом: работает' }] }); l.close(); toast('✅ ИИ работает'); }
    catch (e) { l.close(); toast(e.message === 'NO_KEY' ? 'Введи ключ' : e.message); }
  },
  voice: () => startVoice(),
  'auto-access': () => N.openAccess(),
  'notif-settings': () => N.openNotifSettings(),
  'check-update': async () => {
    if (N.isNative) { checkApkUpdate(true); return; }
    if (!swReg) { toast('Обновления работают, когда приложение открыто с сайта (https)'); return; }
    const l = loading('Проверяю…');
    try { await swReg.update(); } catch { /* */ }
    setTimeout(() => { l.close(); if (!swReg.waiting && !swReg.installing) toast(`У тебя последняя версия ${self.APP_VERSION}`); }, 1500);
  },
};
function onClick(e) {
  const t = e.target.closest('[data-a]');
  if (!t || t.closest('.lock')) return;
  const fn = A[t.dataset.a];
  if (fn) { e.preventDefault(); e.stopPropagation(); if (t.closest('.sheet') && ['go', 'add', 'auto-access'].includes(t.dataset.a)) closeAllSheets(); fn(t, e); }
}

// ============ Тема, обновления, «Поделиться» ============
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#0d1117' : '#f4f6f9';
}

function setupSW() {
  if (N.isNative || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'VERSION') showUpdate(e.data); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    swReg = reg;
    const found = w => { if (w && navigator.serviceWorker.controller) w.postMessage('GET_VERSION'); };
    if (reg.waiting) found(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') found(w); });
    });
    setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000);
  }).catch(e => console.warn('SW', e));
}
function showUpdate({ version, notes }) {
  if ($('.update-banner')) return;
  const b = document.createElement('div');
  b.className = 'update-banner';
  b.innerHTML = `<div class="grow"><b>🎉 Вышла версия ${esc(version)}</b>${(notes || []).length ? `<div class="small">${notes.map(esc).join('<br>')}</div>` : ''}</div><button class="btn primary small">Обновить</button>`;
  b.querySelector('button').onclick = async () => {
    updating = true;
    await saveNow();
    if (swReg?.waiting) swReg.waiting.postMessage('SKIP_WAITING'); else location.reload();
  };
  document.body.append(b);
}

async function handleShared() {
  if (!location.search.includes('shared=1') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname + location.hash);
  try {
    const c = await caches.open('kalta-share');
    const f = await c.match('./shared-file'), t = await c.match('./shared-text');
    if (f) {
      const blob = await f.blob();
      const name = decodeURIComponent(f.headers.get('x-name') || 'file');
      await c.delete('./shared-file');
      const file = new File([blob], name, { type: blob.type });
      if (/pdf/.test(file.type) || /\.pdf$/i.test(name)) await importKaspiPdf(file);
      else if (file.type.startsWith('image/')) await receiptFlow(file);
    }
    if (t) { const text = await t.text(); await c.delete('./shared-text'); if (!f) openPasteSheet(text); }
  } catch (e) { console.warn(e); }
}

// ============ Android: автоматика ============
let syncTimer = null;
function scheduleSync() {
  if (!N.isNative) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNative, 800);
}
function syncNative() {
  if (!N.isNative || !S) return;
  const s = F.safeToSpend(S), t = F.rangeStats(S, U.today(), U.today());
  N.widget({ title: 'Можно тратить сегодня', perDay: money(s.perDay), neg: s.perDay < 0, sub: `до ${U.fmtDate(s.until)} · ${s.days} ${U.plural(s.days, 'день', 'дня', 'дней')}`, today: `Сегодня −${money(t.spending)}` });
  N.schedule(buildAlarms());
  N.setOptions({ confirm: S.settings.confirmPush !== false });
}
function buildAlarms() {
  const st = S.settings, out = [], now = Date.now();
  const at = (d, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const x = U.parseYmd(d); x.setHours(h || 0, m || 0, 0, 0); return x.getTime(); };
  if (st.remindPayments !== false) {
    for (const o of F.occurrencesBetween(S, U.today(), U.addDays(U.today(), 35)).filter(F.isOpen)) {
      const inc = o.ev.type === 'income', sum = money(o.ev.amount);
      if (!inc) out.push({ id: N.intId('b' + o.ev.id + o.ym), at: at(U.addDays(o.date, -1), '10:00'), title: 'Завтра платёж', text: `${o.ev.title} — ${sum}`, route: '#cal', channel: 'reminders' });
      out.push({ id: N.intId('d' + o.ev.id + o.ym), at: at(o.date, '10:00'), title: inc ? 'Сегодня поступление' : 'Сегодня платёж', text: inc ? `${o.ev.title} — ${sum}. Отметь в календаре, когда придёт.` : `${o.ev.title} — ${sum}. Не забудь оплатить и отметить.`, route: '#cal', channel: 'reminders' });
    }
  }
  if (st.eveningReminder !== false) {
    for (let i = 0; i < 7; i++) { const d = U.addDays(U.today(), i); out.push({ id: N.intId('e' + d), at: at(d, st.eveningTime || '21:00'), title: 'Итоги дня', text: 'Запиши наличные траты и посмотри, куда ушли деньги сегодня.', route: '#reports-day', channel: 'reports' }); }
  }
  if (st.weeklySummary !== false) {
    for (let i = 0, n = 0; i < 14 && n < 2; i++) {
      const d = U.addDays(U.today(), i);
      if (U.parseYmd(d).getDay() === 0) { out.push({ id: N.intId('w' + d), at: at(d, '20:00'), title: 'Итоги недели готовы', text: 'Сколько ушло за неделю и на что — открой отчёт.', route: '#reports-week', channel: 'reports' }); n++; }
    }
  }
  return out.filter(a => a.at > now).sort((a, b) => a.at - b.at).slice(0, 80);
}

// Счёт для уведомления: Kaspi → Kaspi Gold, другой банк → свой счёт (создаётся сам)
function accountForPkg(it) {
  const s = `${it.pkg} ${it.app}`.toLowerCase();
  if (s.includes('kaspi')) return 'kaspi';
  const sms = /messag|sms|mms/.test(s);
  const name = (sms ? it.title : it.app) || 'Банк';
  let a = sms ? S.accounts.find(x => x.name.toLowerCase() === name.toLowerCase()) : S.accounts.find(x => x.pkg === it.pkg) || S.accounts.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!a) {
    a = { id: 'acc_' + U.uid(), name, icon: '🏦', anchor: { amount: 0, date: '2000-01-01', ts: 0 } };
    if (!sms) a.pkg = it.pkg;
    S.accounts.push(a);
    setTimeout(() => toast(`Новый счёт «${name}» — укажи его остаток`, { label: 'Указать', fn: () => openAccForm(a) }), 3200);
  }
  return a.id;
}

function processPushQueue() {
  if (!N.isNative || !S) return;
  const items = N.pull();
  if (!items.length) return;
  const added = [];
  for (const it of items) {
    const tx = K.parseNotification(S, it);
    if (!tx) continue;
    const accId = accountForPkg(it);
    Object.assign(tx, { accountId: accId, source: 'push', pkg: it.pkg, ts: it.ts, created: Date.now() });
    if (tx.type === 'transfer' && tx.toAccountId === accId) continue;
    const dup = S.transactions.find(x => x.type === tx.type && Math.abs(x.amount - tx.amount) < 1 &&
      ((x.pkg === it.pkg && x.ts === it.ts) || (x.source === 'kaspi' && x.hash === tx.hash) || (x.source === 'push' && x.ts && Math.abs(x.ts - it.ts) < 15 * 60000 && x.pkg !== it.pkg)));
    if (dup) continue;
    S.transactions.push(tx);
    added.push(tx);
  }
  if (!added.length) return;
  save(); scheduleSync(); refresh();
  const one = added.length === 1 ? added[0] : null;
  toast(one ? `Записано: ${one.type === 'income' ? '+' : '−'}${money(one.amount)} · ${one.type === 'transfer' ? 'перевод' : F.catName(S, one.categoryId)}` : `Записано из уведомлений: ${added.length}`,
    { label: one ? 'Изменить' : 'Посмотреть', fn: () => { if (one) openTxForm(S.transactions.find(t => t.id === one.id)); else location.hash = '#tx'; } });
}

async function handleNativeShared() {
  const sh = N.takeShared();
  if (!sh) return;
  if (sh.b64) {
    const file = N.b64ToFile(sh.b64, sh.name || 'file', sh.mime);
    if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) await importKaspiPdf(file);
    else if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic)$/i.test(file.name)) await receiptFlow(file);
    else toast('Такой файл не поддерживается: нужна выписка PDF или фото чека');
  } else if (sh.text) openPasteSheet(sh.text);
}

let lastUpdateCheck = 0;
async function checkApkUpdate(manual = false) {
  if (!N.isNative) return;
  if (!manual && Date.now() - lastUpdateCheck < 6 * 3600 * 1000) return;
  lastUpdateCheck = Date.now();
  if (!self.APP_REPO) { if (manual) toast('Эта сборка сделана не на GitHub — проверить обновления нельзя'); return; }
  const l = manual ? loading('Проверяю…') : null;
  try {
    const r = await fetch(`https://api.github.com/repos/${self.APP_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(r.status === 404 ? 'релизов пока нет' : 'GitHub ответил ' + r.status);
    const j = await r.json();
    const build = parseInt(String(j.tag_name || '').replace(/\D/g, ''), 10) || 0;
    const apk = (j.assets || []).find(a => /\.apk$/i.test(a.name));
    l?.close();
    if (apk && build > (self.APP_BUILD || 0)) showApkUpdate(j, apk);
    else if (manual) toast(`У тебя последняя версия ${self.APP_VERSION} (сборка ${self.APP_BUILD})`);
  } catch (e) { l?.close(); if (manual) toast('Не удалось проверить: ' + e.message); }
}
function showApkUpdate(rel, apk) {
  if ($('.update-banner')) return;
  const notes = String(rel.body || '').split('\n').map(x => x.replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 4);
  const b = document.createElement('div');
  b.className = 'update-banner';
  b.innerHTML = `<div class="grow"><b>🎉 ${esc(rel.name || 'Новая версия')}</b>${notes.length ? `<div class="small">${notes.map(esc).join('<br>')}</div>` : ''}</div><div class="col"><button class="btn primary small">Скачать</button><button class="link small" data-x>Позже</button></div>`;
  b.querySelector('.btn').onclick = async () => {
    await saveNow();
    N.openUrl(apk.browser_download_url);
    toast('Когда файл скачается — открой его и нажми «Обновить». Данные сохранятся.');
    b.remove();
  };
  b.querySelector('[data-x]').onclick = () => b.remove();
  document.body.append(b);
}

function startVoice() {
  if (N.isNative) { N.voice(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Голосовой ввод недоступен в этом браузере'); return; }
  const r = new SR();
  r.lang = 'ru-RU'; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = e => onVoiceText(e.results[0][0].transcript);
  r.onerror = () => toast('Не расслышал, попробуй ещё раз');
  r.start();
  toast('🎤 Говори: «такси две тысячи наличными»');
}
function onVoiceText(text) {
  if (text == null) { toast('Голосовой ввод не сработал. Проверь, что установлено приложение Google.'); return; }
  const p = F.parseQuick(S, U.wordsToNumbers(text));
  if (!p) { toast(`Не нашёл сумму в «${text}». Скажи, например: «обед три тысячи»`); return; }
  const tx = { id: U.uid(), ...p, source: 'voice', created: Date.now() };
  S.transactions.push(tx);
  commit(`🎤 ${p.type === 'income' ? '+' : '−'}${money(p.amount)} · ${p.note || F.catName(S, p.categoryId)} · ${F.acc(S, p.accountId)?.name}`,
    { label: 'Изменить', fn: () => openTxForm(S.transactions.find(t => t.id === tx.id)) });
}

// Ссылки из виджета и уведомлений
const SPECIAL = {
  '#add-expense': { after: () => openTxForm(null, { type: 'expense' }) },
  '#voice': { after: () => startVoice() },
  '#reports-day': { to: '#reports', before: () => { ui.repKind = 'day'; ui.repDate = U.today(); } },
  '#reports-week': { to: '#reports', before: () => { ui.repKind = 'week'; ui.repDate = U.today(); } },
};
function handleSpecialRoute() {
  const r = SPECIAL[location.hash];
  if (!r) return false;
  r.before?.();
  history.replaceState(null, '', r.to || '#home');
  closeAllSheets();
  render(true);
  if (r.after) setTimeout(r.after, 80);
  return true;
}

function autoCardHtml() {
  const st = S.settings, access = N.hasAccess();
  const apps = N.apps().sort((a, b) => b.count - a.count);
  return `<div class="card" id="autocard"><h2>⚡ Автоматический учёт</h2>
    <div class="row li"><span>Доступ к уведомлениям</span>${access ? '<b class="pos">✓ включён</b>' : '<button class="btn primary small" data-a="auto-access">Включить</button>'}</div>
    <p class="small muted">Читаются только уведомления о деньгах (с суммой в ₸) от отмеченных приложений. Всё обрабатывается на телефоне, в интернет ничего не уходит.</p>
    ${apps.length ? `<div class="field"><span class="lbl">Откуда записывать траты</span>${apps.map(a => `<label class="check"><input type="checkbox" data-app="${esc(a.pkg)}" ${a.allowed ? 'checked' : ''}><span>${esc(a.label)} <span class="muted small">· ${a.count} увед.</span></span></label>`).join('')}
      <p class="small muted">Onay, Yandex Go, Glovo и т.п. лучше не отмечать: их оплата уже приходит уведомлением от банка, иначе трата запишется дважды.</p></div>`
      : `<p class="small muted">${access ? 'Приложения появятся здесь после первого уведомления о деньгах.' : ''}</p>`}
    <label class="check"><input type="checkbox" data-opt="confirmPush" ${st.confirmPush !== false ? 'checked' : ''}><span>Уведомлять «Записал в Карман» после каждой траты</span></label>
    <h2 class="mt12">Напоминания</h2>
    <label class="check"><input type="checkbox" data-opt="remindPayments" ${st.remindPayments !== false ? 'checked' : ''}><span>О платежах из календаря — накануне и в день платежа</span></label>
    <div class="check"><input type="checkbox" data-opt="eveningReminder" ${st.eveningReminder !== false ? 'checked' : ''} aria-label="Вечерний итог дня"><span>Вечерний итог дня в</span><input type="time" class="time-in" data-opt-time value="${esc(st.eveningTime || '21:00')}"></div>
    <label class="check"><input type="checkbox" data-opt="weeklySummary" ${st.weeklySummary !== false ? 'checked' : ''}><span>Итоги недели по воскресеньям в 20:00</span></label>
    <button class="btn ghost small mt6" data-a="notif-settings">Звук и вид уведомлений</button>
  </div>`;
}

function autoSetupSheet() {
  sheet(`<p>Чтобы траты из Kaspi и других банков записывались сами, «Карману» нужен доступ к уведомлениям.</p>
    <ul class="small"><li>Читаются только уведомления о деньгах с суммой в ₸.</li><li>Всё остаётся на телефоне — в интернет ничего не уходит.</li><li>Какие приложения учитывать, можно выбрать в настройках.</li></ul>
    <p class="small muted">На следующем экране найди «Карман» и включи переключатель.</p>
    <button class="btn primary block" data-a="auto-access">Разрешить доступ</button>`, { title: '⚡ Автоматический учёт' });
}

window.__karmanNative = {
  onPush: () => processPushQueue(),
  onVoice: text => { if (S) onVoiceText(text); },
  onShared: () => { if (S) handleNativeShared(); },
  onResume: () => {
    if (!S) return;
    processPushQueue();
    scheduleSync();
    checkApkUpdate();
    if (route() === 'settings' || route() === 'home') refresh();
  },
  onPause: () => { if (S) { saveNow().catch(() => { }); syncNative(); } },
};

// ============ Запуск ============
async function boot() {
  await loadState();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  navigator.storage?.persist?.().catch(() => { });
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', () => { if (handleSpecialRoute()) return; closeAllSheets(); render(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveNow().catch(() => { }); hiddenAt = Date.now(); }
    else {
      if (S.settings.pinHash && hiddenAt && Date.now() - hiddenAt > 120000) lock();
      swReg?.update().catch(() => { });
      if (route() === 'home') refresh();
    }
  });
  window.addEventListener('pagehide', () => { saveNow().catch(() => { }); });
  const locking = S.settings.pinHash ? lock() : null; // экран PIN появляется до показа данных
  if (!handleSpecialRoute()) render(true);
  setupSW();
  if (locking) await locking;
  await handleShared();
  if (!S.settings.onboarded) onboarding();
  if (N.isNative) {
    processPushQueue();
    await handleNativeShared();
    syncNative();
    checkApkUpdate();
    if (S.settings.onboarded && !N.hasAccess() && !S.settings.autoAsked) { S.settings.autoAsked = true; save(); autoSetupSheet(); }
  }
}
boot();

// для отладки
window.__kalta = { get S() { return S; }, F, K, U, refresh };
