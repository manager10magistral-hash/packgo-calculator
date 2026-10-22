// ============================================================
// ДАШБОРД
// ============================================================
let dashboardFilter = 'all';
let dashboardRange = 'month';
let dashboardTypeFilter = 'final';
let currentTableData = [];

async function refreshStats(silent) {
  if (!silent) { $('dashStatusDot').className = 'dash-status-dot'; $('dashStatusText').textContent = 'Обновление…'; }
  await loadStatsFromServer();
  updateDashStatus(); renderDashboard();
}

function updateDashStatus() {
  const dot = $('dashStatusDot'), txt = $('dashStatusText');
  if (STATS_SOURCE === 'cloud') { dot.className = 'dash-status-dot'; txt.textContent = 'Данные из Google Таблицы · ' + STATS_CACHE.length + ' записей'; }
  else { dot.className = 'dash-status-dot offline'; txt.textContent = 'Google недоступен — локальные данные (' + STATS_CACHE.length + ' записей)'; }
}

function setDashboardFilter(f) {
  dashboardFilter = f;
  document.querySelectorAll('.dash-filter[data-filter]').forEach(el => el.classList.toggle('active', el.dataset.filter === f));
  renderDashboard();
}
function setDashboardRange(r) {
  dashboardRange = r;
  document.querySelectorAll('.dash-filter[data-range]').forEach(el => el.classList.toggle('active', el.dataset.range === r));
  renderDashboard();
}
function setDashboardTypeFilter(t) {
  dashboardTypeFilter = t;
  document.querySelectorAll('.dash-filter[data-type]').forEach(el => el.classList.toggle('active', el.dataset.type === t));
  renderDashboard();
}

function isPrecalcEntry(e) {
  if (e.isPrecalc === true) return true;
  if (e.details && e.details.paymentMethod === 'Предрасчет') return true;
  return false;
}
function filterByType(data, type) {
  if (type === 'all') return data;
  return data.filter(e => {
    const p = isPrecalcEntry(e);
    return type === 'precalc' ? p : !p;
  });
}
function filterByRange(data, range) {
  if (range === 'all') return data;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const startOfToday = now.getTime();
  let threshold = 0;
  if (range === 'today') threshold = startOfToday;
  else if (range === 'week') threshold = startOfToday - 6 * 24 * 3600 * 1000;
  else if (range === 'month') threshold = startOfToday - 29 * 24 * 3600 * 1000;
  return data.filter(e => { const t = getTs(e); return t > 0 && t >= threshold; });
}

function renderDashboard() {
  const all = STATS_CACHE;
  const byManager = dashboardFilter === 'all' ? all : all.filter(e => e.manager === dashboardFilter);
  const byType = filterByType(byManager, dashboardTypeFilter);
  const filtered = filterByRange(byType, dashboardRange);
  const count = filtered.length;
  const sumClient = filtered.reduce((s, e) => s + e.clientTotal, 0);
  const sumMargin = filtered.reduce((s, e) => s + e.margin, 0);
  const avg = count ? Math.round(sumClient / count) : 0;
  $('kpiCount').textContent = count;
  $('kpiSum').textContent = sumClient ? fmt(sumClient) + ' ₽' : '0 ₽';
  $('kpiAvg').textContent = avg ? fmt(avg) + ' ₽' : '0 ₽';
  $('kpiMargin').textContent = sumMargin ? fmt(sumMargin) + ' ₽' : '0 ₽';
  
  renderDayChart(filtered);
  renderManagerCompare(filterByRange(filterByType(all, dashboardTypeFilter), dashboardRange));
  renderCityMargin(filtered);
  renderRecentTable(filtered);
  updateDashStatus();
}

function renderDayChart(data) {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const items = data.filter(e => { const t = getTs(e); return t >= d.getTime() && t < next.getTime(); });
    days.push({ label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), count: items.length });
  }
  const maxCount = Math.max(...days.map(d => d.count), 1);
  if (data.length === 0) { $('dayChart').innerHTML = '<div class="chart-empty">Пока нет данных за выбранный период</div>'; return; }
  $('dayChart').innerHTML = '<div class="chart-wrap">' + days.map(d => {
    const h = d.count === 0 ? 4 : Math.max(8, (d.count / maxCount) * 100);
    return `<div class="chart-bar-col"><div class="chart-bar" style="height:${h}%;">${d.count > 0 ? `<span class="chart-count">${d.count}</span>` : ''}</div><div class="chart-label">${d.label}</div></div>`;
  }).join('') + '</div>';
}

function renderManagerCompare(all) {
  const managers = ['Юлия', 'Александр'];
  const stats = managers.map(m => {
    const items = all.filter(e => e.manager === m);
    return { name: m, count: items.length, total: items.reduce((s, e) => s + e.clientTotal, 0), margin: items.reduce((s, e) => s + e.margin, 0) };
  });
  const maxTotal = Math.max(...stats.map(s => s.total), 1);
  if (all.length === 0) { $('managerCompare').innerHTML = '<div class="chart-empty">Пока нет данных</div>'; return; }
  $('managerCompare').innerHTML = stats.map(s => {
    const widthPct = s.total ? Math.max(8, (s.total / maxTotal) * 100) : 0;
    const cls = s.name === 'Юлия' ? 'julia' : 'alexander';
    return `<div class="manager-bar-row"><div class="manager-bar-header"><span class="manager-bar-name">${s.name}</span><span class="manager-bar-stats">${s.count} расчётов · ${fmt(s.total) || '0'} ₽ · маржа ${fmt(s.margin) || '0'} ₽</span></div><div class="manager-bar-track"><div class="manager-bar-fill ${cls}" style="width:${widthPct}%;">${s.total ? fmt(s.total) + ' ₽' : ''}</div></div></div>`;
  }).join('');
}

function renderCityMargin(data) {
  if (data.length === 0) {
    $('cityMarginTableWrap').innerHTML = '<div class="empty-state">Нет данных для анализа</div>';
    return;
  }

  const cities = {};
  
  data.forEach(e => {
    if (e.cityLoad) {
      if (!cities[e.cityLoad]) cities[e.cityLoad] = { count: 0, totalMargin: 0, totalClient: 0 };
      cities[e.cityLoad].count++;
      cities[e.cityLoad].totalMargin += e.margin;
      cities[e.cityLoad].totalClient += e.clientTotal;
    }
    if (e.cityUnload && e.cityUnload !== e.cityLoad) {
      if (!cities[e.cityUnload]) cities[e.cityUnload] = { count: 0, totalMargin: 0, totalClient: 0 };
      cities[e.cityUnload].count++;
      cities[e.cityUnload].totalMargin += e.margin;
      cities[e.cityUnload].totalClient += e.clientTotal;
    }
  });

  const rows = Object.entries(cities).map(([city, stats]) => {
    const avgMargin = Math.round(stats.totalMargin / stats.count);
    const avgClient = Math.round(stats.totalClient / stats.count);
    return `<tr>
      <td style="font-weight:600;">${escapeHtml(city)}</td>
      <td>${stats.count}</td>
      <td>${fmt(avgClient)} ₽</td>
      <td style="color:#2f855a; font-weight:600;">${fmt(avgMargin)} ₽</td>
    </tr>`;
  }).join('');

  $('cityMarginTableWrap').innerHTML = `
    <table class="stats-table">
      <thead>
        <tr><th>Город</th><th>Заказов</th><th>Средний чек</th><th>Средняя маржа</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderRecentTable(data) {
  if (data.length === 0) { $('recentTableWrap').innerHTML = '<div class="empty-state">Пока нет расчётов за выбранный период.</div>'; return; }
  const rows = data.slice(0, STATS_LIMIT).map((e, idx) => {
    const t = getTs(e);
    const date = t ? new Date(t) : new Date();
    const dateStr = t ? date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
    const cls = e.manager === 'Юлия' ? 'julia' : 'alexander';
    const route = [e.cityLoad, e.cityUnload].filter(Boolean).join(' → ') || '—';
    const hasDetails = !!e.details;
    const eyeBtn = hasDetails ? `<button class="btn-icon" onclick="showDetails(${idx})" title="Показать детали">👁</button>` : '<span style="color: var(--text-faint);">—</span>';
    const isP = isPrecalcEntry(e);
    const typeBadge = isP ? '<span class="type-pill precalc">Предрасчёт</span>' : '<span class="type-pill final">Итоговый</span>';
    return `<tr><td>${dateStr}</td><td><span class="manager-pill ${cls}">${escapeHtml(e.manager)}</span></td><td>${escapeHtml(e.clientName)} ${typeBadge}</td><td>${escapeHtml(route)}</td><td style="font-weight:600;">${fmt(e.clientTotal)} ₽</td><td style="color:#2f855a;font-weight:600;">${fmt(e.margin)} ₽</td><td style="text-align:center;">${eyeBtn}</td></tr>`;
  }).join('');
  $('recentTableWrap').innerHTML = `<table class="stats-table"><thead><tr><th>Дата</th><th>Менеджер</th><th>Клиент</th><th>Маршрут</th><th>Сумма</th><th>Маржа</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  currentTableData = data.slice(0, STATS_LIMIT);
}

function showDetails(idx) {
  const e = currentTableData[idx];
  if (!e || !e.details) { alert('Детали этого расчёта недоступны'); return; }
  const d = e.details;
  const t = getTs(e);
  const dateStr = t ? new Date(t).toLocaleString('ru-RU') : '—';
  const item = (label, val) => (val !== '' && val !== null && val !== undefined && val !== 0 && val !== false) ? `<div class="modal-detail-item"><b>${label}</b>${escapeHtml(val)}</div>` : '';
  let html = '<div class="modal-detail-grid">';
  html += item('Менеджер', e.manager);
  html += item('Дата', dateStr);
  html += item('Клиент', e.clientName);
  html += item('Тип', isPrecalcEntry(e) ? 'Предрасчёт' : 'Итоговый');
  html += item('Объём', d.volume ? d.volume + ' м³' : '');
  html += '</div>';
  html += '<div class="modal-section-title">Грузчики</div><div class="modal-detail-grid">';
  html += item('Общее количество', d.loadersGlobal);
  html += item('На погрузке', d.loadersLoad);
  html += item('На выгрузке', d.loadersUnload);
  html += '</div>';
  html += '<div class="modal-section-title">Погрузка</div><div class="modal-detail-grid">';
  html += item('Город', e.cityLoad);
  html += item('Часов', d.calcHoursLoad);
  html += item('Ставка бригадира', d.rateLoad ? d.rateLoad + ' ₽/ч' : '');
  html += item('Себестоимость грузчиков', d.selfLoadGruz ? fmt(d.selfLoadGruz) + ' ₽' : '');
  html += item('Стоимость для клиента', d.clientCostLoad ? fmt(d.clientCostLoad) + ' ₽' : '');
  html += item('Часовая для клиента', d.clientHourlyLoad ? fmt(d.clientHourlyLoad) + ' ₽/ч/чел' : '');
  html += '</div>';
  if (d.evacLoad) {
    html += '<div class="modal-section-title">Эвакуатор на погрузке</div><div class="modal-detail-grid">';
    html += item('Себестоимость', d.evacLoadCostUs ? fmt(d.evacLoadCostUs) + ' ₽' : '');
    html += item('Для клиента', d.evacLoadCostClient ? fmt(d.evacLoadCostClient) + ' ₽' : '');
    html += '</div>';
  }
  html += '<div class="modal-section-title">Выгрузка</div><div class="modal-detail-grid">';
  html += item('Город', e.cityUnload);
  html += item('Часов', d.calcHoursUnload);
  html += item('Ставка бригадира', d.rateUnload ? d.rateUnload + ' ₽/ч' : '');
  html += item('Себестоимость грузчиков', d.selfUnloadGruz ? fmt(d.selfUnloadGruz) + ' ₽' : '');
  html += item('Стоимость для клиента', d.clientCostUnload ? fmt(d.clientCostUnload) + ' ₽' : '');
  html += item('Часовая для клиента', d.clientHourlyUnload ? fmt(d.clientHourlyUnload) + ' ₽/ч/чел' : '');
  html += '</div>';
  if (d.evacUnload) {
    html += '<div class="modal-section-title">Эвакуатор на выгрузке</div><div class="modal-detail-grid">';
    html += item('Себестоимость', d.evacUnloadCostUs ? fmt(d.evacUnloadCostUs) + ' ₽' : '');
    html += item('Для клиента', d.evacUnloadCostClient ? fmt(d.evacUnloadCostClient) + ' ₽' : '');
    html += '</div>';
  }
  html += '<div class="modal-section-title">Итого</div><div class="modal-detail-grid">';
  html += item('Себестоимость', fmt(e.selfTotal) + ' ₽');
  html += item('Стоимость для клиента', fmt(e.clientTotal) + ' ₽');
  html += item('Маржа', fmt(e.margin) + ' ₽');
  html += item('Способ оплаты', d.paymentMethod);
  html += '</div>';
  $('detailModalBody').innerHTML = html;
  $('detailModal').classList.add('open');
}
function closeDetailModal() { $('detailModal').classList.remove('open'); }

function runDiagnostics() {
  console.clear();
  console.log('=== ДИАГНОСТИКА ===');
  console.log('STATS_CACHE:', STATS_CACHE.length);
  console.log('FEEDBACK_CACHE:', FEEDBACK_CACHE.length);
  console.log('BRIGADIERS_CACHE:', BRIGADIERS_CACHE.length);
  console.log('Источник:', STATS_SOURCE);
  alert('Результат выведен в консоль браузера (F12 → Console).');
}

// ============================================================
// ОБРАТНАЯ СВЯЗЬ
// ============================================================
let feedbackFilter = 'active';

function setFeedbackFilter(f) {
  feedbackFilter = f;
  document.querySelectorAll('.fb-filter').forEach(el => el.classList.toggle('active', el.dataset.filter === f));
  renderFeedback();
}

async function submitFeedback() {
  const request = $('fbRequest').value.trim();
  const example = $('fbExample').value.trim();
  if (!request) { alert('Введите запрос'); return; }
  const manager = $('manager').value || 'Неизвестно';
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬТЕ') === 0) { alert('URL не задан'); return; }
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({ type: 'feedback', ts: Date.now(), manager, request, example }),
      redirect: 'follow'
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    $('fbRequest').value = ''; $('fbExample').value = '';
    alert('Запрос отправлен!');
    await refreshFeedback();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

async function refreshFeedback() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬТЕ') === 0) {
    $('fbListWrap').innerHTML = '<div class="empty-state">URL Apps Script не задан</div>'; return;
  }
  try {
    const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    const r = await fetchWithRetry(url, { redirect: 'follow' });
    const data = await r.json();
    if (Array.isArray(data.feedback)) { FEEDBACK_CACHE = data.feedback; renderFeedback(); }
  } catch (e) { console.warn('Ошибка загрузки обратной связи:', e); }
}

function renderFeedback() {
  $('fbCount').textContent = FEEDBACK_CACHE.length;
  let list = FEEDBACK_CACHE.map((fb, i) => ({...fb, _idx: i}));
  if (feedbackFilter === 'active') list = list.filter(fb => fb.status !== '✓');
  else if (feedbackFilter === 'archive') list = list.filter(fb => fb.status === '✓');
  list.sort((a, b) => b.ts - a.ts);
  if (list.length === 0) {
    const text = feedbackFilter === 'archive' ? 'Архив пуст — сюда попадают запросы со статусом ✓.'
      : feedbackFilter === 'active' ? 'Активных запросов нет. Отличная работа!' : 'Пока нет запросов.';
    $('fbListWrap').innerHTML = '<div class="empty-state">' + text + '</div>';
    return;
  }
  $('fbListWrap').innerHTML = list.map(fb => {
    const dateStr = fb.ts ? new Date(fb.ts).toLocaleString('ru-RU') : '—';
    const statusClass = fb.status === '✓' ? 'fb-done' : fb.status === '🕐' ? 'fb-progress'
      : fb.status === '❓' ? 'fb-unclear' : fb.status === '✗' ? 'fb-cancel' : '';
    return `<div class="fb-item ${statusClass}">
      <div class="fb-header"><span>${dateStr}</span><span>${escapeHtml(fb.manager || '')}</span></div>
      <div class="fb-request">${escapeHtml(fb.request)}</div>
      ${fb.example ? `<div class="fb-example"><b>Пример:</b> ${escapeHtml(fb.example)}</div>` : ''}
      <div class="fb-status-row">
        <button class="fb-status-btn ${fb.status === '✓' ? 'active' : ''}" onclick="setFbStatus(${fb._idx}, '✓')" title="Сделано">✓</button>
        <button class="fb-status-btn ${fb.status === '🕐' ? 'active' : ''}" onclick="setFbStatus(${fb._idx}, '🕐')" title="В работе">🕐</button>
        <button class="fb-status-btn ${fb.status === '❓' ? 'active' : ''}" onclick="setFbStatus(${fb._idx}, '❓')" title="Непонятно">❓</button>
        <button class="fb-status-btn ${fb.status === '✗' ? 'active' : ''}" onclick="setFbStatus(${fb._idx}, '✗')" title="Не будет">✗</button>
        <button class="fb-status-btn" onclick="setFbStatus(${fb._idx}, '')" title="Сбросить">—</button>
      </div>
    </div>`;
  }).join('');
}

async function setFbStatus(idx, status) {
  const fb = FEEDBACK_CACHE[idx];
  if (!fb) return;
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({ type: 'feedback_status', ts: 'ts:' + fb.ts, status }),
      redirect: 'follow'
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fb.status = status;
    renderFeedback();
  } catch (e) { alert('Ошибка: ' + e.message); }
}