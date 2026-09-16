/**
 * Admin-only screen: per-branch capacity/hours/PIN/blocked-dates/event
 * overrides, plus restaurant-wide settings. Every field change saves
 * immediately (no separate "Save" button) — each input's change handler
 * calls one of the two push* functions at the bottom of this file.
 */

import { el } from '../dom.js';
import { state } from '../state.js';
import { DAY_NAMES } from '../i18n.js';
import { apiFetch } from '../api.js';
import { render } from '../render.js';

export function renderAdminSettings() {
  const wrap = el('div', {});
  const grid = el('div', { class: 'admin-grid' });

  state.config.branches.forEach((branch) => grid.appendChild(renderBranchCard(branch)));
  wrap.appendChild(grid);
  wrap.appendChild(renderGlobalSettingsCard());
  return wrap;
}

function renderBranchCard(branch) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { style: 'font-size:16px;' }, [branch.name]));
  card.appendChild(el('div', { class: 'hint' }, [branch.city]));

  card.appendChild(renderCapacityField(branch));
  card.appendChild(renderClosedDayField(branch));
  card.appendChild(renderPinField(branch));
  card.appendChild(renderBlockedDatesField(branch));
  card.appendChild(renderCapacityOverridesField(branch));

  return card;
}

function renderCapacityField(branch) {
  const field = el('div', { class: 'field' }, [el('label', {}, ['Standard capacity (seats)'])]);
  const input = el('input', { type: 'number', min: '1', value: String(branch.capacity) });
  input.addEventListener('change', (e) => {
    branch.capacity = Number(e.target.value) || branch.capacity;
    pushBranchSettings(branch);
  });
  field.appendChild(input);
  return field;
}

function renderClosedDayField(branch) {
  const field = el('div', { class: 'field' }, [el('label', {}, ['Closed on'])]);
  const select = el('select');

  const noneOption = el('option', { value: 'none' }, ['Open every day']);
  if (branch.closedDay === null) noneOption.setAttribute('selected', 'selected');
  select.appendChild(noneOption);

  DAY_NAMES.forEach((dayName, dayIndex) => {
    const option = el('option', { value: String(dayIndex) }, [dayName]);
    if (branch.closedDay === dayIndex) option.setAttribute('selected', 'selected');
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    branch.closedDay = e.target.value === 'none' ? null : Number(e.target.value);
    pushBranchSettings(branch);
  });
  field.appendChild(select);
  return field;
}

function renderPinField(branch) {
  const field = el('div', { class: 'field' }, [el('label', {}, ['Staff PIN'])]);
  const input = el('input', { type: 'text', value: branch.pin });
  input.addEventListener('change', (e) => {
    branch.pin = e.target.value.trim() || branch.pin;
    pushBranchSettings(branch);
  });
  field.appendChild(input);
  return field;
}

function renderBlockedDatesField(branch) {
  const wrap = el('div', {});
  wrap.appendChild(el('label', {}, ['Blocked dates (fully closed)']));

  const tagList = el('div', { class: 'tag-list' });
  (branch.blockedDates || []).forEach((date) => {
    tagList.appendChild(el('span', { class: 'tag' }, [
      date,
      el('button', {
        onClick: () => { branch.blockedDates = branch.blockedDates.filter((d) => d !== date); pushBranchSettings(branch); },
      }, ['×']),
    ]));
  });
  wrap.appendChild(tagList);

  const addRow = el('div', { style: 'display:flex;gap:8px;margin-top:8px;' });
  const dateInput = el('input', { type: 'date', style: 'flex:1;padding:8px;border:1px solid var(--line);border-radius:4px;' });
  addRow.appendChild(dateInput);
  addRow.appendChild(el('button', {
    class: 'btn btn-ghost', style: 'padding:8px 12px;font-size:12.5px;',
    onClick: () => {
      if (!dateInput.value) return;
      branch.blockedDates = branch.blockedDates || [];
      if (!branch.blockedDates.includes(dateInput.value)) branch.blockedDates.push(dateInput.value);
      pushBranchSettings(branch);
    },
  }, ['Block']));
  wrap.appendChild(addRow);

  return wrap;
}

function renderCapacityOverridesField(branch) {
  const wrap = el('div', {});
  wrap.appendChild(el('label', { style: 'margin-top:14px;display:block;' }, ['Event capacity override (specific date, optionally a specific time window)']));
  wrap.appendChild(el('div', { class: 'hint', style: 'margin:2px 0 8px;' }, ['Leave the time fields blank to override the whole day. Set both to limit it to a window, e.g. 18:00–22:00 for an evening event.']));

  const overrides = branch.capacityOverrides || [];
  const tagList = el('div', { class: 'tag-list' });
  overrides.forEach((override, index) => {
    const windowLabel = (override.startTime && override.endTime)
      ? `${override.startTime}–${override.endTime}`
      : 'all day';
    tagList.appendChild(el('span', { class: 'tag' }, [
      `${override.date} (${windowLabel}): ${override.capacity} seats`,
      el('button', {
        onClick: () => {
          branch.capacityOverrides = branch.capacityOverrides.filter((_, i) => i !== index);
          pushBranchSettings(branch);
        },
      }, ['×']),
    ]));
  });
  wrap.appendChild(tagList);

  const row = el('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:flex-end;' });
  const inputStyle = 'padding:8px;border:1px solid var(--line);border-radius:4px;';

  const dateInput = el('input', { type: 'date', style: inputStyle + 'flex:1;min-width:130px;' });
  const startInput = el('input', { type: 'time', style: inputStyle + 'width:110px;' });
  const endInput = el('input', { type: 'time', style: inputStyle + 'width:110px;' });
  const capacityInput = el('input', { type: 'number', placeholder: 'Seats', style: inputStyle + 'width:90px;' });

  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Date']), dateInput]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['From (optional)']), startInput]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['To (optional)']), endInput]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Capacity']), capacityInput]));
  wrap.appendChild(row);

  wrap.appendChild(el('button', {
    class: 'btn btn-ghost', style: 'padding:8px 12px;font-size:12.5px;margin-top:8px;',
    onClick: () => {
      if (!dateInput.value || !capacityInput.value) return;
      const hasWindow = !!(startInput.value && endInput.value);
      branch.capacityOverrides = branch.capacityOverrides || [];
      branch.capacityOverrides.push({
        date: dateInput.value,
        capacity: Number(capacityInput.value),
        ...(hasWindow ? { startTime: startInput.value, endTime: endInput.value } : {}),
      });
      pushBranchSettings(branch);
    },
  }, ['Set override']));

  return wrap;
}

function renderGlobalSettingsCard() {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { style: 'font-size:16px;' }, ['Global settings']));

  const hoursRow = el('div', { class: 'field-row' });
  const openInput = el('input', { type: 'time', value: state.config.openTime });
  openInput.addEventListener('change', (e) => { state.config.openTime = e.target.value; pushGlobalSettings(); });
  const closeInput = el('input', { type: 'time', value: state.config.closeTime });
  closeInput.addEventListener('change', (e) => { state.config.closeTime = e.target.value; pushGlobalSettings(); });
  hoursRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Opening time']), openInput]));
  hoursRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Closing time']), closeInput]));
  card.appendChild(hoursRow);

  const timingRow = el('div', { class: 'field-row' });
  const durationInput = el('input', { type: 'number', min: '15', step: '15', value: String(state.config.bookingDurationMinutes) });
  durationInput.addEventListener('change', (e) => {
    state.config.bookingDurationMinutes = Number(e.target.value) || state.config.bookingDurationMinutes;
    pushGlobalSettings();
  });
  const intervalInput = el('input', { type: 'number', min: '5', step: '5', value: String(state.config.slotIntervalMinutes) });
  intervalInput.addEventListener('change', (e) => {
    state.config.slotIntervalMinutes = Number(e.target.value) || state.config.slotIntervalMinutes;
    pushGlobalSettings();
  });
  timingRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Booking duration (minutes per table hold)']), durationInput]));
  timingRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Slot interval (minutes between offered times)']), intervalInput]));
  card.appendChild(timingRow);

  const adminPinField = el('div', { class: 'field' }, [el('label', {}, ['Administrator PIN'])]);
  const adminPinInput = el('input', { type: 'text', value: state.config.adminPin });
  adminPinInput.addEventListener('change', (e) => {
    state.config.adminPin = e.target.value.trim() || state.config.adminPin;
    pushGlobalSettings();
  });
  adminPinField.appendChild(adminPinInput);
  card.appendChild(adminPinField);

  return card;
}

async function pushBranchSettings(branch) {
  try {
    await apiFetch('PATCH', '/api/admin/branches/' + encodeURIComponent(branch.id), {
      capacity: branch.capacity, closedDay: branch.closedDay, pin: branch.pin,
      blockedDates: branch.blockedDates, capacityOverrides: branch.capacityOverrides,
    }, true);
  } catch (err) { /* re-render shows whatever the server actually persisted, on next full refresh */ }
  render();
}

async function pushGlobalSettings() {
  try {
    await apiFetch('PATCH', '/api/admin/settings', {
      openTime: state.config.openTime,
      closeTime: state.config.closeTime,
      bookingDurationMinutes: state.config.bookingDurationMinutes,
      slotIntervalMinutes: state.config.slotIntervalMinutes,
      adminPin: state.config.adminPin,
    }, true);
  } catch (err) { /* see pushBranchSettings() */ }
  render();
}
