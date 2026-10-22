// ============================================================
// ВАЛИДАЦИЯ / СПРАВОЧНИКИ
// ============================================================
function normalizeCity(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (CITY_DATA[trimmed]) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const key of Object.keys(CITY_DATA)) if (key.toLowerCase() === lower) return key;
  return '';
}

function validateCity(input) {
  const val = input.value.trim();
  if (!val) { input.classList.remove('invalid'); return true; }
  const ok = !!normalizeCity(val);
  input.classList.toggle('invalid', !ok);
  return ok;
}

function validateHours(input) {
  const v = String(input.value || '').trim();
  if (!v) { input.classList.remove('invalid'); return true; }
  const ok = /^\d+([.,]\d+)?$/.test(v);
  input.classList.toggle('invalid', !ok);
  if (ok && v.indexOf(',') >= 0) input.value = v.replace(',', '.');
  return ok;
}

function getEffectiveLoaders(direction) {
  const global = num('loaders');
  if (direction === 'Load') {
    if ($('loadersLoadOverride').checked) { const own = num('loadersLoad'); if (own > 0) return own; }
    return global;
  } else {
    if ($('loadersUnloadOverride').checked) { const own = num('loadersUnload'); if (own > 0) return own; }
    return global;
  }
}

// ============================================================
// РАСЧЁТ
// ============================================================
function syncClientCost(direction, source) {
  markChanged();  // ★ пользователь меняет цену клиента — надо залогировать
  const totalField = $('clientCost' + direction);
  const hourlyField = $('clientHourly' + direction);
  const hours = direction === 'Load' ? num('hoursLoad') : num('hoursUnload');
  const city = direction === 'Load' ? normalizeCity($('cityLoad').value) : normalizeCity($('cityUnload').value);
  const data = CITY_DATA[city];
  const calcHours = Math.max(hours, data ? data.minHours : 0);
  const people = getEffectiveLoaders(direction);
  if (calcHours <= 0 || people <= 0) {
    if (source === 'hourly') totalField.value = '';
    else if (source === 'total') hourlyField.value = '';
    calculate(); generateMessage(); return;
  }
  if (source === 'total') {
    const t = parseFloat(totalField.value);
    if (!isNaN(t) && t > 0) hourlyField.value = Math.round(t / calcHours / people);
    else hourlyField.value = '';
  } else {
    const h = parseFloat(hourlyField.value);
    if (!isNaN(h) && h > 0) totalField.value = Math.round(h * calcHours * people);
    else totalField.value = '';
  }
  calculate(); generateMessage();
}

function computeValues() {
  const cityLoad = normalizeCity($('cityLoad').value);
  const cityUnload = normalizeCity($('cityUnload').value);
  const globalLoaders = num('loaders');
  const loadersLoad = getEffectiveLoaders('Load');
  const loadersUnload = getEffectiveLoaders('Unload');
  const hoursLoad = num('hoursLoad');
  const hoursUnload = num('hoursUnload');
  const dataLoad = CITY_DATA[cityLoad] || null;
  const dataUnload = CITY_DATA[cityUnload] || null;
  const rateLoadDict = dataLoad ? dataLoad.rateBrigadier : 0;
  const rateUnloadDict = dataUnload ? dataUnload.rateBrigadier : 0;
  const rateLoadManual = num('rateBrigadierManualLoad');
  const rateUnloadManual = num('rateBrigadierManualUnload');
  const rateLoad = rateLoadManual > 0 ? rateLoadManual : rateLoadDict;
  const rateUnload = rateUnloadManual > 0 ? rateUnloadManual : rateUnloadDict;
  const calcHoursLoad = Math.max(hoursLoad, dataLoad ? dataLoad.minHours : 0);
  const calcHoursUnload = Math.max(hoursUnload, dataUnload ? dataUnload.minHours : 0);
  const selfLoadGruz = (cityLoad && loadersLoad > 0 && calcHoursLoad > 0) ? rateLoad * loadersLoad * calcHoursLoad : 0;
  const selfUnloadGruz = (cityUnload && loadersUnload > 0 && calcHoursUnload > 0) ? rateUnload * loadersUnload * calcHoursUnload : 0;
  const evacSelfLoad = $('evacLoad').checked ? num('evacLoadCostUs') : 0;
  const evacSelfUnload = $('evacUnload').checked ? num('evacUnloadCostUs') : 0;
  const evacClientLoad = $('evacLoad').checked ? num('evacLoadCostClient') : 0;
  const evacClientUnload = $('evacUnload').checked ? num('evacUnloadCostClient') : 0;
  const selfLoad = selfLoadGruz + evacSelfLoad;
  const selfUnload = selfUnloadGruz + evacSelfUnload;
  const clientLoadInput = num('clientCostLoad');
  const clientUnloadInput = num('clientCostUnload');
  const clientLoad = clientLoadInput > 0 ? clientLoadInput : selfLoad;
  const clientUnload = clientUnloadInput > 0 ? clientUnloadInput : selfUnload;
  const selfTotal = selfLoad + selfUnload;
  const clientTotal = clientLoad + clientUnload + evacClientLoad + evacClientUnload;
  const prepayment = clientTotal - selfTotal;  // = маржа (бизнес-логика подтверждена)
  return {
    cityLoad, cityUnload, globalLoaders, loadersLoad, loadersUnload,
    hoursLoad, hoursUnload, calcHoursLoad, calcHoursUnload,
    rateLoad, rateUnload, selfLoadGruz, selfUnloadGruz,
    evacSelfLoad, evacSelfUnload, evacClientLoad, evacClientUnload,
    selfLoad, selfUnload, selfTotal, clientLoad, clientUnload, clientTotal, prepayment
  };
}

function calculate() {
  const v = computeValues();
  $('rateBrigadierLoad').value = (CITY_DATA[v.cityLoad] && CITY_DATA[v.cityLoad].rateBrigadier) ? CITY_DATA[v.cityLoad].rateBrigadier + ' ₽/ч' : '';
  $('rateBrigadierUnload').value = (CITY_DATA[v.cityUnload] && CITY_DATA[v.cityUnload].rateBrigadier) ? CITY_DATA[v.cityUnload].rateBrigadier + ' ₽/ч' : '';
  $('selfCostLoad').value = v.selfLoad ? fmt(v.selfLoad) + ' ₽' : '';
  $('selfCostUnload').value = v.selfUnload ? fmt(v.selfUnload) + ' ₽' : '';
  $('outSelfLoad').textContent = v.selfLoad ? fmt(v.selfLoad) + ' ₽' : '—';
  $('outSelfUnload').textContent = v.selfUnload ? fmt(v.selfUnload) + ' ₽' : '—';
  $('outSelfTotal').textContent = v.selfTotal ? fmt(v.selfTotal) + ' ₽' : '—';
  $('outClientLoad').textContent = v.clientLoad ? fmt(v.clientLoad) + ' ₽' : '—';
  $('outClientUnload').textContent = v.clientUnload ? fmt(v.clientUnload) + ' ₽' : '—';
  $('outClientEvac').textContent = (v.evacClientLoad + v.evacClientUnload) ? fmt(v.evacClientLoad + v.evacClientUnload) + ' ₽' : '—';
  $('outClientTotal').textContent = v.clientTotal ? fmt(v.clientTotal) + ' ₽' : '—';
  $('outPrepay').textContent = v.prepayment > 0 ? fmt(v.prepayment) + ' ₽' : '—';
  $('outRemainLoad').textContent = v.selfLoad ? fmt(v.selfLoad) + ' ₽' : '—';
  $('outRemainUnload').textContent = v.selfUnload ? fmt(v.selfUnload) + ' ₽' : '—';
  $('badgeLoad').textContent = v.cityLoad ? 'заполнено' : 'не заполнено';
  $('badgeLoad').style.background = v.cityLoad ? '#dcfce7' : 'var(--accent-bg)';
  $('badgeLoad').style.color = v.cityLoad ? '#166534' : 'var(--text-dim)';
  $('badgeUnload').textContent = v.cityUnload ? 'заполнено' : 'не заполнено';
  $('badgeUnload').style.background = v.cityUnload ? '#dcfce7' : 'var(--accent-bg)';
  $('badgeUnload').style.color = v.cityUnload ? '#166534' : 'var(--text-dim)';
  saveState();
}

// ============================================================
// МЕНЕДЖЕР ПО СОПРОВОЖДЕНИЮ + СООБЩЕНИЕ
// ============================================================
// ★ FIX: проверяем сырые значения городов, а не нормализованные —
// иначе при городе не из справочника блок «Менеджер по сопровождению» не появится
function getSupportManagerText() {
  if (!$('showSupportManager') || !$('showSupportManager').checked) return '';
  const cityLoad = ($('cityLoad').value || '').trim();
  const cityUnload = ($('cityUnload').value || '').trim();
  if (!cityLoad && !cityUnload) return '';
  const mode = $('supportManagerMode').value;
  if (mode === 'unified') {
    const m = $('supportManagerUnified').value;
    return 'Ваш менеджер по сопровождению ' + m + ' ' + (SUPPORT_MANAGER_PHONES[m] || '');
  }
  const lines = [];
  if (cityLoad) {
    const ml = $('supportManagerLoad').value;
    lines.push('Ваш менеджер по сопровождению на погрузке ' + ml + ' ' + (SUPPORT_MANAGER_PHONES[ml] || ''));
  }
  if (cityUnload) {
    const mu = $('supportManagerUnload').value;
    lines.push('Ваш менеджер по сопровождению на выгрузке ' + mu + ' ' + (SUPPORT_MANAGER_PHONES[mu] || ''));
  }
  return lines.join('\n');
}

function buildCalcMessage() {
  const v = computeValues();
  const name = $('clientName').value || 'Клиент';
  const manager = $('manager').value || 'Юлия';
  const volume = $('volume').value;
  const paymentMethod = $('paymentMethod').value;
  const isPrecalc = paymentMethod === 'Предрасчет';

  let msg = name + ', здравствуйте!\n';
  msg += 'Меня зовут ' + manager + ', компания Pack&Go, мы являемся партнёрами ТК Магистраль.\n\n';
  const hasLoaders = v.loadersLoad > 0 || v.loadersUnload > 0;
  if (volume || hasLoaders) {
    msg += 'Дублирую расчёт стоимости грузчиков:\n';
    msg += 'Детали:\n';
    if (volume) msg += '• Груз: ' + volume + ' м/3\n';
    msg += '\n';
    if (hasLoaders) {
      if (v.loadersLoad === v.loadersUnload) {
        msg += 'Расчет на ' + v.loadersLoad + ' ' + humanPlural(v.loadersLoad) + '.\n';
      } else {
        msg += 'Расчет на погрузку: ' + v.loadersLoad + ' ' + humanPlural(v.loadersLoad) + '.\n';
        msg += 'Расчет на выгрузку: ' + v.loadersUnload + ' ' + humanPlural(v.loadersUnload) + '.\n';
      }
    }
  }

  const buildLine = (label, city, clientCost, hours, people) => {
    const hourly = (clientCost > 0 && hours > 0 && people > 0) ? Math.round(clientCost / hours / people) : 0;
    if (isPrecalc || people === 0) {
      return '• ' + label + ' в г. ' + city + ' (' + hours + ' ' + hourPlural(hours) + '): ' + fmt(clientCost) + ' руб.';
    }
    return '• ' + label + ' в г. ' + city + ' (' + hours + ' ' + hourPlural(hours) + ' ' + people + ' ' + humanPlural(people) + ') ' + fmt(clientCost) + ' руб.'
      + (hourly ? ' (' + fmt(hourly) + ' руб. 1 человек 1 час)' : '');
  };

  const lines = [];
  if (v.cityLoad && v.clientLoad > 0) lines.push(buildLine('Погрузка', v.cityLoad, v.clientLoad, v.calcHoursLoad, v.loadersLoad));
  if ($('evacLoad').checked) lines.push('• Эвакуатор ' + (v.cityLoad || 'погрузка') + ': ' + fmt(v.evacClientLoad) + ' руб.');
  if (v.cityUnload && v.clientUnload > 0) lines.push(buildLine('Выгрузка', v.cityUnload, v.clientUnload, v.calcHoursUnload, v.loadersUnload));
  if ($('evacUnload').checked) lines.push('• Эвакуатор ' + (v.cityUnload || 'выгрузка') + ': ' + fmt(v.evacClientUnload) + ' руб.');
  if (lines.length) msg += lines.join('\n') + '\n\n';

  msg += 'Итоговая стоимость работ: ' + fmt(v.clientTotal) + ' руб.\n';
  msg += '• Предоплата для назначения грузчиков: ' + fmt(v.prepayment) + ' руб. от итоговой стоимости\n';

  if (isPrecalc) {
    msg += '\nПо времени погрузки и выгрузки мы самостоятельно информируем грузчиков.\n';
    msg += 'У нас будет связь и с вашим менеджером по сопровождению, и с водителем.\n';
    msg += 'Вам об этом беспокоиться не нужно\n\n';
    if ($('attachRequestText').checked) msg += ATTACH_REQUEST_TEXT + '\n\n';
    const smPrecalc = getSupportManagerText();
    if (smPrecalc) msg += smPrecalc + '\n\n';
    msg += 'Как вам наше предложение?';
    return msg;
  }

  const remainLines = [];
  if (v.selfLoadGruz > 0) remainLines.push('Погрузка: ' + fmt(v.selfLoadGruz) + ' руб.');
  if (v.evacSelfLoad > 0) remainLines.push('Погрузка эвакуатор: ' + fmt(v.evacSelfLoad) + ' руб.');
  if (v.selfUnloadGruz > 0) remainLines.push('Выгрузка: ' + fmt(v.selfUnloadGruz) + ' руб.');
  if (v.evacSelfUnload > 0) remainLines.push('Выгрузка эвакуатор: ' + fmt(v.evacSelfUnload) + ' руб.');
  msg += '\nПосле внесения предоплаты, остаток по адресам:\n\n';
  if (remainLines.length) msg += remainLines.join('\n') + '\n';
  if ($('attachRequestText').checked) msg += '\n' + ATTACH_REQUEST_TEXT + '\n';
  if (paymentMethod === 'Оплата по счёту') msg += '\nПредоплату необходимо внести по ссылке\n\n';
  else msg += '\nПредоплату необходимо внести по следующим реквизитам\n\n';
  if (paymentMethod && REQUISITES[paymentMethod]) msg += REQUISITES[paymentMethod] + '\n\n';
  else msg += 'Не выбран способ оплаты\n\n';
  msg += 'После внесения, отправьте чек ответным сообщением, пожалуйста\n';
  msg += '\nРеквизиты для перевода остатка суммы предоставляет менеджер Pack&Go. Грузчикам наличными, либо переводом оплачивать не нужно\n';
  msg += '\nПо времени погрузки и выгрузки мы самостоятельно информируем грузчиков.\n';
  msg += 'У нас будет связь и с вашим менеджером по сопровождению, и с водителем.\n';
  msg += 'Вам об этом беспокоиться не нужно';
  const smFinal = getSupportManagerText();
  if (smFinal) msg += '\n\n' + smFinal;
  return msg;
}

function generateMessage() {
  try { calculate(); $('messageOutput').textContent = buildCalcMessage(); }
  catch (e) { console.error(e); $('messageOutput').textContent = 'Ошибка: ' + e.message; }
}

function manualGenerate() { generateMessage(); }

// ============================================================
// КОПИРОВАНИЕ / ЛОГИРОВАНИЕ
// ============================================================
function copyText(text, emptyMsg) {
  if (!text || text.length < 20) { alert(emptyMsg || 'Сначала заполните данные'); return; }
  navigator.clipboard.writeText(text).then(() => alert('Текст скопирован'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      alert('Текст скопирован');
    });
}

function copyMessage() {
  const text = $('messageOutput').textContent;
  if (!text || text.length < 20) { alert('Сообщение ещё не сформировано'); return; }
  logCalculation();
  copyText(text, 'Сообщение ещё не сформировано');
}

function collectDetails(v) {
  return {
    volume: $('volume').value, loadersGlobal: v.globalLoaders,
    loadersLoad: v.loadersLoad, loadersUnload: v.loadersUnload,
    hoursLoad: $('hoursLoad').value, hoursUnload: $('hoursUnload').value,
    calcHoursLoad: v.calcHoursLoad, calcHoursUnload: v.calcHoursUnload,
    rateLoad: v.rateLoad, rateUnload: v.rateUnload,
    clientHourlyLoad: num('clientHourlyLoad'), clientHourlyUnload: num('clientHourlyUnload'),
    evacLoad: $('evacLoad').checked, evacUnload: $('evacUnload').checked,
    evacLoadCostUs: num('evacLoadCostUs'), evacLoadCostClient: num('evacLoadCostClient'),
    evacUnloadCostUs: num('evacUnloadCostUs'), evacUnloadCostClient: num('evacUnloadCostClient'),
    clientCostLoad: num('clientCostLoad'), clientCostUnload: num('clientCostUnload'),
    selfLoadGruz: v.selfLoadGruz, selfUnloadGruz: v.selfUnloadGruz,
    paymentMethod: $('paymentMethod').value
  };
}

// ★ FIX: не логируем повторно, если данные не менялись с прошлого логирования
function logCalculation() {
  try {
    if (!logPending) return;  // ← защита от дублей при повторном копировании
    const v = computeValues();
    const manager = $('manager').value || 'Юлия';
    const clientName = $('clientName').value || 'Без имени';
    if (!v.clientTotal) return;
    const paymentMethod = $('paymentMethod').value;
    const entry = {
      ts: Date.now(), manager, clientName,
      clientTotal: v.clientTotal, selfTotal: v.selfTotal,
      margin: v.clientTotal - v.selfTotal,
      cityLoad: v.cityLoad || '', cityUnload: v.cityUnload || '',
      loaders: v.globalLoaders || 0,
      isPrecalc: paymentMethod === 'Предрасчет',
      details: collectDetails(v)
    };
    const arr = JSON.parse(localStorage.getItem(STATS_KEY) || '[]');
    arr.unshift(entry); if (arr.length > STATS_LIMIT) arr.length = STATS_LIMIT;
    localStorage.setItem(STATS_KEY, JSON.stringify(arr));
    STATS_CACHE.unshift(entry);
    if (STATS_CACHE.length > STATS_LIMIT) STATS_CACHE.length = STATS_LIMIT;
    sendToGoogle(entry);
    logPending = false;  // ← только после успешного логирования
  } catch (e) { console.error('Ошибка логирования', e); }
}

// ============================================================
// ОЧИСТКА / УСЛОВНЫЕ БЛОКИ
// ============================================================
function clearClientBlock() {
  if (!confirm('Очистить блок «Клиент и груз»?')) return;
  markChanged();
  $('clientName').value = ''; $('volume').value = ''; $('loaders').value = '';
  calculate(); generateMessage();
}

function clearLoadBlock() {
  if (!confirm('Очистить блок «Погрузка»?')) return;
  markChanged();
  ['cityLoad','hoursLoad','rateBrigadierManualLoad','clientCostLoad','clientHourlyLoad',
   'loadersLoad','evacLoadCostUs','evacLoadCostClient'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  ['loadersLoadOverride','evacLoad'].forEach(id => {
    const el = $(id); if (el) el.checked = false;
  });
  $('hoursLoad').value = '2';
  updateConditionalBlocks(); calculate(); generateMessage();
}

function clearUnloadBlock() {
  if (!confirm('Очистить блок «Выгрузка»?')) return;
  markChanged();
  ['cityUnload','hoursUnload','rateBrigadierManualUnload','clientCostUnload','clientHourlyUnload',
   'loadersUnload','evacUnloadCostUs','evacUnloadCostClient'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  ['loadersUnloadOverride','evacUnload'].forEach(id => {
    const el = $(id); if (el) el.checked = false;
  });
  $('hoursUnload').value = '2';
  updateConditionalBlocks(); calculate(); generateMessage();
}

function updateConditionalBlocks() {
  $('evacLoadBlock').style.display = $('evacLoad').checked ? 'block' : 'none';
  $('evacUnloadBlock').style.display = $('evacUnload').checked ? 'block' : 'none';
  $('loadersLoadBlock').style.display = $('loadersLoadOverride').checked ? 'block' : 'none';
  $('loadersUnloadBlock').style.display = $('loadersUnloadOverride').checked ? 'block' : 'none';
  const showSM = $('showSupportManager').checked;
  $('supportManagerBlock').style.display = showSM ? 'block' : 'none';
  if (showSM) {
    const mode = $('supportManagerMode').value;
    $('supportManagerUnifiedBlock').style.display = mode === 'unified' ? 'block' : 'none';
    $('supportManagerSeparateBlock').style.display = mode === 'separate' ? 'block' : 'none';
  }
}

// ============================================================
// PDF
// ============================================================
function fillPdfTemplate() {
  const v = computeValues();
  const name = $('clientName').value || 'Клиент';
  const manager = $('manager').value || 'Юлия';
  const volume = $('volume').value;
  const paymentMethod = $('paymentMethod').value;
  const isPrecalc = paymentMethod === 'Предрасчет';
  $('pdfTitle').textContent = isPrecalc ? 'Предварительный расчёт' : 'Коммерческое предложение';
  $('pdfDate').textContent = new Date().toLocaleDateString('ru-RU');
  $('pdfManager').textContent = manager;
  $('pdfClientName').textContent = name;
  $('pdfVolume').textContent = volume ? volume + ' м³' : '—';

  const rows = [];
  const mkRow = (label, city, cost, hours, people) => {
    const hourly = (cost > 0 && hours > 0 && people > 0) ? Math.round(cost / hours / people) : 0;
    let hoursStr = hours + ' ч';
    if (people > 0) hoursStr += ' × ' + people + ' чел';
    let priceStr = fmt(cost) + ' ₽';
    if (!isPrecalc && hourly > 0) priceStr += '<br><span class="pdf-small">' + fmt(hourly) + ' ₽/чел/ч</span>';
    return { name: label + ', г. ' + city, hours: hoursStr, price: priceStr };
  };
  if (v.cityLoad && v.clientLoad > 0) rows.push(mkRow('Погрузка', v.cityLoad, v.clientLoad, v.calcHoursLoad, v.loadersLoad));
  if ($('evacLoad').checked && v.evacClientLoad > 0) rows.push({ name: 'Эвакуатор, ' + (v.cityLoad || 'погрузка'), hours: '—', price: fmt(v.evacClientLoad) + ' ₽' });
  if (v.cityUnload && v.clientUnload > 0) rows.push(mkRow('Выгрузка', v.cityUnload, v.clientUnload, v.calcHoursUnload, v.loadersUnload));
  if ($('evacUnload').checked && v.evacClientUnload > 0) rows.push({ name: 'Эвакуатор, ' + (v.cityUnload || 'выгрузка'), hours: '—', price: fmt(v.evacClientUnload) + ' ₽' });

  $('pdfServiceRows').innerHTML = rows.length ? rows.map(r => `<tr><td>${r.name}</td><td>${r.hours}</td><td class="num">${r.price}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:20px;">Услуги не выбраны</td></tr>';
  $('pdfTotal').textContent = fmt(v.clientTotal) + ' ₽';
  $('pdfPrepay').textContent = fmt(v.prepayment) + ' ₽';
  $('pdfRemainBlock').style.display = isPrecalc ? 'none' : 'block';
  $('pdfPaymentBlock').style.display = isPrecalc ? 'none' : 'block';

  const rem = [];
  if (v.selfLoadGruz > 0) rem.push('Погрузка: ' + fmt(v.selfLoadGruz) + ' ₽');
  if (v.evacSelfLoad > 0) rem.push('Погрузка эвакуатор: ' + fmt(v.evacSelfLoad) + ' ₽');
  if (v.selfUnloadGruz > 0) rem.push('Выгрузка: ' + fmt(v.selfUnloadGruz) + ' ₽');
  if (v.evacSelfUnload > 0) rem.push('Выгрузка эвакуатор: ' + fmt(v.evacSelfUnload) + ' ₽');
  $('pdfRemainLines').innerHTML = rem.length ? rem.map(l => `<p>${l}</p>`).join('') : '<p style="color:#9ca3af;">—</p>';

  if (paymentMethod === 'Оплата по счёту') $('pdfPaymentText').textContent = 'Предоплату необходимо внести по ссылке.';
  else if (paymentMethod === 'Оплата по самозанятости') $('pdfPaymentText').textContent = 'Предоплату необходимо внести по следующим реквизитам.';
  else if (isPrecalc) $('pdfPaymentText').textContent = '';
  else $('pdfPaymentText').textContent = 'Способ оплаты не выбран.';
  $('pdfRequisites').textContent = (paymentMethod && REQUISITES[paymentMethod]) ? REQUISITES[paymentMethod] : '';
}

function downloadPdf() {
  const text = $('messageOutput').textContent;
  if (!text || text.length < 20) { alert('Сначала заполните данные и сформируйте сообщение'); return; }
  fillPdfTemplate();
  setTimeout(() => window.print(), 100);
}