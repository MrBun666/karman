// Импорт из Kaspi: PDF-выписка и текст уведомлений
import * as U from './util.js';
import * as F from './finance.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsP = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsP) {
    pdfjsP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => { pdfjsP = null; rej(new Error('Не удалось загрузить модуль чтения PDF. При первом импорте нужен интернет.')); };
      document.head.append(s);
    });
  }
  return pdfjsP;
}

// Достаём текст PDF построчно (склеиваем кусочки с одинаковой высотой)
export async function pdfLines(file) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim());
  }
  return lines;
}

const toYmd = s => { const [d, m, y] = s.split('.'); return `${y.length === 2 ? '20' + y : y}-${m}-${d}`; };
const OPS = ['Покупки', 'Покупка', 'Пополнения', 'Пополнение', 'Переводы', 'Перевод', 'Снятия', 'Снятие', 'Платежи', 'Платеж', 'Платёж', 'Разное', 'Возврат', 'Оплата', 'Погашение'];
// Строка выписки Kaspi Gold: «21.11.26 - 2 500,00 ₸ Покупка Magnum»
const ROW = /^(\d{2}\.\d{2}\.\d{2,4})\s+([+\-−–])\s*([\d\s ]*\d[.,]\d{2})\s*₸?\s*(.*)$/;

export function parseKaspiLines(lines) {
  const rows = [];
  let balance = null;
  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').trim();
    const b = line.match(/Доступно на\s*(\d{2}\.\d{2}\.\d{2,4})\s*([+\-−]?\s*[\d\s]*\d[.,]\d{2})/i);
    if (b) balance = { date: toYmd(b[1]), amount: U.parseAmount(b[2]) };
    const m = line.match(ROW);
    if (!m) continue;
    const rest = m[4].trim();
    const op = OPS.find(o => rest.toLowerCase().startsWith(o.toLowerCase())) || rest.split(' ')[0] || '';
    rows.push({ date: toYmd(m[1]), sign: m[2] === '+' ? 1 : -1, amount: U.parseAmount(m[3]), op, details: rest.slice(op.length).trim() });
  }
  return { rows, balance };
}

// Превращаем строку выписки в операцию приложения
export function mapRow(S, r, accountId = 'kaspi') {
  const d = r.details || '';
  const low = (r.op + ' ' + d).toLowerCase();
  const tx = {
    id: U.uid(), date: r.date, amount: Math.abs(r.amount), accountId, source: 'kaspi',
    merchant: d || r.op, note: '', op: r.op, created: Date.now(),
    hash: `${r.date}|${r.sign * Math.abs(r.amount)}|${F.normalizeMerchant(d)}`,
  };
  const deposit = /депозит/i.test(d);
  if (/сняти/i.test(r.op) && r.sign < 0 && F.acc(S, 'cash')) {
    tx.type = 'transfer'; tx.toAccountId = 'cash'; tx.categoryId = null; tx.merchant = 'Снятие наличных' + (d ? ' · ' + d : '');
  } else if (r.sign > 0) {
    tx.type = 'income';
    if (deposit) tx.categoryId = 'own_in';
    else if (/возврат|кэшбэк|кешбэк|cashback|бонус/i.test(low)) tx.categoryId = 'cashback';
    else if (F.ruleFor(S, d) && F.cat(S, F.ruleFor(S, d))?.type === 'income') tx.categoryId = F.ruleFor(S, d);
    else if (/перевод/i.test(r.op)) tx.categoryId = F.guessCategory(S, d, 'income') === 'other_inc' ? 'p2p_in' : F.guessCategory(S, d, 'income');
    else tx.categoryId = F.guessCategory(S, low, 'income');
  } else {
    tx.type = 'expense';
    const rule = F.ruleFor(S, d);
    if (rule && F.cat(S, rule)?.type === 'expense') tx.categoryId = rule;
    else if (deposit) tx.categoryId = 'savings';
    else if (/kaspi red|рассрочк|кредит|погашени/i.test(low)) tx.categoryId = 'credit';
    else if (/перевод/i.test(r.op)) tx.categoryId = 'p2p_out';
    else tx.categoryId = F.guessCategory(S, d || low, 'expense');
  }
  return tx;
}

// Помечаем дубли: точное совпадение с уже импортированным или похожая ручная операция
export function markDuplicates(S, txs) {
  const hashes = new Set(S.transactions.map(t => t.hash).filter(Boolean));
  for (const t of txs) {
    if (hashes.has(t.hash)) { t._dup = 'exact'; continue; }
    const near = S.transactions.find(x => x.source !== 'kaspi' && x.type === t.type && x.accountId === t.accountId && Math.abs(x.amount - t.amount) < 1 && Math.abs(U.daysBetween(x.date, t.date)) <= 1);
    if (near) t._dup = 'near';
  }
  return txs;
}

// Текст уведомлений/SMS (можно вставить сразу несколько строк)
export function parsePushText(S, text) {
  const out = [];
  const lines = String(text).split(/\n+/).map(l => l.replace(/ /g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/([+\-−]?\s*\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:₸|тг|kzt|тенге)/i);
    if (!m) continue;
    const amount = Math.abs(U.parseAmount(m[1]));
    if (!(amount > 0)) continue;
    const plus = /^\s*\+/.test(m[1]) || /(пополнени|получил|поступ|зачисл|перевел[аи]? вам|вам перевел|возврат|кэшбэк|зарплат|перевод[^.]{0,40}\sот\s)/i.test(line);
    const opM = line.match(/(Покупк[аи]|Перевод[ы]?|Пополнени[ея]|Снятие|Платеж|Платёж|Оплата|Возврат)/i);
    const op = opM ? U.cap(opM[1].toLowerCase()) : (plus ? 'Пополнение' : 'Покупка');
    let details = line.slice(m.index + m[0].length).replace(/^[\s.,:;—-]+/, '');
    details = details.split(/(Доступно|Баланс|Остаток|Доступный)/i)[0].replace(/[.\s]+$/, '').replace(/^(от|в|на)\s+/i, '').trim();
    if (!details) details = line.slice(0, m.index).replace(opM?.[0] || '', '').replace(/[:\s.,—-]+$/, '').trim();
    const dm = line.match(/(\d{2}\.\d{2}\.\d{2,4})/);
    out.push(mapRow(S, { date: dm ? toYmd(dm[1]) : U.today(), sign: plus ? 1 : -1, amount, op, details }));
  }
  return out;
}

// Уведомление банка, пойманное Android-приложением: {pkg, app, title, text, ts}
const OPERATION_RE = /(покупк|оплат|перевод|перевел|пополнен|сняти|плат[её]ж|списан|зачислен|поступ|возврат|получен|отправлен)/i;
const PROMO_RE = /(скидк|акци|розыгрыш|предлож|одобрен|доступен кредит|лимит до|выиграй|успей|подарок|промокод)/i;
export function parseNotification(S, it) {
  const full = `${it.title || ''}\n${it.text || ''}`;
  if (!OPERATION_RE.test(full) || PROMO_RE.test(full)) return null;
  const line = `${it.title || ''}. ${it.text || ''}`.replace(/\s*\n+\s*/g, ' ');
  const tx = parsePushText(S, line)[0];
  if (!tx) return null;
  if (it.ts) {
    const d = new Date(it.ts);
    tx.date = U.ymd(d);
    tx.time = `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  }
  tx.hash = `${tx.date}|${tx.type === 'income' ? '' : '-'}${tx.amount}|${F.normalizeMerchant(tx.merchant)}`;
  return tx;
}
