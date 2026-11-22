// ИИ: бесплатный Google Gemini (по умолчанию) или Claude (если ключ sk-ant-…).
// Запросы идут прямо с телефона, ключ хранится только на телефоне.
import * as U from './util.js';
import * as F from './finance.js';

export const MODELS = [
  { id: 'gemini-3.8-flash', provider: 'gemini', name: 'Gemini 3.8 Flash — самая умная из бесплатных (рекомендую)' },
  { id: 'gemini-3.6-flash', provider: 'gemini', name: 'Gemini 3.6 Flash — бесплатная, запасная' },
  { id: 'gemini-3.5-flash-lite', provider: 'gemini', name: 'Gemini 3.5 Flash-Lite — бесплатная, самая быстрая' },
  { id: 'claude-sonnet-5-5', provider: 'claude', name: 'Claude Sonnet 5.5 — платно, нужен ключ sk-ant-…' },
  { id: 'claude-opus-5-5', provider: 'claude', name: 'Claude Opus 5.5 — платно, самый умный' },
];

export const apiKey = S => String(S.settings.apiKey || self.APP_AI_KEY || '').trim();
export const hasKey = S => !!apiKey(S);
export const hasBuiltInKey = () => !!String(self.APP_AI_KEY || '').trim();
export const provider = S => apiKey(S).startsWith('sk-ant-') ? 'claude' : 'gemini';

// Выбранная модель + запасные того же провайдера (если лимит исчерпан или модель недоступна)
function modelChain(S) {
  const list = MODELS.filter(m => m.provider === provider(S)).map(m => m.id);
  const chosen = list.includes(S.settings.model) ? S.settings.model : list[0];
  return [...new Set([chosen, ...list])];
}

// ---------- Claude ----------
async function claudeCall(S, body) {
  const key = apiKey(S);
  if (!key) throw new Error('NO_KEY');
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: modelChain(S)[0], max_tokens: 2048, ...body }),
    });
  } catch {
    throw new Error('Нет связи с ИИ. Проверь интернет.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error?.message || ''; } catch { /* */ }
    if (res.status === 401) throw new Error('Неверный ключ ИИ. Проверь его в настройках.');
    if (res.status === 429) throw new Error('Слишком много запросов или превышен лимит. Подожди минуту.');
    if (res.status === 400 && /credit|balance|billing/i.test(msg)) throw new Error('На балансе Claude API закончились деньги.');
    if (res.status === 404) throw new Error('Модель не найдена — выбери другую модель в настройках.');
    if (res.status === 529 || res.status >= 500) throw new Error('Сервер ИИ перегружен, попробуй чуть позже.');
    throw new Error(`Ошибка ИИ (${res.status}). ${msg}`);
  }
  return res.json();
}

// ---------- Gemini ----------
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';

function geminiError(code, status, msg) {
  const all = `${status} ${msg}`;
  if (/location|region|country/i.test(msg)) return new Error('Gemini API недоступен в этом регионе.');
  if (code === 400 && /API.?key|API_KEY/i.test(all)) return new Error('Неверный ключ ИИ. Проверь его в настройках.');
  if (code === 401 || code === 403) return new Error('Ключ не подошёл к Gemini API.' + (msg ? ' ' + msg : ''));
  if (code === 429) return new Error('Бесплатный лимит запросов исчерпан. Подожди минуту; дневной лимит обновляется ночью.');
  if (code === 404) return new Error('Модель недоступна — выбери другую в настройках.');
  if (code >= 500) return new Error('Сервер ИИ перегружен, попробуй чуть позже.');
  return new Error(`Ошибка ИИ (${code}). ${msg}`);
}

const cooldown = {};
async function geminiCall(S, body) {
  const key = apiKey(S);
  if (!key) throw new Error('NO_KEY');
  let lastErr = null;
  const chain = modelChain(S);
  const ready = chain.filter(m => !(cooldown[m] > Date.now()));
  for (const model of ready.length ? ready : chain) {
    let res;
    try {
      res = await fetch(GEMINI + model + ':generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('Нет связи с ИИ. Проверь интернет.');
    }
    if (res.ok) { const j = await res.json(); j._model = model; return j; }
    let msg = '', status = '';
    try { const e = (await res.json()).error || {}; msg = e.message || ''; status = e.status || ''; } catch { /* */ }
    const err = geminiError(res.status, status, msg);
    if ([404, 429, 500, 503].includes(res.status)) { // пробуем запасную модель, эту на время пропускаем
      cooldown[model] = Date.now() + (res.status === 404 ? 6 * 3600e3 : 60e3);
      lastErr = err; continue;
    }
    throw err;
  }
  throw lastErr || new Error('ИИ не ответил.');
}

function gCandidate(r) {
  const c = r.candidates?.[0];
  if (!c) throw new Error(r.promptFeedback?.blockReason ? 'ИИ отказался отвечать на этот запрос.' : 'ИИ не ответил.');
  return c;
}
const gParts = r => r.candidates?.[0]?.content?.parts || [];
const gText = parts => parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n').trim();

// Нейтральный формат вложений: {text} | {image:{mime,data}} | {pdf:data}
const toClaude = parts => parts.map(p => p.text != null ? { type: 'text', text: p.text }
  : p.image ? { type: 'image', source: { type: 'base64', media_type: p.image.mime, data: p.image.data } }
  : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.pdf } });
const toGemini = parts => parts.map(p => p.text != null ? { text: p.text }
  : p.image ? { inlineData: { mimeType: p.image.mime, data: p.image.data } }
  : { inlineData: { mimeType: 'application/pdf', data: p.pdf } });

// Ответ строго по схеме — через принудительный вызов функции
async function structured(S, tool, parts, maxTokens) {
  if (provider(S) === 'claude') {
    const r = await claudeCall(S, { max_tokens: Math.min(maxTokens, 16000), tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content: toClaude(parts) }] });
    const tu = r.content?.find(c => c.type === 'tool_use');
    if (!tu) throw new Error('ИИ не смог разобрать данные.');
    return tu.input;
  }
  const r = await geminiCall(S, {
    contents: [{ role: 'user', parts: toGemini(parts) }],
    tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: tool.input_schema }] }],
    toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [tool.name] } },
    generationConfig: { maxOutputTokens: maxTokens },
  });
  gCandidate(r);
  const fc = gParts(r).find(p => p.functionCall)?.functionCall;
  if (!fc) throw new Error('ИИ не смог разобрать данные.');
  return fc.args || {};
}

// Проверка ключа: возвращает название модели, которая ответила
export async function ping(S) {
  if (provider(S) === 'claude') {
    await claudeCall(S, { max_tokens: 10, messages: [{ role: 'user', content: 'Ответь одним словом: работает' }] });
    return modelChain(S)[0];
  }
  const r = await geminiCall(S, { contents: [{ role: 'user', parts: [{ text: 'Ответь одним словом: работает' }] }], generationConfig: { maxOutputTokens: 1024 } });
  gCandidate(r);
  return r._model;
}

// Сжимаем фото, чтобы запрос был быстрым и дешёвым
export async function resizeImage(file, max = 1600) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await createImageBitmap(file); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.85).split(',')[1], media_type: 'image/jpeg' };
}

export async function readReceipt(S, file) {
  const img = await resizeImage(file);
  const names = S.categories.filter(c => c.type === 'expense' && !c.hidden).map(c => c.name);
  const tool = {
    name: 'save_receipt',
    description: 'Сохранить распознанный кассовый чек',
    input_schema: {
      type: 'object',
      properties: {
        readable: { type: 'boolean', description: 'false, если на фото не чек или он нечитаем' },
        store: { type: 'string', description: 'Название магазина' },
        date: { type: 'string', description: 'Дата покупки YYYY-MM-DD' },
        time: { type: 'string', description: 'Время HH:MM' },
        total: { type: 'number', description: 'Итог к оплате, тенге' },
        payment: { type: 'string', enum: ['card', 'cash', 'unknown'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Понятное название товара' },
              qty: { type: 'number' },
              price: { type: 'number', description: 'Цена за единицу' },
              sum: { type: 'number', description: 'Сумма позиции с учётом скидки' },
              category: { type: 'string', enum: names },
            },
            required: ['name', 'sum', 'category'],
          },
        },
      },
      required: ['readable', 'total', 'items'],
    },
  };
  const res = await structured(S, tool, [
    { image: { mime: img.media_type, data: img.data } },
    { text: `Это фото кассового чека (Казахстан, тенге). Сегодня ${U.today()}. Распознай магазин, дату, итог, способ оплаты и все позиции. Если год написан двумя цифрами — это 20XX. Скидки вычти из суммы позиции. Сокращённые названия расшифруй, если уверен. Каждой позиции подбери категорию из списка.` },
  ], 8192);
  if (res.readable === false) throw new Error('Не получилось прочитать чек. Сфотографируй ровнее и при хорошем свете.');
  return res;
}

export async function readStatementPdf(S, file) {
  const data = await U.fileToBase64(file);
  const tool = {
    name: 'save_statement',
    description: 'Сохранить операции из банковской выписки',
    input_schema: {
      type: 'object',
      properties: {
        balance_end: { type: 'number', description: 'Остаток на конец периода, если указан' },
        balance_date: { type: 'string', description: 'Дата остатка YYYY-MM-DD' },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'YYYY-MM-DD' },
              sign: { type: 'string', enum: ['+', '-'] },
              amount: { type: 'number', description: 'Сумма без знака' },
              operation: { type: 'string', description: 'Покупка, Перевод, Пополнение, Снятие, Платеж, Разное' },
              details: { type: 'string', description: 'Магазин, получатель или описание' },
            },
            required: ['date', 'sign', 'amount', 'operation', 'details'],
          },
        },
      },
      required: ['rows'],
    },
  };
  const res = await structured(S, tool, [
    { pdf: data },
    { text: 'Это выписка из банка Kaspi. Извлеки ВСЕ операции из таблицы без пропусков. Год из двух цифр — это 20XX.' },
  ], 32000);
  return {
    rows: (res.rows || []).map(x => ({ date: x.date, sign: x.sign === '+' ? 1 : -1, amount: Math.abs(+x.amount || 0), op: x.operation || '', details: x.details || '' })),
    balance: res.balance_end != null && res.balance_date ? { date: res.balance_date, amount: res.balance_end } : null,
  };
}

// ---------- Чат ----------
const SYSTEM = `Ты — личный финансовый помощник в приложении «${self.APP_NAME || 'Карман'}». Пользователь живёт в Казахстане, валюта — тенге (₸), основной банк — Kaspi. Отвечай по-русски, коротко и по делу, с конкретными цифрами из его данных. Простой язык, без воды. Форматирование: короткие абзацы, списки через «- », важное выделяй **так**.

Правила:
- Опирайся на данные пользователя ниже. Не выдумывай операции. Если данных мало — скажи, что стоит добавить.
- Когда просят что-то добавить (платёж, напоминание, доход, расход, цель, кредит) — сразу используй инструменты, без лишних вопросов. Подставляй разумные значения: ближайшая подходящая дата, счёт по смыслу.
- Регулярные платежи (коммуналка, интернет, связь, аренда, подписки, кредит, рассрочка, зарплата, аванс, садик, спортзал) ставь с recurring=true — это кнопка «на постоянку», платёж повторяется каждый месяц. Для кредита или рассрочки с известным сроком укажи months (сколько платежей осталось). Разовые — recurring=false.
- Если в истории видишь регулярный платёж, которого нет в календаре, — предложи его добавить.
- Кредиты: объясняй «лавину» (сначала самая высокая ставка — меньше переплата) и «снежный ком» (сначала самый маленький долг — быстрее первые победы). Считай сроки и переплату. Напоминай про досрочное погашение и рефинансирование.
- Накопления: считай, сколько откладывать в месяц или неделю, предлагай, на чём сократить, с цифрами из его категорий.
- Не советуй конкретные акции или криптовалюты; про инвестиции — только общие принципы и риски. Предупреждай о мошенниках: никому не сообщать коды из SMS, «служба безопасности банка» не звонит.
- Сумма «2к» = 2000, «1.5 млн» = 1 500 000.`;

export function buildContext(S) {
  const t = U.today(), ym = U.curYm();
  const L = [];
  const r = n => Math.round(n);
  L.push(`Сегодня ${t}, ${U.WEEKDAYS[U.parseYmd(t).getDay()]}.`);
  if (S.settings.name) L.push(`Имя: ${S.settings.name}.`);
  L.push('Счета: ' + S.accounts.map(a => `${a.name} [id=${a.id}] ${r(F.accountBalance(S, a))} ₸`).join('; ') + `. Всего ${r(F.totalBalance(S))} ₸.`);
  const sts = F.safeToSpend(S);
  L.push(`Ближайшее поступление: ${sts.until} (через ${sts.days} дн.). Обязательных платежей до него: ${r(sts.due)} ₸. Можно тратить в день: ${r(sts.perDay)} ₸.`);
  const st = F.monthStats(S, ym);
  const top = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, v]) => `${F.catName(S, c)} ${r(v)}`).join(', ');
  L.push(`Текущий месяц (${ym}): доход ${r(st.income)}, расходы ${r(st.spending)}, накопления ${r(st.savings)}. По категориям: ${top || 'нет данных'}.`);
  const hist = [1, 2, 3].map(i => { const m = U.addMonthsYm(ym, -i); const s = F.monthStats(S, m); return `${m}: доход ${r(s.income)}, расходы ${r(s.spending)}, накопления ${r(s.savings)}`; });
  L.push('Прошлые месяцы: ' + hist.join('; ') + '.');
  const avg = F.avgMonthly(S, 3);
  if (avg) L.push(`Средние расходы по категориям в месяц: ` + Object.entries(avg.byCat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => `${F.catName(S, c)} ${r(v)}`).join(', ') + '.');
  if (S.events.length) {
    L.push('Календарь платежей:');
    for (const e of S.events.slice(0, 60)) L.push(`- ${e.title}: ${r(e.amount)} ₸, ${e.type === 'income' ? 'поступление' : 'платёж'}, ${F.recurrenceText(e)}, категория ${F.catName(S, e.categoryId)}`);
  }
  const up = F.occurrencesBetween(S, U.addDays(t, -30), U.addDays(t, 45)).filter(F.isOpen);
  if (up.length) L.push('Неоплаченные ближайшие: ' + up.map(o => `${o.date} ${o.ev.title} ${r(o.ev.amount)}`).join('; ') + '.');
  if (S.goals.length) L.push('Цели: ' + S.goals.map(g => { const p = F.goalPlan(g); return `${g.name}: накоплено ${r(g.saved)} из ${r(g.target)}${g.deadline ? `, срок ${g.deadline}, нужно ${r(p.perMonth || 0)}/мес` : ''}`; }).join('; ') + '.');
  if (S.debts.length) L.push('Кредиты: ' + S.debts.map(d => `${d.name}: остаток ${r(d.balance)}, ставка ${d.rate}% годовых, платёж ${r(d.minPayment)}/мес`).join('; ') + '.');
  const rec = F.detectRecurring(S);
  if (rec.length) L.push('Похоже на регулярные, но нет в календаре: ' + rec.map(x => `${x.title} ~${x.amount} ₸ около ${x.day}-го`).join('; ') + '.');
  L.push(`Операций всего: ${S.transactions.length}.`);
  return L.join('\n');
}

function tools(S) {
  const exp = S.categories.filter(c => c.type === 'expense').map(c => c.name);
  const inc = S.categories.filter(c => c.type === 'income').map(c => c.name);
  const cats = [...new Set([...exp, ...inc])];
  const accs = S.accounts.map(a => a.id);
  return [
    {
      name: 'add_calendar_event',
      description: 'Добавить платёж или поступление в календарь. Регулярные — recurring=true (повтор каждый месяц), разовые — recurring=false.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          amount: { type: 'number' },
          type: { type: 'string', enum: ['expense', 'income'] },
          date: { type: 'string', description: 'Дата ближайшего платежа YYYY-MM-DD; день месяца станет днём повторения' },
          recurring: { type: 'boolean', description: 'true = «на постоянку», каждый месяц' },
          months: { type: 'integer', description: 'Сколько раз всего (кредит/рассрочка). Не указывай, если бессрочно.' },
          category: { type: 'string', enum: cats },
          account: { type: 'string', enum: accs },
        },
        required: ['title', 'amount', 'type', 'date', 'recurring'],
      },
    },
    {
      name: 'add_transaction',
      description: 'Записать уже совершённый расход или доход.',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['expense', 'income'] },
          amount: { type: 'number' },
          category: { type: 'string', enum: cats },
          account: { type: 'string', enum: accs },
          date: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' },
          note: { type: 'string' },
        },
        required: ['type', 'amount', 'category'],
      },
    },
    {
      name: 'add_goal',
      description: 'Создать цель накопления.',
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string' }, target: { type: 'number' }, saved: { type: 'number' }, deadline: { type: 'string', description: 'YYYY-MM-DD' }, monthly: { type: 'number', description: 'Сколько откладывать в месяц' } },
        required: ['name', 'target'],
      },
    },
    {
      name: 'add_debt',
      description: 'Добавить кредит/рассрочку/долг для плана погашения.',
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string' }, balance: { type: 'number' }, rate: { type: 'number', description: '% годовых (0 для рассрочки)' }, minPayment: { type: 'number' }, payDay: { type: 'integer', description: 'День платежа' } },
        required: ['name', 'balance', 'rate', 'minPayment'],
      },
    },
    {
      name: 'find_transactions',
      description: 'Найти операции пользователя для подробного анализа.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Текст для поиска в описании' }, from: { type: 'string' }, to: { type: 'string' }, category: { type: 'string' }, type: { type: 'string', enum: ['expense', 'income', 'transfer'] }, limit: { type: 'integer' } },
      },
    },
  ];
}

function resolveCat(S, name, type) {
  return F.catByName(S, name, type)?.id || (type === 'income' ? 'other_inc' : 'other_exp');
}

// Выполнение действий ИИ. Возвращает текст для ИИ и действие (для кнопки «Отменить»)
export function execTool(S, name, a) {
  const r = n => Math.round(n);
  if (name === 'add_calendar_event') {
    const ev = {
      id: U.uid(), title: a.title, amount: Math.abs(+a.amount || 0), type: a.type === 'income' ? 'income' : 'expense',
      categoryId: resolveCat(S, a.category || a.title, a.type), accountId: F.acc(S, a.account) ? a.account : 'kaspi',
      date: /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : U.today(), recurring: !!a.recurring,
      months: a.recurring && a.months > 0 ? Math.round(a.months) : null, paid: {}, skipped: {}, note: '', created: Date.now(), by: 'ai',
    };
    if (!a.category) ev.categoryId = F.guessCategory(S, a.title, ev.type);
    S.events.push(ev);
    return { result: `Добавлено: ${ev.title}, ${r(ev.amount)} ₸, ${F.recurrenceText(ev)}.`, action: { kind: 'event', id: ev.id, label: `📅 ${ev.title} · ${U.money(ev.amount)} · ${F.recurrenceText(ev)}` } };
  }
  if (name === 'add_transaction') {
    const type = a.type === 'income' ? 'income' : 'expense';
    const tx = {
      id: U.uid(), type, amount: Math.abs(+a.amount || 0), categoryId: resolveCat(S, a.category, type),
      accountId: F.acc(S, a.account) ? a.account : S.settings.defaultAccount, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : U.today(),
      note: a.note || '', source: 'ai', created: Date.now(),
    };
    S.transactions.push(tx);
    return { result: `Записано: ${type === 'income' ? 'доход' : 'расход'} ${r(tx.amount)} ₸, ${F.catName(S, tx.categoryId)}, ${tx.date}.`, action: { kind: 'tx', id: tx.id, label: `${type === 'income' ? '➕' : '➖'} ${tx.note || F.catName(S, tx.categoryId)} · ${U.money(tx.amount)} · ${U.fmtDate(tx.date)}` } };
  }
  if (name === 'add_goal') {
    const g = { id: U.uid(), name: a.name, target: +a.target || 0, saved: +a.saved || 0, deadline: a.deadline || null, monthly: +a.monthly || null, icon: '🎯', history: [], created: Date.now() };
    S.goals.push(g);
    return { result: `Цель создана: ${g.name} на ${r(g.target)} ₸.`, action: { kind: 'goal', id: g.id, label: `🎯 ${g.name} · ${U.money(g.target)}` } };
  }
  if (name === 'add_debt') {
    const d = { id: U.uid(), name: a.name, balance: +a.balance || 0, rate: +a.rate || 0, minPayment: +a.minPayment || 0, payDay: a.payDay || null, created: Date.now() };
    S.debts.push(d);
    return { result: `Кредит добавлен: ${d.name}, остаток ${r(d.balance)} ₸.`, action: { kind: 'debt', id: d.id, label: `🏦 ${d.name} · ${U.money(d.balance)}` } };
  }
  if (name === 'find_transactions') {
    let list = S.transactions;
    if (a.query) { const q = a.query.toLowerCase(); list = list.filter(t => `${t.note} ${t.merchant}`.toLowerCase().includes(q)); }
    if (a.from) list = list.filter(t => t.date >= a.from);
    if (a.to) list = list.filter(t => t.date <= a.to);
    if (a.type) list = list.filter(t => t.type === a.type);
    if (a.category) { const c = F.catByName(S, a.category); if (c) list = list.filter(t => t.categoryId === c.id); }
    const total = U.sum(list, t => t.amount);
    list = [...list].sort((x, y) => y.date.localeCompare(x.date)).slice(0, Math.min(a.limit || 60, 150));
    return { result: `Найдено, сумма ${r(total)} ₸. Последние:\n` + list.map(t => `${t.date} ${t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄' : '-'}${r(t.amount)} ${F.catName(S, t.categoryId)} | ${t.note || t.merchant || ''}`).join('\n') };
  }
  return { result: 'Неизвестный инструмент' };
}

export async function chat(S, userText, history) {
  const system = SYSTEM + '\n\nДАННЫЕ ПОЛЬЗОВАТЕЛЯ:\n' + buildContext(S);
  const msgs = [];
  for (const m of history.slice(-16)) {
    if (!m.content) continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n\n' + m.content;
    else msgs.push({ role: m.role, content: m.content });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += '\n\n' + userText;
  else msgs.push({ role: 'user', content: userText });
  return provider(S) === 'claude' ? chatClaude(S, system, msgs) : chatGemini(S, system, msgs);
}

function runTool(S, name, input, actions) {
  let out;
  try { out = execTool(S, name, input || {}); } catch (e) { out = { result: 'Ошибка: ' + e.message }; }
  if (out.action) actions.push(out.action);
  return out.result;
}

async function chatClaude(S, system, msgs) {
  const actions = [];
  let text = '';
  for (let i = 0; i < 6; i++) {
    const r = await claudeCall(S, { system, messages: msgs, tools: tools(S), max_tokens: 2048 });
    const part = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    if (part) text += (text ? '\n\n' : '') + part;
    if (r.stop_reason !== 'tool_use') break;
    msgs.push({ role: 'assistant', content: r.content });
    msgs.push({ role: 'user', content: r.content.filter(c => c.type === 'tool_use').map(tu => ({ type: 'tool_result', tool_use_id: tu.id, content: runTool(S, tu.name, tu.input, actions) })) });
  }
  return { text: text || (actions.length ? 'Готово.' : '…'), actions };
}

async function chatGemini(S, system, msgs) {
  const contents = msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const decl = tools(S).map(t => ({ name: t.name, description: t.description, parameters: t.input_schema }));
  const actions = [];
  let text = '';
  for (let i = 0; i < 6; i++) {
    const r = await geminiCall(S, {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: decl }],
      generationConfig: { maxOutputTokens: 8192 },
    });
    const cand = gCandidate(r);
    const parts = cand.content?.parts || [];
    const part = gText(parts);
    if (part) text += (text ? '\n\n' : '') + part;
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) break;
    contents.push(cand.content); // как есть — с подписями размышлений Gemini 3
    contents.push({
      role: 'user',
      parts: calls.map(c => ({ functionResponse: { name: c.functionCall.name, ...(c.functionCall.id ? { id: c.functionCall.id } : {}), response: { result: runTool(S, c.functionCall.name, c.functionCall.args, actions) } } })),
    });
  }
  return { text: text || (actions.length ? 'Готово.' : '…'), actions };
}
