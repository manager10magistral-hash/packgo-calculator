// ============================================================
// ТЕМА
// ============================================================
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('packgo_theme', isDark ? 'dark' : 'light');
  $('themeIcon').textContent = isDark ? '☀' : '☾';
}
function loadTheme() {
  const saved = localStorage.getItem('packgo_theme');
  if (saved === 'dark') { document.body.classList.add('dark'); $('themeIcon').textContent = '☀'; }
  else $('themeIcon').textContent = '☾';
}

// ============================================================
// СПРАВОЧНИКИ
// ============================================================
function fillCityDatalist() {
  const cities = Object.keys(CITY_DATA).sort();
  $('cityList').innerHTML = cities.map(c => '<option value="' + c + '"></option>').join('');
}
function fillFloorsDatalist() {
  let html = '';
  for (let i = 1; i <= 100; i++) html += '<option value="' + i + '"></option>';
  $('floorsList').innerHTML = html;
}

// ============================================================
// PERSISTENCE
// ============================================================
const FIELD_IDS = [
  'manager','clientName','volume','loaders',
  'cityLoad','hoursLoad','rateBrigadierManualLoad','selfCostLoad','clientCostLoad','clientHourlyLoad',
  'loadersLoadOverride','loadersLoad','evacLoad','evacLoadCostUs','evacLoadCostClient',
  'cityUnload','hoursUnload','rateBrigadierManualUnload','selfCostUnload','clientCostUnload','clientHourlyUnload',
  'loadersUnloadOverride','loadersUnload','evacUnload','evacUnloadCostUs','evacUnloadCostClient',
  'paymentMethod',
  'attachRequestText','showSupportManager','supportManagerMode',
  'supportManagerUnified','supportManagerLoad','supportManagerUnload',
  'brPayment','brCargo','brVolume',
  'brAddressLoad','brElevatorLoad','brFloorLoad','brWorkLoad2','brWorkLoad3','brCommentLoad',
  'brAddressUnload','brElevatorUnload','brFloorUnload','brWorkUnload4','brCommentUnload'
];

function saveState() {
  const state = {};
  FIELD_IDS.forEach(id => { const el = $(id); if (!el) return; state[id] = el.type === 'checkbox' ? el.checked : el.value; });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
    const state = JSON.parse(raw);
    Object.keys(state).forEach(id => {
      const el = $(id); if (!el) return;
      if (el.type === 'checkbox') el.checked = state[id]; else el.value = state[id];
    });
  } catch(e) {}
}

function clearAll() {
  if (!confirm('Очистить все поля?')) return;
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.id === 'manager') return;
    if (el.id === 'fbRequest' || el.id === 'fbExample') return;
    if (el.type === 'checkbox') el.checked = false; else el.value = '';
  });
  $('hoursLoad').value = '2'; $('hoursUnload').value = '2';
  $('messageOutput').textContent = 'Заполните данные слева — сообщение сформируется автоматически.';
  $('brOutputLoad').textContent = 'Заполните данные слева…';
  $('brOutputUnload').textContent = 'Заполните данные слева…';
  $('brOutputBoth').textContent = 'Заполните данные слева…';
  updateConditionalBlocks(); calculate(); generateMessage();
  localStorage.removeItem(STORAGE_KEY);
  logPending = false;
}

// ============================================================
// ПРЕСЕТЫ (ШАБЛОНЫ)
// ============================================================
const PRESETS_KEY = 'packgo_presets_v1';

function renderPresets() {
  const select = $('presetSelect');
  if (!select) return;
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
  const keys = Object.keys(presets);
  if (keys.length === 0) {
    select.innerHTML = '<option value="">— Нет сохранённых шаблонов —</option>';
    return;
  }
  select.innerHTML = '<option value="">— Выберите шаблон —</option>' + 
    keys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
}

function savePreset() {
  const name = prompt('Введите название для шаблона (например, "Квартира 2к"):');
  if (!name || !name.trim()) return;
  
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
  const currentState = {};
  
  FIELD_IDS.forEach(id => {
    if (id === 'clientName') return; 
    const el = $(id); if (!el) return;
    currentState[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  
  presets[name.trim()] = currentState;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  renderPresets();
  alert('Шаблон «' + name.trim() + '» сохранён!');
}

function loadPreset() {
  const name = $('presetSelect').value;
  if (!name) { alert('Выберите шаблон из списка'); return; }
  
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
  const state = presets[name];
  if (!state) return;
  
  Object.keys(state).forEach(id => {
    const el = $(id); if (!el) return;
    if (el.type === 'checkbox') el.checked = state[id]; else el.value = state[id];
  });
  
  updateConditionalBlocks();
  calculate();
  generateMessage();
  markChanged();
}

function deletePreset() {
  const name = $('presetSelect').value;
  if (!name) { alert('Выберите шаблон для удаления'); return; }
  if (!confirm('Удалить шаблон «' + name + '»?')) return;
  
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
  delete presets[name];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  renderPresets();
}

// ============================================================
// ЗАГРУЗКА ИЗ GOOGLE / ДИАГНОСТИКА СОЕДИНЕНИЯ
// ============================================================
async function loadFromGoogleSheets() {
  const status = $('gsStatus');
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬТЕ') === 0) {
    status.className = 'status err'; status.textContent = '⚠ URL не задан.'; return;
  }
  status.className = 'status info'; status.textContent = 'Загрузка данных из Google…';
  try {
    const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    const response = await fetchWithRetry(url, { redirect: 'follow' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data.cities || !data.requisites) throw new Error('Неверный формат ответа');
    CITY_DATA = data.cities; REQUISITES = data.requisites;
    if (Array.isArray(data.stats)) { STATS_CACHE = data.stats.slice(0, STATS_LIMIT); STATS_SOURCE = 'cloud'; }
    else { STATS_CACHE = JSON.parse(localStorage.getItem(STATS_KEY) || '[]').slice(0, STATS_LIMIT); STATS_SOURCE = 'local'; }
    if (Array.isArray(data.feedback)) { FEEDBACK_CACHE = data.feedback; }
    if (Array.isArray(data.brigadiers)) { BRIGADIERS_CACHE = data.brigadiers; }
    fillCityDatalist(); fillBrigFilterOptions(); calculate(); generateMessage();
    renderFeedback(); renderBrigadiers();
    logPending = false;
    status.className = 'status ok';
    status.textContent = '✓ Данные: ' + Object.keys(CITY_DATA).length + ' городов, статистика — ' + STATS_CACHE.length
      + ', обратная связь — ' + FEEDBACK_CACHE.length + ', бригадиров — ' + BRIGADIERS_CACHE.length + '.'
      + (data.version ? ' (Apps Script: ' + data.version + ')' : '');
    updateDashStatus(); renderDashboard();
  } catch (e) {
    status.className = 'status err';
    status.textContent = 'Ошибка загрузки: ' + e.message + '. Нажмите «Загрузить данные заново».';
    STATS_CACHE = JSON.parse(localStorage.getItem(STATS_KEY) || '[]').slice(0, STATS_LIMIT);
    STATS_SOURCE = 'local';
    updateDashStatus(); renderDashboard();
    console.error(e);
  }
}

async function testConnection() {
  const out = $('gsStatus');
  out.className = 'status info'; out.textContent = 'Проверка соединения…';
  const info = [];
  info.push('URL: ' + APPS_SCRIPT_URL);
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL + '?t=' + Date.now(), { redirect: 'follow' });
    info.push('HTTP: ' + r.status);
    if (r.ok) {
      const data = await r.json();
      if (data.error) info.push('❌ ' + data.error);
      else {
        info.push('✓ Городов: ' + Object.keys(data.cities || {}).length);
        info.push('✓ Реквизитов: ' + Object.keys(data.requisites || {}).length);
        info.push('✓ Статистики: ' + (data.stats || []).length);
        info.push('✓ Обратной связи: ' + (data.feedback || []).length);
        info.push('✓ Бригадиров: ' + (data.brigadiers || []).length);
        if (data.version) info.push('Apps Script: ' + data.version);
      }
    }
  } catch (e) { info.push('❌ ' + e.message); }
  out.innerHTML = info.join('<br>');
}

function resetToDefaults() {
  CITY_DATA = JSON.parse(JSON.stringify(DEFAULT_CITY_DATA));
  REQUISITES = JSON.parse(JSON.stringify(DEFAULT_REQUISITES));
  fillCityDatalist(); calculate(); generateMessage();
  $('gsStatus').className = 'status info'; $('gsStatus').textContent = 'Используются встроенные данные.';
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  fillCityDatalist();
  fillFloorsDatalist();
  loadState();
  renderPresets(); // <-- Инициализация списка шаблонов
  updateConditionalBlocks();

  // Табы
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'dashboard') { renderDashboard(); refreshStats(true); }
      if (tab.dataset.tab === 'feedback') { refreshFeedback(); }
      if (tab.dataset.tab === 'brigadiers') { renderBrigadiers(); }
    });
  });

  // Обработчики полей
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id.startsWith('clientCost') || el.id.startsWith('clientHourly')) return;
      if (el.id.startsWith('fb')) return;
      if (el.id.startsWith('brig')) return;
      if (el.closest('#panel-calc')) markChanged();
      calculate();
      if (el.closest('#panel-calc')) generateMessage();
      if (el.closest('#panel-brigadier')) generateBrigadierRequests();
    });
    el.addEventListener('change', () => {
      if (el.id.startsWith('fb')) return;
      if (el.id.startsWith('brig')) return;
      if (el.closest('#panel-calc')) markChanged();
      updateConditionalBlocks(); calculate();
      if (el.closest('#panel-calc')) generateMessage();
      if (el.closest('#panel-brigadier')) generateBrigadierRequests();
    });
    if (el.id === 'cityLoad' || el.id === 'cityUnload') el.addEventListener('blur', () => validateCity(el));
    if (el.id === 'hoursLoad' || el.id === 'hoursUnload') el.addEventListener('blur', () => validateHours(el));
  });

  // Горячие клавиши
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'Enter') {
        e.preventDefault();
        copyMessage();
      }
      if (e.key === 's' || e.key === 'ы') {
        e.preventDefault();
        downloadPdf();
      }
      if (e.key === 'q' || e.key === 'й') {
        e.preventDefault();
        clearAll();
      }
    }
  });

  // Закрытие модалок по клику на фон
  document.getElementById('detailModal').addEventListener('click', (e) => { if (e.target.id === 'detailModal') closeDetailModal(); });
  document.getElementById('brigModal').addEventListener('click', (e) => { if (e.target.id === 'brigModal') closeBrigModal(); });
  document.getElementById('dupModal').addEventListener('click', (e) => { if (e.target.id === 'dupModal') closeDuplicatesModal(); });

  calculate(); generateMessage(); generateBrigadierRequests(); updateDashStatus();
  await loadFromGoogleSheets();
  logPending = false;
});