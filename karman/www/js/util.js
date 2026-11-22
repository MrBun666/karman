// Общие помощники: даты, деньги, экранирование
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const ymOf = s => s.slice(0, 7);
export const curYm = () => today().slice(0, 7);
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m: 1..12
export const addMonthsYm = (ym, n) => {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
};
export const ymDiff = (a, b) => { // сколько месяцев от a до b
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const dayInYm = (ym, day) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(day, daysInMonth(y, m)))}`; };

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

export const fmtMonth = ym => { const [y, m] = ym.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };
export const fmtMonthGen = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_GEN[m - 1]} ${y}`; };
export const fmtMonthShort = ym => { const [, m] = ym.split('-').map(Number); return MONTHS_SHORT[m - 1]; };
export const fmtDate = s => { const d = parseYmd(s); const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''; return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${y}`; };
export const fmtDateRel = s => {
  const t = today();
  if (s === t) return 'Сегодня';
  if (s === addDays(t, -1)) return 'Вчера';
  if (s === addDays(t, 1)) return 'Завтра';
  return `${fmtDate(s)}, ${WEEKDAYS[parseYmd(s).getDay()].slice(0, 2)}`;
};

const group = v => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const money = (n, { sign = false } = {}) => {
  const v = Math.round(Number(n) || 0);
  const s = group(Math.abs(v));
  const pre = v < 0 ? '−' : (sign && v > 0 ? '+' : '');
  return `${pre}${s} ₸`;
};
export const num = n => group(Math.round(Number(n) || 0));
export const parseAmount = s => {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').replace(/[\s ₸тг]/g, '').replace(/−/g, '-');
  let mult = 1;
  if (/[кk]$/i.test(t)) { mult = 1000; t = t.slice(0, -1); }
  t = t.replace(',', '.');
  const v = parseFloat(t);
  return isNaN(v) ? 0 : Math.round(v * mult * 100) / 100;
};
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sum = (arr, f = x => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const median = arr => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

// Голосовой ввод: «две тысячи пятьсот» → 2500, «полторы тысячи» → 1500, «2 тысячи» → 2000
const NUM_WORDS = {
  ноль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16,
  семнадцать: 17, восемнадцать: 18, девятнадцать: 19, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
  шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200, триста: 300, четыреста: 400,
  пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900, полтора: 1.5, полторы: 1.5,
};
const MULT = { тысяча: 1e3, тысячи: 1e3, тысяч: 1e3, тыщ: 1e3, тыщи: 1e3, миллион: 1e6, миллиона: 1e6, миллионов: 1e6, млн: 1e6 };
export function wordsToNumbers(text) {
  const tokens = String(text).toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  const out = [];
  let total = 0, cur = 0, inNum = false;
  const flush = () => { if (inNum) out.push(String(Math.round(total + cur))); total = 0; cur = 0; inNum = false; };
  for (const tk of tokens) {
    const w = tk.replace(/[.,!?]+$/, '');
    if (/^\d+([.,]\d+)?$/.test(w) && !(inNum && cur)) { cur += parseFloat(w.replace(',', '.')); inNum = true; continue; }
    if (w in NUM_WORDS) { cur += NUM_WORDS[w]; inNum = true; continue; }
    if (w in MULT && inNum) { total += (cur || 1) * MULT[w]; cur = 0; continue; }
    if (w in MULT) { total += MULT[w]; inNum = true; continue; }
    flush();
    out.push(tk);
  }
  flush();
  return out.join(' ');
}
