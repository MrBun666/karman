// Состояние приложения и категории по умолчанию
import { idbGet, idbSet } from './db.js';

// group: need — обязательное, want — желания, save — накопления (правило 50/30/20)
// excluded: не считается ни доходом, ни расходом (перемещение своих денег)
export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', type: 'expense', group: 'need' },
  { id: 'cafe', name: 'Кафе и доставка', icon: '🍔', type: 'expense', group: 'want' },
  { id: 'transport', name: 'Транспорт и такси', icon: '🚕', type: 'expense', group: 'need' },
  { id: 'car', name: 'Авто и бензин', icon: '⛽', type: 'expense', group: 'need' },
  { id: 'home', name: 'Жильё и коммуналка', icon: '🏠', type: 'expense', group: 'need' },
  { id: 'comm', name: 'Связь и интернет', icon: '📱', type: 'expense', group: 'need' },
  { id: 'health', name: 'Здоровье и аптека', icon: '💊', type: 'expense', group: 'need' },
  { id: 'household', name: 'Дом и быт', icon: '🧴', type: 'expense', group: 'need' },
  { id: 'kids', name: 'Дети', icon: '🧸', type: 'expense', group: 'need' },
  { id: 'edu', name: 'Образование', icon: '📚', type: 'expense', group: 'need' },
  { id: 'credit', name: 'Кредиты и рассрочки', icon: '🏦', type: 'expense', group: 'need' },
  { id: 'clothes', name: 'Одежда и обувь', icon: '👕', type: 'expense', group: 'want' },
  { id: 'fun', name: 'Развлечения', icon: '🎮', type: 'expense', group: 'want' },
  { id: 'subs', name: 'Подписки', icon: '🔁', type: 'expense', group: 'want' },
  { id: 'beauty', name: 'Красота', icon: '💅', type: 'expense', group: 'want' },
  { id: 'gifts', name: 'Подарки', icon: '🎁', type: 'expense', group: 'want' },
  { id: 'p2p_out', name: 'Переводы людям', icon: '👤', type: 'expense', group: 'want' },
  { id: 'other_exp', name: 'Другое', icon: '📦', type: 'expense', group: 'want' },
  { id: 'savings', name: 'Накопления', icon: '🐷', type: 'expense', group: 'save' },
  { id: 'salary', name: 'Зарплата', icon: '💼', type: 'income', group: 'income' },
  { id: 'side', name: 'Подработка', icon: '🛠️', type: 'income', group: 'income' },
  { id: 'p2p_in', name: 'Переводы от людей', icon: '🤝', type: 'income', group: 'income' },
  { id: 'cashback', name: 'Кэшбэк и возвраты', icon: '↩️', type: 'income', group: 'income' },
  { id: 'other_inc', name: 'Другой доход', icon: '✨', type: 'income', group: 'income' },
  { id: 'own_in', name: 'Со своих счетов', icon: '🔄', type: 'income', group: 'income', excluded: true },
];

const anchor0 = () => ({ amount: 0, date: '2000-01-01', ts: 0 });

export function defaultState() {
  return {
    schema: 1,
    accounts: [
      { id: 'kaspi', name: 'Kaspi Gold', icon: '💳', anchor: anchor0() },
      { id: 'cash', name: 'Наличные', icon: '💵', anchor: anchor0() },
    ],
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    transactions: [],
    events: [],
    goals: [],
    debts: [],
    rules: {},        // «магазин» → категория (запоминается, когда меняешь категорию)
    chat: [],
    dismissed: {},    // скрытые подсказки
    settings: {
      name: '', apiKey: '', model: 'gemini-3.8-flash', payday: null, pinHash: null,
      lastBackup: null, theme: 'auto', defaultAccount: 'cash', onboarded: false, monthlyIncome: null,
      confirmPush: true, remindPayments: true, eveningReminder: true, eveningTime: '21:00', weeklySummary: true, autoAsked: false,
    },
  };
}

export let S = null;

function migrate(s) {
  const d = defaultState();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.settings = { ...d.settings, ...s.settings };
  // новые категории из обновлений добавляются, пользовательские не трогаем
  for (const c of d.categories) if (!s.categories.find(x => x.id === c.id)) s.categories.push(c);
  for (const a of s.accounts) if (!a.anchor) a.anchor = anchor0();
  // переход на бесплатный Gemini: старый выбор Claude без ключа Claude сбрасываем
  if (/^claude/.test(s.settings.model || '') && !String(s.settings.apiKey || '').startsWith('sk-ant-')) s.settings.model = 'gemini-3.8-flash';
  return s;
}

export async function loadState() {
  let s = null;
  try { s = await idbGet('state'); } catch (e) { console.error(e); }
  S = s ? migrate(s) : defaultState();
  return S;
}

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => idbSet('state', S).catch(console.error), 250);
}
export function saveNow() { clearTimeout(timer); return idbSet('state', S); }
export function replaceState(ns) { S = migrate(ns); return saveNow(); }
