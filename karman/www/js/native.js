// Мост к Android-оболочке (window.KarmanNative). В браузере всё это просто выключено.
const NB = window.KarmanNative;
export const isNative = !!NB;

const safe = (fn, d) => { try { return fn(); } catch (e) { console.warn('native', e); return d; } };
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

export const info = () => isNative ? parse(safe(() => NB.info(), '{}'), {}) : {};
export const hasAccess = () => isNative && safe(() => NB.hasNotificationAccess(), false);
export const openAccess = () => isNative && safe(() => NB.openNotificationAccess());
export const openNotifSettings = () => isNative && safe(() => NB.openAppNotificationSettings());
export const pull = () => isNative ? parse(safe(() => NB.pullNotifications(), '[]'), []) : [];
export const apps = () => isNative ? parse(safe(() => NB.appsSeen(), '[]'), []) : [];
export const setApp = (pkg, allowed) => isNative && safe(() => NB.setApp(pkg, !!allowed));
export const setOptions = o => isNative && safe(() => NB.setOptions(JSON.stringify(o)));
export const schedule = list => isNative && safe(() => NB.schedule(JSON.stringify(list)));
export const widget = d => isNative && safe(() => NB.updateWidget(JSON.stringify(d)));
export const takeShared = () => isNative ? parse(safe(() => NB.takeShared(), ''), null) : null;
export const voice = () => isNative && safe(() => NB.startVoice());
export const scanQr = () => isNative && typeof NB.scanQr === 'function' && (safe(() => NB.scanQr()), true);
export const loadPageText = url => isNative && typeof NB.loadPageText === 'function' && (safe(() => NB.loadPageText(url)), true);
export const shareText = (title, text) => isNative && safe(() => NB.shareText(title, text));
export const shareFile = (name, mime, b64) => isNative && safe(() => NB.shareFile(name, mime, b64), false);
export function openUrl(url) {
  if (isNative) safe(() => NB.openUrl(url));
  else window.open(url, '_blank', 'noopener');
}

// UTF-8 текст → base64 (для резервной копии)
export function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64ToFile(b64, name, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime || 'application/octet-stream' });
}

// Стабильный числовой id для напоминаний
export function intId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000000000 + 1000;
}
