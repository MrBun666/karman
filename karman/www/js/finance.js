// Финансовая логика: балансы, статистика, календарь, кредиты, цели, советы
import * as U from './util.js';

export const cat = (S, id) => S.categories.find(c => c.id === id);
export const acc = (S, id) => S.accounts.find(a => a.id === id);
export const catName = (S, id) => cat(S, id)?.name || 'Без категории';

export function catByName(S, name, type) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  const pool = S.categories.filter(c => !type || c.type === type);
  return pool.find(c => c.name.toLowerCase() === n)
    || pool.find(c => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()))
    || null;
}

// ---------- Магазины и категории ----------
export function normalizeMerchant(s) {
  if (!s) return '';
  let t = ' ' + String(s).toLowerCase().replace(/ё/g, 'е').replace(/["«»'`*№#]/g, ' ') + ' ';
  for (let i = 0; i < 2; i++) t = t.replace(/\s(тоо|ип|ао|too|ip|llp|jsc|ооо|кх)\s/g, ' ');
  t = t.replace(/\d{3,}/g, ' ').replace(/[.,;:()\-_/\\|+]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(Boolean).slice(0, 3).join(' ');
}

const EXPENSE_KW = {
  subs: ['netflix', 'spotify', 'youtube', 'apple.com', 'icloud', 'yandex plus', 'яндекс плюс', 'kinopoisk', 'кинопоиск', 'ivi', 'chatgpt', 'openai', 'anthropic', 'claude.ai', 'google one', 'megogo', 'okko', 'подписк'],
  cafe: ['glovo', 'wolt', 'яндекс еда', 'yandex eda', 'yandex.eda', 'kfc', 'burger', 'бургер', 'mcdonald', 'макдональдс', 'starbucks', 'coffee', 'кофе', 'кафе', 'cafe', 'ресторан', 'restaurant', 'pizza', 'пицц', 'sushi', 'суши', 'doner', 'донер', 'шаурм', 'chocofood', 'dodo', 'додо', 'bahandi', 'салам бро', 'hardee', 'lanzhou', 'столов'],
  food: ['magnum', 'магнум', 'small', 'смолл', 'galmart', 'галмарт', 'anvar', 'анвар', 'metro', 'dina', 'toimart', 'ramstore', 'interfood', 'супермаркет', 'продукт', 'market', 'маркет', 'хлеб', 'arbuz', 'airba fresh', 'gross', 'astykzhan', 'карфур', 'carrefour', 'мясо', 'овощ', 'базар'],
  transport: ['yandex go', 'яндекс go', 'yandex.go', 'яндекс такси', 'такси', 'taxi', 'indrive', 'indriver', 'onay', 'автобус', 'метро ', 'uber', 'bolt', 'жд билет', 'temir zholy', 'air astana', 'scat', 'fly arystan', 'авиабилет'],
  car: ['бензин', 'азс', 'helios', 'sinooil', 'sinoil', 'газпром', 'kazmunaigas', 'кмг', 'compass', 'royal petrol', 'tabys', 'парковк', 'parking', 'автомойк', 'шиномонтаж', 'автозапчаст', 'страховк', 'qazaq oil', 'petrol'],
  home: ['коммун', 'алсеко', 'alseco', 'ерц', 'энергосбыт', 'свет ', 'водоканал', 'тепло', 'газ ', 'квартплат', 'аренда', 'оси ', 'кск', 'кооператив'],
  comm: ['beeline', 'билайн', 'kcell', 'activ', 'актив', 'tele2', 'altel', 'алтел', 'казахтелеком', 'kazakhtelecom', 'интернет', 'megaline', 'izi', 'мобильная связь'],
  health: ['аптек', 'apteka', 'europharma', 'sadyhan', 'садыхан', 'биосфер', 'клиник', 'clinic', 'invivo', 'олимп', 'olymp', 'стоматолог', 'лаборатор', 'медицин', 'мед центр', 'doctor', 'врач'],
  clothes: ['lc waikiki', 'zara', 'h&m', 'defacto', 'colin', 'adidas', 'nike', 'обувь', 'одежд', 'sportmaster', 'спортмастер', 'puma', 'mango', 'bershka'],
  household: ['fix price', 'фикс прайс', 'sulpak', 'сулпак', 'technodom', 'технодом', 'мечта', 'mechta', 'леруа', 'leroy', 'ikea', 'хозтовар', 'химия', 'kaspi магазин', 'wildberries', 'ozon'],
  fun: ['кино', 'kinopark', 'chaplin', 'cinema', 'steam', 'playstation', 'боулинг', 'театр', 'концерт', 'ticketon', 'kassir'],
  edu: ['курс', 'school', 'школ', 'универ', 'обучен', 'книг', 'marwin', 'меломан', 'репетитор', 'учеб'],
  beauty: ['салон', 'барбер', 'barber', 'парикмах', 'маникюр', 'cosmetic', 'косметик', 'золотое яблоко', 'gold apple', 'спа ', 'spa '],
  kids: ['детск', 'игрушк', 'памперс', 'подгуз', 'садик', 'детсад'],
  gifts: ['подар', 'цветы', 'flowers', 'букет'],
  credit: ['рассрочк', 'кредит', 'погашени', 'kaspi red', 'микрозайм', 'займ'],
};
const INCOME_KW = {
  salary: ['зарплат', 'заработн', 'salary', 'аванс', 'зп ', ' зп', 'оклад', 'премия'],
  side: ['подработ', 'фриланс', 'заказ', 'халтур'],
  cashback: ['кэшбэк', 'кешбэк', 'cashback', 'бонус', 'возврат'],
  p2p_in: ['перевод от', 'перевел', 'перевела'],
};

export function ruleFor(S, text) {
  const key = normalizeMerchant(text);
  if (key && S.rules[key] && cat(S, S.rules[key])) return S.rules[key];
  return null;
}

export function guessCategory(S, text, type = 'expense') {
  const r = ruleFor(S, text);
  if (r && cat(S, r)?.type === type) return r;
  const t = ' ' + String(text || '').toLowerCase().replace(/ё/g, 'е') + ' ';
  for (const [k, v] of Object.entries(S.rules)) if (k.length >= 4 && t.includes(k) && cat(S, v)?.type === type) return v;
  const dict = type === 'income' ? INCOME_KW : EXPENSE_KW;
  for (const [id, words] of Object.entries(dict)) if (cat(S, id) && words.some(w => t.includes(w))) return id;
  return type === 'income' ? 'other_inc' : 'other_exp';
}

// Быстрый ввод: «такси 2000 нал», «+150к зарплата каспи», «вчера кофе 1500»
export function parseQuick(S, text) {
  let s = ' ' + text.trim().toLowerCase() + ' ';
  let type = /^\s*\+/.test(s) || /(зарплат|зп|аванс|доход|получил|пришло|премия|кэшбэк)/.test(s) ? 'income' : 'expense';
  const m = s.match(/[+\-]?\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(к|k|тыс)?(?=\s|₸|тг|$)/i);
  if (!m) return null;
  let amount = U.parseAmount(m[1]) * (m[2] ? 1000 : 1);
  if (!(amount > 0)) return null;
  s = s.replace(m[0], ' ');
  let accountId = S.settings.defaultAccount;
  const accMatch = [[/(^|\s)(нал|наличк\S*|наличн\S*|кэш|cash)(?=\s)/, 'cash'], [/(^|\s)(каспи|kaspi|карт\S*|gold|голд)(?=\s)/, 'kaspi']];
  for (const [re, id] of accMatch) if (re.test(s) && acc(S, id)) { accountId = id; s = s.replace(re, ' '); }
  for (const a of S.accounts) { const n = a.name.toLowerCase(); if (n.length > 2 && s.includes(' ' + n + ' ')) { accountId = a.id; s = s.replace(n, ' '); } }
  let date = U.today();
  if (/(^|\s)позавчера(?=\s)/.test(s)) { date = U.addDays(date, -2); s = s.replace('позавчера', ' '); }
  else if (/(^|\s)вчера(?=\s)/.test(s)) { date = U.addDays(date, -1); s = s.replace('вчера', ' '); }
  s = s.replace(/₸|тг|тенге|\+|−|-/g, ' ').replace(/\s+/g, ' ').trim();
  const note = s ? U.cap(s) : '';
  return { type, amount, accountId, date, note, categoryId: guessCategory(S, note, type) };
}

// ---------- Балансы ----------
function affects(tx, id) { return tx.accountId === id || (tx.type === 'transfer' && tx.toAccountId === id); }
export function txDelta(tx, id) {
  if (tx.type === 'expense') return tx.accountId === id ? -tx.amount : 0;
  if (tx.type === 'income') return tx.accountId === id ? tx.amount : 0;
  if (tx.type === 'transfer') return (tx.accountId === id ? -tx.amount : 0) + (tx.toAccountId === id ? tx.amount : 0);
  return 0;
}
// Остаток = зафиксированный остаток («якорь») + всё, что было после него.
// Поэтому импорт старых выписок не ломает текущий баланс.
export function accountBalance(S, a) {
  const an = a.anchor || { amount: 0, date: '2000-01-01', ts: 0 };
  let b = an.amount;
  for (const tx of S.transactions) {
    if (!affects(tx, a.id)) continue;
    if (tx.date < an.date) continue;
    if (tx.date === an.date && ((tx.created || 0) <= an.ts || tx.source === 'kaspi')) continue;
    b += txDelta(tx, a.id);
  }
  return b;
}
export const totalBalance = S => U.sum(S.accounts.filter(a => !a.hidden), a => accountBalance(S, a));
export function setBalance(S, id, amount, date = U.today()) {
  const a = acc(S, id);
  if (a) a.anchor = { amount, date, ts: date === U.today() ? Date.now() : 0 };
}

// ---------- Статистика ----------
export function txSplit(S, tx) {
  if (tx.items?.length && tx.items.some(i => i.categoryId)) {
    const total = U.sum(tx.items, i => i.sum) || 1;
    const k = tx.amount / total, out = {};
    for (const it of tx.items) { const c = it.categoryId || tx.categoryId; out[c] = (out[c] || 0) + (it.sum || 0) * k; }
    return out;
  }
  return { [tx.categoryId]: tx.amount };
}

// Статистика за любой период (from..to включительно, даты YYYY-MM-DD)
export function rangeStats(S, from, to) {
  const r = { from, to, income: 0, spending: 0, savings: 0, byCat: {}, incByCat: {}, groups: { need: 0, want: 0, save: 0 }, count: 0, byDay: {}, byAcc: {}, top: [], txs: [] };
  for (const tx of S.transactions) {
    if (tx.date < from || tx.date > to || tx.type === 'transfer') continue;
    const c = cat(S, tx.categoryId);
    if (c?.excluded) continue;
    r.txs.push(tx);
    if (tx.type === 'income') { r.income += tx.amount; r.incByCat[tx.categoryId] = (r.incByCat[tx.categoryId] || 0) + tx.amount; continue; }
    r.count++;
    let spent = 0;
    for (const [cid, v] of Object.entries(txSplit(S, tx))) {
      const cc = cat(S, cid) || c;
      const g = cc?.group || 'want';
      if (cc?.excluded) continue;
      if (g === 'save') { r.savings += v; r.groups.save += v; continue; }
      r.spending += v; spent += v;
      r.groups[g === 'need' ? 'need' : 'want'] += v;
      r.byCat[cid] = (r.byCat[cid] || 0) + v;
    }
    if (spent) {
      r.byDay[tx.date] = (r.byDay[tx.date] || 0) + spent;
      r.byAcc[tx.accountId] = (r.byAcc[tx.accountId] || 0) + spent;
    }
  }
  r.top = r.txs.filter(t => t.type === 'expense' && cat(S, t.categoryId)?.group !== 'save').sort((a, b) => b.amount - a.amount).slice(0, 5);
  return r;
}
export const monthStats = (S, ym) => ({ ...rangeStats(S, ym + '-01', ym + '-31'), ym });

// ---------- Периоды для отчётов ----------
export function period(kind, date) {
  if (kind === 'day') return { kind, from: date, to: date, days: 1, prev: U.addDays(date, -1), next: U.addDays(date, 1), label: U.fmtDateRel(date) };
  if (kind === 'week') {
    const dow = (U.parseYmd(date).getDay() + 6) % 7;
    const from = U.addDays(date, -dow), to = U.addDays(from, 6);
    const f = U.parseYmd(from), t = U.parseYmd(to);
    const label = f.getMonth() === t.getMonth() ? `${f.getDate()}–${t.getDate()} ${U.MONTHS_GEN[t.getMonth()]}` : `${f.getDate()} ${U.MONTHS_SHORT[f.getMonth()]} – ${t.getDate()} ${U.MONTHS_SHORT[t.getMonth()]}`;
    return { kind, from, to, days: 7, prev: U.addDays(from, -7), next: U.addDays(from, 7), label };
  }
  const ym = date.slice(0, 7), to = U.dayInYm(ym, 31);
  return { kind: 'month', from: ym + '-01', to, days: +to.slice(8), prev: U.addMonthsYm(ym, -1) + '-01', next: U.addMonthsYm(ym, 1) + '-01', label: U.fmtMonth(ym) };
}

const pct = (a, b) => b > 0 ? Math.round((a / b - 1) * 100) : null;

// Отчёт: цифры текущего и прошлого периода + выводы простыми словами
export function report(S, kind, date) {
  const p = period(kind, date);
  const st = rangeStats(S, p.from, p.to);
  const pp = period(kind, p.prev);
  const prev = rangeStats(S, pp.from, pp.to);
  const t = U.today();
  const current = t >= p.from && t <= p.to;
  const elapsed = current ? U.daysBetween(p.from, t) + 1 : p.days;
  const withPrev = { day: 'вчерашним днём', week: 'прошлой неделей', month: 'прошлым месяцем' }[kind];
  // сравниваем, только если в прошлом периоде достаточно данных (иначе выйдут «+3000%»)
  const change = prev.count >= (kind === 'day' ? 1 : 3) ? pct(st.spending, prev.spending) : null;
  const ins = [];

  if (!st.count && !st.income) {
    ins.push('За этот период операций нет.');
  } else {
    if (change != null && prev.spending > 0 && !(current && kind !== 'day')) {
      if (change >= 15) {
        const growth = Object.entries(st.byCat).map(([c, v]) => [c, v - (prev.byCat[c] || 0)]).sort((a, b) => b[1] - a[1])[0];
        ins.push(`Траты ${change >= 100 ? `выросли в ${(st.spending / prev.spending).toFixed(1).replace('.0', '').replace('.', ',')} раза` : `выросли на ${change}%`} по сравнению с ${withPrev}${growth && growth[1] > 0 ? ` — больше всего из-за «${catName(S, growth[0])}» (+${U.money(growth[1])})` : ''}.`);
      } else if (change <= -10) ins.push(`Молодец: потрачено на ${-change}% меньше, чем ${kind === 'day' ? 'вчера' : 'в ' + (kind === 'week' ? 'прошлую неделю' : 'прошлом месяце')} — экономия ${U.money(prev.spending - st.spending)}.`);
      else ins.push(`Траты примерно на уровне ${kind === 'day' ? 'вчерашних' : kind === 'week' ? 'прошлой недели' : 'прошлого месяца'}.`);
    }
    const topCat = Object.entries(st.byCat).sort((a, b) => b[1] - a[1])[0];
    if (topCat && st.spending > 0) ins.push(`Больше всего ушло на «${catName(S, topCat[0])}»: ${U.money(topCat[1])} (${Math.round(topCat[1] / st.spending * 100)}% трат).`);
    if (kind !== 'day') {
      const daysWith = Object.keys(st.byDay).length;
      const zero = elapsed - daysWith;
      if (zero > 0) ins.push(`Дней без трат: ${zero} из ${elapsed}.`);
      const maxDay = Object.entries(st.byDay).sort((a, b) => b[1] - a[1])[0];
      if (maxDay && daysWith > 1) ins.push(`Самый затратный день — ${U.fmtDate(maxDay[0])}: ${U.money(maxDay[1])}.`);
      const cafeN = st.txs.filter(x => x.categoryId === 'cafe').length;
      if (cafeN >= 3) ins.push(`Кафе и доставка: ${cafeN} ${U.plural(cafeN, 'раз', 'раза', 'раз')} на ${U.money(st.byCat.cafe || 0)}.`);
    }
    if (current && kind !== 'day' && elapsed < p.days && st.spending > 0) {
      const forecast = st.spending / elapsed * p.days;
      ins.push(`Прогноз до конца ${kind === 'week' ? 'недели' : 'месяца'}: около ${U.money(forecast)}${prev.spending ? ` (${kind === 'week' ? 'прошлая неделя' : 'прошлый месяц'} — ${U.money(prev.spending)})` : ''}.`);
    }
    if (st.income > 0) {
      const left = st.income - st.spending - st.savings;
      ins.push(left >= 0 ? `Остаток периода: +${U.money(left)}, отложено ${Math.round(st.savings / st.income * 100)}% дохода.` : `Потрачено больше, чем пришло, на ${U.money(-left)}.`);
    }
  }

  // Дневной лимит (только для отчёта за сегодня)
  let limit = null;
  if (kind === 'day' && p.from === t) {
    const s = safeToSpend(S);
    const spentToday = st.spending;
    limit = { limit: (s.bal + spentToday - s.due - s.goals) / s.days, spent: spentToday };
    limit.left = limit.limit - spentToday;
  }

  // Платежи из календаря за период
  const occ = occurrencesBetween(S, p.from, p.to).filter(o => o.ev.type === 'expense');
  const pays = { total: U.sum(occ, o => o.ev.amount), paid: U.sum(occ.filter(o => o.paidTx), o => o.ev.amount), open: occ.filter(isOpen), count: occ.length };

  return { p, st, prev, change, current, elapsed, insights: ins, limit, pays, avgDay: st.spending / elapsed };
}

export function reportText(S, r) {
  const kindName = { day: 'день', week: 'неделю', month: 'месяц' }[r.p.kind];
  const L = [`📊 Отчёт за ${kindName}: ${r.p.label}`];
  L.push(`Расход: ${U.money(r.st.spending)}${r.change != null ? ` (${r.change > 0 ? '+' : ''}${r.change}% к прошлому периоду)` : ''}`);
  if (r.st.income) L.push(`Доход: +${U.money(r.st.income)}`);
  if (r.st.savings) L.push(`Отложено: ${U.money(r.st.savings)}`);
  const cats = Object.entries(r.st.byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (cats.length) { L.push('', 'По категориям:'); for (const [c, v] of cats) L.push(`• ${catName(S, c)} — ${U.money(v)}`); }
  if (r.st.top.length && r.p.kind !== 'day') { L.push('', 'Крупные траты:'); for (const x of r.st.top) L.push(`• ${x.note || x.merchant || catName(S, x.categoryId)} — ${U.money(x.amount)} (${U.fmtDate(x.date)})`); }
  if (r.insights.length) { L.push('', ...r.insights.map(s => '— ' + s)); }
  return L.join('\n');
}

// Среднее за последние n полных месяцев, где были данные
export function avgMonthly(S, n = 3) {
  const ym = U.curYm();
  const months = [];
  for (let i = 1; i <= 12 && months.length < n; i++) {
    const st = monthStats(S, U.addMonthsYm(ym, -i));
    if (st.count || st.income) months.push(st);
  }
  if (!months.length) return null;
  const k = months.length, byCat = {};
  for (const m of months) for (const [c, v] of Object.entries(m.byCat)) byCat[c] = (byCat[c] || 0) + v / k;
  return {
    months: k,
    income: U.sum(months, m => m.income) / k,
    spending: U.sum(months, m => m.spending) / k,
    savings: U.sum(months, m => m.savings) / k,
    need: U.sum(months, m => m.groups.need) / k,
    want: U.sum(months, m => m.groups.want) / k,
    byCat,
  };
}

export function hoursOfWork(S, amount) {
  const inc = S.settings.monthlyIncome || avgMonthly(S)?.income;
  if (!inc || inc < 10000) return null;
  return amount / (inc / 176);
}

// ---------- Календарь ----------
// ev: {id,title,amount,type,categoryId,accountId,date,recurring,months,endYm,paid:{ym:txId},skipped:{ym:true}}
export function eventOcc(ev, ym) {
  const start = ev.date.slice(0, 7);
  const diff = U.ymDiff(start, ym);
  if (diff < 0) return null;
  if (!ev.recurring && diff !== 0) return null;
  if (ev.recurring && ev.months && diff >= ev.months) return null;
  if (ev.endYm && ym > ev.endYm) return null;
  return {
    ev, ym, date: U.dayInYm(ym, +ev.date.slice(8, 10)),
    paidTx: ev.paid?.[ym] || null, skipped: !!ev.skipped?.[ym], index: diff + 1,
  };
}
export function occurrencesBetween(S, from, to) {
  const out = [];
  let ym = from.slice(0, 7);
  const end = to.slice(0, 7);
  while (ym <= end) {
    for (const ev of S.events) { const o = eventOcc(ev, ym); if (o && o.date >= from && o.date <= to) out.push(o); }
    ym = U.addMonthsYm(ym, 1);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.ev.type === 'income' ? -1 : 1));
}
export const monthOccurrences = (S, ym) => occurrencesBetween(S, ym + '-01', U.dayInYm(ym, 31));
export const isOpen = o => !o.paidTx && !o.skipped;
export const upcoming = (S, days = 7) => occurrencesBetween(S, U.today(), U.addDays(U.today(), days)).filter(isOpen);
export const overdue = S => occurrencesBetween(S, U.addDays(U.today(), -92), U.addDays(U.today(), -1)).filter(isOpen);

export function recurrenceText(ev) {
  const day = +ev.date.slice(8, 10);
  if (!ev.recurring) return `разово, ${U.fmtDate(ev.date)}`;
  let s = `каждый месяц, ${day}-го`;
  if (ev.months) s += `, ${ev.months} ${U.plural(ev.months, 'раз', 'раза', 'раз')} (до ${U.fmtMonthGen(U.addMonthsYm(ev.date.slice(0, 7), ev.months - 1))})`;
  if (ev.endYm) s += `, до ${U.fmtMonthGen(ev.endYm)}`;
  return s;
}

export function nextIncome(S) {
  const t = U.today();
  const occ = occurrencesBetween(S, t, U.addDays(t, 62)).filter(o => o.ev.type === 'income' && isOpen(o));
  if (occ.length) return occ[0].date;
  const pd = S.settings.payday;
  if (pd) {
    let ym = U.curYm(), d = U.dayInYm(ym, pd);
    if (d <= t) d = U.dayInYm(U.addMonthsYm(ym, 1), pd);
    return d;
  }
  return U.addMonthsYm(U.curYm(), 1) + '-01';
}

export function goalPlan(g) {
  const remaining = Math.max(0, (g.target || 0) - (g.saved || 0));
  const done = remaining <= 0;
  const r = { remaining, done, progress: g.target ? U.clamp((g.saved || 0) / g.target, 0, 1) : 0 };
  if (done) return r;
  if (g.deadline) {
    const daysLeft = U.daysBetween(U.today(), g.deadline);
    r.daysLeft = daysLeft; r.late = daysLeft < 0;
    const d = Math.max(1, daysLeft);
    r.perMonth = remaining / Math.max(1, d / 30.44);
    r.perWeek = remaining / Math.max(1, d / 7);
    r.perDay = remaining / d;
  }
  if (g.monthly > 0) {
    r.months = Math.ceil(remaining / g.monthly);
    r.etaYm = U.addMonthsYm(U.curYm(), r.months);
    if (!r.perMonth) r.perMonth = g.monthly;
  }
  return r;
}

export function safeToSpend(S) {
  const t = U.today();
  const until = nextIncome(S);
  const days = Math.max(1, U.daysBetween(t, until));
  const due = U.sum([...overdue(S), ...occurrencesBetween(S, t, U.addDays(until, -1))]
    .filter(o => o.ev.type === 'expense' && isOpen(o)), o => o.ev.amount);
  const goals = Math.round(U.sum(S.goals.filter(g => !goalPlan(g).done), g => goalPlan(g).perMonth || 0) * Math.min(1, days / 30));
  const bal = totalBalance(S);
  return { perDay: (bal - due - goals) / days, until, days, due, goals, bal };
}

// Поиск регулярных платежей в истории (подписки, связь, аренда переводом и т.п.)
export function detectRecurring(S) {
  const since = U.addMonthsYm(U.curYm(), -4);
  const groups = {};
  for (const tx of S.transactions) {
    if (tx.type !== 'expense' || tx.date.slice(0, 7) < since || tx.eventId) continue;
    const key = normalizeMerchant(tx.merchant || tx.note);
    if (!key || key.length < 3) continue;
    (groups[key] ||= []).push(tx);
  }
  const evKeys = S.events.map(e => normalizeMerchant(e.title));
  const out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (S.dismissed['rec:' + key]) continue;
    const months = new Set(list.map(t => t.date.slice(0, 7)));
    if (months.size < 2 || list.length > months.size * 1.5) continue;
    const med = U.median(list.map(t => t.amount));
    if (med < 500 || !list.every(t => Math.abs(t.amount - med) <= med * 0.15)) continue;
    const days = list.map(t => +t.date.slice(8, 10));
    const md = U.median(days);
    if (days.some(d => Math.abs(d - md) > 6)) continue;
    if (evKeys.some(k => k && (k.includes(key) || key.includes(k)))) continue;
    const cats = {};
    for (const t of list) cats[t.categoryId] = (cats[t.categoryId] || 0) + 1;
    const categoryId = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
    out.push({ key, title: U.cap(list[list.length - 1].note || list[list.length - 1].merchant || key), amount: Math.round(med), day: Math.round(md), categoryId, accountId: list[list.length - 1].accountId, months: months.size });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

// ---------- Кредиты ----------
// strategy: 'none' — только минимальные платежи; 'avalanche' — сначала самая высокая ставка; 'snowball' — сначала самый маленький долг
export function simulateDebts(debts, extra = 0, strategy = 'avalanche') {
  const ds = debts.filter(d => d.balance > 0).map(d => ({ id: d.id, name: d.name, bal: +d.balance, rate: +d.rate || 0, min: +d.minPayment || 0, month: null, interest: 0 }));
  if (!ds.length) return { months: 0, interest: 0, order: [], stuck: false };
  const budget = U.sum(ds, d => d.min) + (strategy === 'none' ? 0 : extra);
  let month = 0, interest = 0;
  while (ds.some(d => d.bal > 0.5) && month < 600) {
    month++;
    const active = ds.filter(d => d.bal > 0.5);
    for (const d of active) { const i = d.bal * d.rate / 1200; d.bal += i; d.interest += i; interest += i; }
    let avail = budget;
    for (const d of active) { const p = Math.min(d.min, d.bal); d.bal -= p; avail -= p; }
    if (strategy !== 'none') {
      const order = ds.filter(d => d.bal > 0.5).sort(strategy === 'avalanche' ? (a, b) => b.rate - a.rate || a.bal - b.bal : (a, b) => a.bal - b.bal || b.rate - a.rate);
      for (const d of order) { if (avail <= 0) break; const p = Math.min(avail, d.bal); d.bal -= p; avail -= p; }
    }
    for (const d of ds) if (d.bal <= 0.5 && d.month == null) d.month = month;
  }
  return {
    months: month, interest, stuck: month >= 600,
    order: [...ds].sort((a, b) => (a.month ?? 999) - (b.month ?? 999)).map(d => ({ id: d.id, name: d.name, month: d.month, interest: d.interest })),
  };
}
export const debtMonths = d => simulateDebts([d], 0, 'none').months;

// ---------- Советы ----------
export function tips(S) {
  const out = [];
  const ym = U.curYm();
  const st = monthStats(S, ym);
  const avg = avgMonthly(S, 3);
  const dayOfMonth = +U.today().slice(8, 10);
  const bal = totalBalance(S);

  if (st.income > 0 && st.spending > st.income) {
    out.push({ lvl: 'bad', icon: '⚠️', title: 'Расходы больше доходов', text: `В этом месяце потрачено ${U.money(st.spending)} при доходе ${U.money(st.income)}. Посмотри, что можно отложить до следующего месяца.` });
  }

  const due30 = U.sum(upcoming(S, 30).filter(o => o.ev.type === 'expense'), o => o.ev.amount) + U.sum(overdue(S).filter(o => o.ev.type === 'expense'), o => o.ev.amount);
  const inc30 = U.sum(upcoming(S, 30).filter(o => o.ev.type === 'income'), o => o.ev.amount);
  if (due30 > bal + inc30 && due30 > 0) {
    out.push({ lvl: 'bad', icon: '📅', title: 'Не хватает на платежи', text: `В ближайшие 30 дней платежей на ${U.money(due30)}, а денег с учётом поступлений — ${U.money(bal + inc30)}. Начни с самых важных: кредиты и коммуналка.` });
  }

  const sts = safeToSpend(S);
  if (S.transactions.length && sts.perDay < 0) {
    out.push({ lvl: 'bad', icon: '🧯', title: 'До зарплаты в минусе', text: `После обязательных платежей не хватает ${U.money(-sts.perDay * sts.days)}. Сократи необязательные траты до ${U.fmtDate(sts.until)}.` });
  }

  const overdueList = overdue(S).filter(o => o.ev.type === 'expense');
  if (overdueList.length) {
    out.push({ lvl: 'warn', icon: '⏰', title: `Просрочено платежей: ${overdueList.length}`, text: overdueList.slice(0, 3).map(o => `${o.ev.title} (${U.fmtDate(o.date)})`).join(', ') + '. Если уже оплатил — отметь в календаре.' });
  }

  if (avg) {
    for (const [cid, v] of Object.entries(st.byCat)) {
      const a = avg.byCat[cid] || 0;
      if (a > 5000 && v > a * 1.3) {
        const c = cat(S, cid);
        out.push({ lvl: 'warn', icon: c?.icon || '📈', title: `${c?.name || 'Категория'}: больше обычного`, text: `Уже ${U.money(v)} — на ${Math.round((v / a - 1) * 100)}% больше, чем в среднем за месяц (${U.money(a)}).` });
      }
    }
    if (avg.income > 0) {
      const wantPct = avg.want / avg.income * 100, savePct = avg.savings / avg.income * 100, needPct = avg.need / avg.income * 100;
      if (wantPct > 35) out.push({ lvl: 'warn', icon: '🛍️', title: 'Много трат «на желания»', text: `В среднем ${Math.round(wantPct)}% дохода уходит на необязательное (ориентир — до 30%). Минус 10% здесь — это ${U.money(avg.want * 0.1)} в месяц на цели.` });
      if (needPct > 60) out.push({ lvl: 'info', icon: '🏠', title: 'Обязательные траты съедают бюджет', text: `${Math.round(needPct)}% дохода — обязательные расходы (ориентир — 50%). Проверь тарифы связи, подписки, рефинансирование кредитов.` });
      if (savePct < 10) out.push({ lvl: 'info', icon: '🐷', title: 'Откладывай хотя бы 10%', text: `Сейчас откладывается ${Math.round(savePct)}% дохода. 10% — это ${U.money(avg.income * 0.1)} в месяц. Лучше переводить в день зарплаты, а не «что останется».` });
    }
    const cafe = avg.byCat.cafe || 0;
    if (avg.income > 0 && cafe > avg.income * 0.12) out.push({ lvl: 'info', icon: '🍔', title: 'Кафе и доставка', text: `${U.money(cafe)} в месяц, это ${U.money(cafe * 12)} в год. Если готовить дома хотя бы половину раз — сэкономишь около ${U.money(cafe * 6)} за год.` });
  }

  const fund = S.goals.find(g => /подушк|резерв|запас|на черный/i.test(g.name));
  const spend = avg?.spending || st.spending;
  if (!fund && spend > 0) {
    out.push({ lvl: 'info', icon: '🛟', title: 'Заведи подушку безопасности', text: `Запас на 3–6 месяцев жизни: ${U.money(spend * 3)}–${U.money(spend * 6)}. Спасает от новых кредитов, если что-то случится.`, action: { label: 'Создать цель', a: 'goal-fund' } });
  }

  const recurring = detectRecurring(S);
  const subsEvents = S.events.filter(e => e.recurring && e.categoryId === 'subs' && e.type === 'expense');
  const subsSum = U.sum(subsEvents, e => e.amount) + U.sum(recurring.filter(r => r.categoryId === 'subs'), r => r.amount);
  if (subsSum > 0) out.push({ lvl: 'info', icon: '🔁', title: 'Подписки', text: `${U.money(subsSum)} в месяц = ${U.money(subsSum * 12)} в год. Отмени те, которыми не пользовался последний месяц.` });

  const paidDebts = S.debts.filter(d => d.balance > 0);
  if (paidDebts.length && paidDebts.some(d => d.rate > 0)) {
    const minSum = U.sum(paidDebts, d => d.minPayment);
    const extra = Math.max(5000, Math.round(minSum * 0.1 / 1000) * 1000);
    const base = simulateDebts(paidDebts, 0, 'none'), av = simulateDebts(paidDebts, extra, 'avalanche');
    if (!base.stuck && base.interest - av.interest > 1000) {
      out.push({ lvl: 'info', icon: '🏦', title: 'Как быстрее закрыть кредиты', text: `+${U.money(extra)} в месяц к платежам по методу «лавина» — кредиты закроются на ${base.months - av.months} мес. раньше, переплата меньше на ${U.money(base.interest - av.interest)}.`, action: { label: 'Открыть план', a: 'go', to: 'debts' } });
    }
    if (base.stuck) out.push({ lvl: 'bad', icon: '🚨', title: 'Долг не уменьшается', text: 'Минимальный платёж меньше начисляемых процентов — долг растёт. Нужно платить больше или рефинансировать.' });
  }

  if (dayOfMonth >= 25 && st.income > st.spending + st.savings && st.income > 0) {
    const left = st.income - st.spending - st.savings;
    out.push({ lvl: 'good', icon: '🎉', title: 'Месяц в плюсе', text: `Осталось ${U.money(left)}. Переведи часть на цель или досрочно в кредит — так деньги не «растворятся».` });
  }

  if (!out.length) out.push({ lvl: 'good', icon: '✅', title: 'Всё под контролем', text: 'Тревожных сигналов нет. Продолжай вносить траты — чем больше данных, тем точнее советы.' });
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

// ---------- Цены из чеков ----------
export function priceIndex(S) {
  const map = {};
  for (const tx of S.transactions) {
    if (!tx.items?.length) continue;
    for (const it of tx.items) {
      const key = String(it.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key) continue;
      const unit = it.price || (it.qty ? it.sum / it.qty : it.sum);
      (map[key] ||= { name: it.name, entries: [] }).entries.push({ date: tx.date, price: unit, store: tx.merchant || tx.note || '', qty: it.qty, sum: it.sum });
    }
  }
  return Object.values(map).map(x => {
    x.entries.sort((a, b) => a.date.localeCompare(b.date));
    const prices = x.entries.map(e => e.price).filter(p => p > 0);
    const last = x.entries[x.entries.length - 1];
    return { ...x, count: x.entries.length, last, min: Math.min(...prices), max: Math.max(...prices), avg: U.sum(prices) / (prices.length || 1), first: x.entries[0] };
  }).sort((a, b) => b.count - a.count || b.last.date.localeCompare(a.last.date));
}
