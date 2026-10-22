// ============================================================
// ЗАЯВКИ БРИГАДИРАМ
// ============================================================
function generateBrigadierRequests() {
  const payment = $('brPayment').value;
  let paymentText = 'не указана';
  if (payment === 'счёт') paymentText = 'по счету';
  else if (payment === 'нал(перевод)') paymentText = 'нал(перевод)';

  const cargo = $('brCargo').value;
  const volume = $('brVolume').value;

  const addrL = $('brAddressLoad').value;
  const liftL = $('brElevatorLoad').value;
  const floorL = $('brFloorLoad').value;
  const worksL = ['погрузка'];
  if ($('brWorkLoad2').checked) worksL.push('упаковка');
  if ($('brWorkLoad3').checked) worksL.push('разборка');
  const commentL = $('brCommentLoad').value;

  const partsL = ['Сориентируйте почасовую оплату, пожалуйста.', 'Оплата: ' + paymentText, 'Работы: ' + worksL.join('/')];
  if (addrL) partsL.push('Адрес: ' + addrL);
  if (liftL) partsL.push('Лифт: ' + liftL);
  if (floorL) partsL.push('Этаж: ' + floorL);
  if (cargo) partsL.push('Груз: ' + cargo);
  if (volume) partsL.push('Объём: ' + volume + ' м³');
  if (commentL) partsL.push('Комментарий: ' + commentL);
  const msgL = partsL.join('\n\n');

  const addrU = $('brAddressUnload').value;
  const liftU = $('brElevatorUnload').value;
  const floorU = $('brFloorUnload').value;
  const worksU = ['выгрузка'];
  if ($('brWorkUnload4').checked) worksU.push('сборка');
  const commentU = $('brCommentUnload').value;

  const partsU = ['Сориентируйте почасовую оплату, пожалуйста.', 'Оплата: ' + paymentText, 'Работы: ' + worksU.join('/')];
  if (addrU) partsU.push('Адрес: ' + addrU);
  if (liftU) partsU.push('Лифт: ' + liftU);
  if (floorU) partsU.push('Этаж: ' + floorU);
  if (cargo) partsU.push('Груз: ' + cargo);
  if (volume) partsU.push('Объём: ' + volume + ' м³');
  if (commentU) partsU.push('Комментарий: ' + commentU);
  const msgU = partsU.join('\n\n');

  $('brOutputLoad').textContent = msgL;
  $('brOutputUnload').textContent = msgU;
  $('brOutputBoth').textContent = msgL + '\n\n———\n\n' + msgU;
  saveState();
}

function copyBrLoad()   { copyText($('brOutputLoad').textContent, 'Заявка ещё не сформирована'); }
function copyBrUnload() { copyText($('brOutputUnload').textContent, 'Заявка ещё не сформирована'); }
function copyBrBoth()   { copyText($('brOutputBoth').textContent, 'Заявки ещё не сформированы'); }

// ============================================================
// СПРАВОЧНИКИ ФИЛЬТРОВ
// ============================================================
function fillBrigFilterOptions() {
  const regions = [...new Set(BRIGADIERS_CACHE.map(b => b.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const cities = [...new Set(BRIGADIERS_CACHE.map(b => b.city).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  $('brigRegionsList').innerHTML = regions.map(r => `<option value="${escapeHtml(r)}"></option>`).join('');
  $('brigCitiesList').innerHTML = cities.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
}

// ============================================================
// ТЕЛЕФОНЫ
// ============================================================
function normalizePhoneDigits(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  digits = digits.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits;
}
function phoneToTgLink(raw) {
  const digits = normalizePhoneDigits(raw);
  if (digits.length !== 11 || digits[0] !== '7') return '';
  return 'https://t.me/+7' + digits.slice(1);
}
function formatPhoneDisplay(raw) {
  const digits = normalizePhoneDigits(raw);
  if (digits.length !== 11) return String(raw || '').trim();
  return '+7 ' + digits.slice(1, 4) + ' ' + digits.slice(4, 7) + '-' + digits.slice(7, 9) + '-' + digits.slice(9, 11);
}

// ============================================================
// РЕНДЕР КАРТОЧЕК
// ============================================================
function renderStars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += (i <= n ? '★' : '<span class="empty">☆</span>');
  return s;
}

function getFilteredBrigadiers() {
  const q = ($('brigSearch').value || '').trim().toLowerCase();
  const regionFilter = ($('brigFilterRegion').value || '').trim().toLowerCase();
  const cityFilter = ($('brigFilterCity').value || '').trim().toLowerCase();
  const inv = $('brigFilterInvoice').value;
  const minRating = parseInt($('brigFilterRating').value, 10) || 0;
  const sortMode = $('brigSort').value || 'city-asc';
  let list = BRIGADIERS_CACHE.filter(b => {
    if (regionFilter) {
      const val = String(b.region || '').toLowerCase();
      if (val !== regionFilter && !val.includes(regionFilter)) return false;
    }
    if (cityFilter) {
      const val = String(b.city || '').toLowerCase();
      if (val !== cityFilter && !val.includes(cityFilter)) return false;
    }
    if (inv === 'yes' && !b.byInvoice) return false;
    if (inv === 'no' && b.byInvoice) return false;
    if (minRating > 0 && (b.rating || 0) < minRating) return false;
    if (q) {
      const hay = [b.city, b.region, b.name, b.phone, b.ratingReason, b.priceRS, b.priceNal]
        .filter(Boolean).join(' ').toLowerCase();
      let matched = hay.includes(q);
      if (!matched) {
        const qDigits = q.replace(/\D/g, '');
        if (qDigits.length >= 3) {
          const phoneDigits = normalizePhoneDigits(b.phone);
          if (phoneDigits && phoneDigits.includes(qDigits)) matched = true;
        }
      }
      if (!matched) return false;
    }
    return true;
  });
  const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), 'ru');
  list.sort((a, b) => {
    switch (sortMode) {
      case 'city-asc': return cmpStr(a.city, b.city);
      case 'city-desc': return cmpStr(b.city, a.city);
      case 'region-asc': return cmpStr(a.region, b.region);
      case 'region-desc': return cmpStr(b.region, a.region);
      case 'name-asc': return cmpStr(a.name, b.name);
      case 'name-desc': return cmpStr(b.name, a.name);
      case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
      case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
      default: return cmpStr(a.city, b.city);
    }
  });
  return list;
}

function renderBrigadiers() {
  const list = getFilteredBrigadiers();
  $('brigStatsBadge').textContent = list.length + ' из ' + BRIGADIERS_CACHE.length;
  if (list.length === 0) {
    $('brigListWrap').innerHTML = '<div class="brig-empty">Ничего не найдено. Измените фильтры или добавьте нового подрядчика.</div>';
    return;
  }
  const cards = list.map(b => {
    const stars = renderStars(b.rating);
    const invoice = b.byInvoice
      ? '<span class="brig-invoice-yes">✓ по счёту</span>'
      : '<span class="brig-invoice-no">— без счёта</span>';
    const prices = [];
    if (b.priceRS) prices.push('<span>РС: <span class="brig-card-price">' + escapeHtml(b.priceRS) + '</span></span>');
    if (b.priceNal) prices.push('<span>Нал: <span class="brig-card-price">' + escapeHtml(b.priceNal) + '</span></span>');

    const rawPhone = String(b.phone || '').trim();
    const phoneDisplay = formatPhoneDisplay(rawPhone);
    const tgLink = phoneToTgLink(rawPhone);
    let phoneBlock = '';
    if (phoneDisplay || tgLink) {
      phoneBlock = '<div class="brig-card-phone">';
      if (phoneDisplay) phoneBlock += '<span>' + escapeHtml(phoneDisplay) + '</span>';
      if (tgLink) phoneBlock += '<a class="brig-tg" href="' + tgLink + '" target="_blank" rel="noopener" title="Написать в Telegram">Бульк</a>';
      phoneBlock += '</div>';
    }

    return `<div class="brig-card">
      <div class="brig-card-head">
        <div>
          <div class="brig-card-city">${escapeHtml(b.city || 'Без города')}</div>
          ${b.region ? `<div class="brig-card-region">${escapeHtml(b.region)}</div>` : ''}
        </div>
        <div class="brig-card-actions">
          <button class="edit" onclick="openBrigadierModal('${escapeHtml(b.id)}')" title="Редактировать">✎</button>
          <button class="del" onclick="deleteBrigadier('${escapeHtml(b.id)}')" title="Удалить">🗑</button>
        </div>
      </div>
      <div class="brig-card-name">${escapeHtml(b.name || '—')}</div>
      ${phoneBlock}
      <div class="brig-card-row">
        <span class="brig-card-stars">${stars}</span>
        ${invoice}
      </div>
      ${prices.length ? `<div class="brig-card-row">${prices.join('')}</div>` : ''}
      ${b.ratingReason ? `<div class="brig-card-reason" title="${escapeHtml(b.ratingReason)}">${escapeHtml(b.ratingReason)}</div>` : ''}
    </div>`;
  }).join('');
  $('brigListWrap').innerHTML = '<div class="brig-grid">' + cards + '</div>';
}

function resetBrigFilters() {
  $('brigSearch').value = '';
  $('brigFilterRegion').value = '';
  $('brigFilterCity').value = '';
  $('brigFilterInvoice').value = '';
  $('brigFilterRating').value = '';
  $('brigSort').value = 'city-asc';
  renderBrigadiers();
}

// ============================================================
// НОРМАЛИЗАЦИЯ РЕГИОНОВ / ГОРОДОВ
// ============================================================
function normalizeGeoName(s) {
  return String(s || '')
    .trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bобл\.?\b/g, 'область')
    .replace(/\bобл\b/g, 'область')
    .replace(/\bресп\.?\b/g, 'республика')
    .replace(/\bресп\b/g, 'республика')
    .replace(/\bг\./g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ').trim();
}
function findCanonicalRegion(raw) {
  if (!raw) return raw;
  const norm = normalizeGeoName(raw);
  const match = BRIGADIERS_CACHE.find(b => b.region && normalizeGeoName(b.region) === norm);
  return match ? match.region : raw;
}
function findCanonicalCity(raw) {
  if (!raw) return raw;
  const norm = normalizeGeoName(raw);
  const match = BRIGADIERS_CACHE.find(b => b.city && normalizeGeoName(b.city) === norm);
  return match ? match.city : raw;
}

// ============================================================
// ДУБЛИКАТЫ
// ============================================================
function collectVariants(fieldName) {
  const map = new Map();
  BRIGADIERS_CACHE.forEach(b => {
    const raw = String(b[fieldName] || '').trim();
    if (!raw) return;
    const norm = normalizeGeoName(raw);
    if (!map.has(norm)) map.set(norm, new Map());
    const inner = map.get(norm);
    inner.set(raw, (inner.get(raw) || 0) + 1);
  });
  const groups = [];
  map.forEach((innerMap, norm) => {
    if (innerMap.size > 1) {
      const variants = [...innerMap.entries()]
        .map(([raw, count]) => ({ raw, count }))
        .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw, 'ru'));
      groups.push({ fieldName, variants });
    }
  });
  return groups;
}

let dupGroupsCache = [];

function openDuplicatesModal() {
  dupGroupsCache = [
    ...collectVariants('region').map(g => ({...g, label: 'Регион'})),
    ...collectVariants('city').map(g => ({...g, label: 'Город'}))
  ];
  renderDuplicatesModal();
  $('dupModal').classList.add('open');
}
function closeDuplicatesModal() { $('dupModal').classList.remove('open'); }

function renderDuplicatesModal() {
  const body = $('dupModalBody');
  if (dupGroupsCache.length === 0) {
    body.innerHTML = '<div class="dup-empty">Дубликатов не найдено — все названия регионов и городов уникальны. 🎉</div>';
    return;
  }
  body.innerHTML = dupGroupsCache.map((g, gi) => {
    const variantsHtml = g.variants.map((v, vi) => {
      const checked = vi === 0 ? 'checked' : '';
      const cls = vi === 0 ? 'dup-variant canonical' : 'dup-variant';
      // ★ FIX: плюрализация через recordsPlural (было «21 записей» вместо «21 запись»)
      return `<label class="${cls}">
        <input type="radio" name="dup-${gi}" value="${escapeHtml(v.raw)}" ${checked} onchange="markCanonical(${gi}, ${vi})">
        <span class="dup-name">${escapeHtml(v.raw)}</span>
        <span class="dup-count">${v.count} ${recordsPlural(v.count)}</span>
      </label>`;
    }).join('');
    return `<div class="dup-group" data-gi="${gi}">
      <div class="dup-group-title">${g.label}: ${g.variants.length} варианта названия</div>
      ${variantsHtml}
      <div class="dup-actions">
        <button class="btn btn-primary" style="padding:6px 14px; font-size:13px;" onclick="mergeDupGroup(${gi})">Объединить в выбранный</button>
      </div>
    </div>`;
  }).join('');
}

function markCanonical(gi, vi) {
  const group = document.querySelector(`.dup-group[data-gi="${gi}"]`);
  if (!group) return;
  group.querySelectorAll('.dup-variant').forEach((el, i) => {
    el.classList.toggle('canonical', i === vi);
  });
}
function getSelectedCanonical(gi) {
  const checked = document.querySelector(`input[name="dup-${gi}"]:checked`);
  return checked ? checked.value : null;
}

async function mergeDupGroup(gi) {
  const g = dupGroupsCache[gi];
  if (!g) return;
  const canonical = getSelectedCanonical(gi);
  if (!canonical) { alert('Выберите основной вариант'); return; }
  await applyMerge(g.fieldName, g.variants.map(v => v.raw), canonical);
  dupGroupsCache = [
    ...collectVariants('region').map(x => ({...x, label: 'Регион'})),
    ...collectVariants('city').map(x => ({...x, label: 'Город'}))
  ];
  renderDuplicatesModal();
  fillBrigFilterOptions();
  renderBrigadiers();
}
async function autoMergeAllDuplicates() {
  if (dupGroupsCache.length === 0) return;
  if (!confirm('Объединить все ' + dupGroupsCache.length + ' групп? В каждой будет выбран самый частый вариант.')) return;
  for (const g of dupGroupsCache) {
    const canonical = g.variants[0].raw;
    await applyMerge(g.fieldName, g.variants.map(v => v.raw), canonical);
  }
  dupGroupsCache = [
    ...collectVariants('region').map(x => ({...x, label: 'Регион'})),
    ...collectVariants('city').map(x => ({...x, label: 'Город'}))
  ];
  renderDuplicatesModal();
  fillBrigFilterOptions();
  renderBrigadiers();
}
async function applyMerge(fieldName, allVariants, canonical) {
  const toUpdate = BRIGADIERS_CACHE.filter(b => {
    const val = String(b[fieldName] || '').trim();
    return val && val !== canonical && allVariants.includes(val);
  });
  if (toUpdate.length === 0) return;
  let ok = 0, fail = 0;
  for (const b of toUpdate) {
    const payload = { ...b, [fieldName]: canonical, type: 'brigadier_save' };
    try {
      const r = await fetchWithRetry(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      b[fieldName] = canonical;
      ok++;
    } catch (e) {
      console.warn('Ошибка обновления:', b.id, e);
      fail++;
    }
  }
  if (fail > 0) alert('Обновлено: ' + ok + ', ошибок: ' + fail);
}

// ============================================================
// CRUD ПОДРЯДЧИКОВ
// ============================================================
function openBrigadierModal(id) {
  brigEditingId = id || null;
  if (id) {
    const b = BRIGADIERS_CACHE.find(x => x.id === id);
    if (!b) { alert('Подрядчик не найден'); return; }
    $('brigModalTitle').textContent = 'Редактирование подрядчика';
    $('brigCity').value = b.city || '';
    $('brigRegion').value = b.region || '';
    $('brigName').value = b.name || '';
    $('brigPhone').value = b.phone || '';
    $('brigByInvoice').checked = !!b.byInvoice;
    setBrigRating(b.rating || 0);
    $('brigRatingReason').value = b.ratingReason || '';
    $('brigPriceRS').value = b.priceRS || '';
    $('brigPriceNal').value = b.priceNal || '';
  } else {
    $('brigModalTitle').textContent = 'Новый подрядчик';
    ['brigCity','brigRegion','brigName','brigPhone','brigRatingReason','brigPriceRS','brigPriceNal']
      .forEach(k => { $(k).value = ''; });
    $('brigByInvoice').checked = false;
    setBrigRating(0);
  }
  $('brigModal').classList.add('open');
  setTimeout(() => $('brigName').focus(), 50);
}
function closeBrigModal() {
  $('brigModal').classList.remove('open');
  brigEditingId = null;
}
function setBrigRating(n) {
  brigRating = n;
  document.querySelectorAll('#brigRatingInput button[data-star]').forEach(btn => {
    const s = parseInt(btn.dataset.star, 10);
    btn.classList.toggle('active', s <= n);
  });
}

async function saveBrigadier() {
  const rawCity = $('brigCity').value.trim();
  const rawRegion = $('brigRegion').value.trim();
  const payload = {
    type: 'brigadier_save',
    id: brigEditingId || '',
    city: findCanonicalCity(rawCity) || rawCity,
    region: findCanonicalRegion(rawRegion) || rawRegion,
    name: $('brigName').value.trim(),
    phone: $('brigPhone').value.trim(),
    byInvoice: $('brigByInvoice').checked,
    rating: brigRating,
    ratingReason: $('brigRatingReason').value.trim(),
    priceRS: $('brigPriceRS').value.trim(),
    priceNal: $('brigPriceNal').value.trim()
  };
  if (!payload.name && !payload.city && !payload.phone) { alert('Заполните хотя бы имя, город или телефон'); return; }
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload), redirect: 'follow'
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (data.action === 'created') payload.id = data.id;
    // ★ FIX: убираем служебное поле type из кэша
    const { type, ...cleanPayload } = payload;
    if (brigEditingId) {
      const idx = BRIGADIERS_CACHE.findIndex(b => b.id === brigEditingId);
      if (idx >= 0) BRIGADIERS_CACHE[idx] = cleanPayload;
    } else {
      cleanPayload.id = data.id || ('bg_' + Date.now());
      BRIGADIERS_CACHE.push(cleanPayload);
    }
    fillBrigFilterOptions();
    renderBrigadiers();
    closeBrigModal();
  } catch (e) { alert('Ошибка сохранения: ' + e.message); }
}

async function deleteBrigadier(id) {
  const b = BRIGADIERS_CACHE.find(x => x.id === id);
  if (!b) return;
  if (!confirm('Удалить подрядчика «' + (b.name || b.city || id) + '»?')) return;
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'brigadier_delete', id }), redirect: 'follow'
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    BRIGADIERS_CACHE = BRIGADIERS_CACHE.filter(x => x.id !== id);
    fillBrigFilterOptions();
    renderBrigadiers();
  } catch (e) { alert('Ошибка удаления: ' + e.message); }
}

async function refreshBrigadiers() {
  try {
    const r = await fetchWithRetry(APPS_SCRIPT_URL + '?t=' + Date.now(), { redirect: 'follow' });
    const data = await r.json();
    if (Array.isArray(data.brigadiers)) {
      BRIGADIERS_CACHE = data.brigadiers;
      fillBrigFilterOptions();
      renderBrigadiers();
    }
  } catch (e) { alert('Ошибка обновления: ' + e.message); }
}