// ============================================================
// CONFIG
// ============================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzYYjN31fmPXHDgdH2fEFBptDD9mXdf71yCjwortsJOKi_NuoneqMEiPiZepMkQ0b_8w/exec';

const DEFAULT_CITY_DATA = {
  'Москва':       { minHours: 3, rateBrigadier: 800 },
  'Казань':       { minHours: 2, rateBrigadier: 700 },
  'Самара':       { minHours: 2, rateBrigadier: 650 },
  'Екатеринбург': { minHours: 3, rateBrigadier: 750 }
};
const DEFAULT_REQUISITES = {
  'Оплата по счёту':         'Реквизиты для оплаты по счёту:\nООО «Pack&Go»\nИНН 0000000000\nКПП 000000000\nР/с 00000000000000000000\nБанк: ...',
  'Оплата по самозанятости': 'Реквизиты для оплаты самозанятому:\nФИО: Иванов И.И.\nИНН: 000000000000\nТелефон: +7 (900) 000-00-00'
};
const SUPPORT_MANAGER_PHONES = {
  'Полина': '+7 923 000 20 23',
  'Александр': '+7 923 000 42 20'
};
const ATTACH_REQUEST_TEXT = 'Прикрепляю заявку на предоставление погрузо-разгрузочных работ. Ее необходимо подписать и отправить скан (или фото в хорошем качестве) ответным сообщением';

const STORAGE_KEY = 'packgo_calc_state_v123';
const STATS_KEY = 'packgo_stats_v3';
const STATS_LIMIT = 20;

// ============================================================
// STATE
// ============================================================
let CITY_DATA = JSON.parse(JSON.stringify(DEFAULT_CITY_DATA));
let REQUISITES = JSON.parse(JSON.stringify(DEFAULT_REQUISITES));
let STATS_CACHE = [];
let FEEDBACK_CACHE = [];
let BRIGADIERS_CACHE = [];
let STATS_SOURCE = 'local';

let brigEditingId = null;
let brigRating = 0;

// ★ Флаг: были ли изменения полей с момента последнего логирования
// Используется, чтобы не писать в Google Таблицу несколько раз при повторном копировании
let logPending = false;

function markChanged() { logPending = true; }

// ============================================================
// UTILS
// ============================================================
function $(id) { return document.getElementById(id); }

function num(id) {
  const v = parseFloat($(id).value);
  return isNaN(v) ? 0 : v;
}

// ★ FIX: fmt(0) → '0'. Возвращает '' только для null/undefined/NaN.
function fmt(n) {
  if (n === null || n === undefined) return '';
  const x = Number(n);
  return isNaN(x) ? '' : Math.round(x).toLocaleString('ru-RU');
}

function humanPlural(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a >= 11 && a <= 19) return 'человек';
  if (l === 1) return 'человек';
  if (l >= 2 && l <= 4) return 'человека';
  return 'человек';
}

function hourPlural(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a >= 11 && a <= 19) return 'часов';
  if (l === 1) return 'час';
  if (l >= 2 && l <= 4) return 'часа';
  return 'часов';
}

// ★ FIX: плюрализация для «записей» — используется в дубликатах
function recordsPlural(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a >= 11 && a <= 19) return 'записей';
  if (l === 1) return 'запись';
  if (l >= 2 && l <= 4) return 'записи';
  return 'записей';
}

// ★ FIX: экранируем апостроф (XSS в inline-атрибутах и тексте)
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Разбор timestamp из разных форматов (число/строка/дата)
function getTs(entry) {
  const t = entry.ts;
  if (t === null || t === undefined || t === '') return 0;
  if (typeof t === 'number') {
    if (t > 1e12) return t;
    if (t > 1e9) return t * 1000;
    if (t > 25569) return Math.round((t - 25569) * 86400 * 1000);
    return 0;
  }
  if (typeof t === 'string') {
    if (t.startsWith('ts:')) return parseInt(t.slice(3), 10) || 0;
    const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4]||0,10), parseInt(m[5]||0,10), parseInt(m[6]||0,10)).getTime();
    const parsed = Date.parse(t);
    if (!isNaN(parsed)) return parsed;
    const n = parseInt(t, 10);
    if (!isNaN(n) && n > 1e9) return n > 1e12 ? n : n * 1000;
  }
  return 0;
}

// ============================================================
// API
// ============================================================
async function fetchWithRetry(url, options, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(url, options);
      if (r.ok) return r;
      if (r.status === 404 || r.status === 429 || r.status >= 500) {
        lastError = new Error('HTTP ' + r.status);
        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, 800 * attempt + Math.random() * 400));
          continue;
        }
      }
      return r;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise(res => setTimeout(res, 800 * attempt + Math.random() * 400));
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error('Failed after retries');
}

async function sendToGoogle(entry) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬТЕ') === 0) return;
  try {
    await fetchWithRetry(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(entry),
      redirect: 'follow'
    });
  } catch (e) {
    console.warn('Не удалось отправить статистику:', e.message);
  }
}

async function loadStatsFromServer() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬТЕ') === 0) return false;
  try {
    const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    const r = await fetchWithRetry(url, { redirect: 'follow' });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (Array.isArray(data.stats)) { STATS_CACHE = data.stats.slice(0, STATS_LIMIT); STATS_SOURCE = 'cloud'; }
    if (Array.isArray(data.feedback)) { FEEDBACK_CACHE = data.feedback; }
    return true;
  } catch (e) {
    console.warn('Не удалось загрузить статистику:', e.message);
  }
  STATS_CACHE = JSON.parse(localStorage.getItem(STATS_KEY) || '[]').slice(0, STATS_LIMIT);
  STATS_SOURCE = 'local';
  return false;
}