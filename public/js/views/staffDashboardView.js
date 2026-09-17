/**
 * The staff/admin reservations dashboard: today's bookings for a branch
 * (or every branch, for an admin), status changes, cancel/delete, and
 * adding phone/walk-in bookings manually.
 */

import { el } from '../dom.js';
import { state, getBranch, todayISO } from '../state.js';
import { STATUS_LABELS } from '../i18n.js';
import { t } from '../i18n.js';
import { apiFetch } from '../api.js';
import { render } from '../render.js';
import { renderAdminSettings } from './adminSettingsView.js';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'arrived', 'seated'];

function statusLabel(status) {
  return String(status).replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderStaffDash() {
  const wrap = el('div', {});
  const isAdmin = state.staffBranchId === null;
  const branchLabel = isAdmin
    ? 'All branches (Administrator)'
    : getBranch(state.staffBranchId).name + ' — ' + getBranch(state.staffBranchId).city;

  const header = el('div', { class: 'dash-header' }, [
    el('div', {}, [
      el('div', {
        style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;margin-bottom:2px;',
      }, ['TableSpot']),
      el('h1', {}, ['Reservations']),
      el('div', { style: 'color:#6b7770;font-size:13px;' }, [branchLabel]),
    ]),
    el('button', {
      class: 'btn btn-ghost',
      onClick: () => {
        state.loggedIn = false; state.staffBranchId = null; state.staffToken = null;
        state.staffLoginTarget = null; state.staffPinInput = ''; state.view = 'staffLogin';
        render();
      },
    }, ['Log out']),
  ]);
  wrap.appendChild(header);

  const tabs = el('div', { class: 'tabs2' });
  tabs.appendChild(el('button', {
    class: 'tab2' + (state.dashTab === 'today' ? ' active' : ''),
    onClick: () => { state.dashTab = 'today'; render(); },
  }, ['Bookings']));
  if (isAdmin) {
    tabs.appendChild(el('button', {
      class: 'tab2' + (state.dashTab === 'admin' ? ' active' : ''),
      onClick: () => { state.dashTab = 'admin'; render(); },
    }, ['Branch settings']));
  }
  wrap.appendChild(tabs);

  if (state.dashTab === 'admin' && isAdmin) {
    wrap.appendChild(renderAdminSettings());
    return wrap;
  }

  const layout = el('div', { class: 'dash-layout' });
  layout.appendChild(el('div', { class: 'dash-sidebar' }, [renderCalendarWidget(), renderWeeklyChart()]));
  layout.appendChild(el('div', { class: 'dash-main' }, [renderBookingsPanel(isAdmin)]));
  wrap.appendChild(layout);

  if (state.showAddForm) wrap.appendChild(renderAddBookingModal());
  const selectedBooking = state.dashBookings.find((b) => b.id === state.selectedBookingId);
  if (selectedBooking) wrap.appendChild(renderBookingDetailPanel(selectedBooking, isAdmin));
  return wrap;
}

export async function refreshDashBookings() {
  state.dashLoading = true;
  render();
  const isAdmin = state.staffBranchId === null;
  try {
    const url = '/api/bookings?branchId=' + encodeURIComponent(isAdmin ? 'all' : state.staffBranchId) +
      '&date=' + encodeURIComponent(state.dashDate) +
      (state.dashSearch ? '&search=' + encodeURIComponent(state.dashSearch) : '');
    state.dashBookings = await apiFetch('GET', url, undefined, true);
  } catch (err) {
    state.dashBookings = [];
  }
  state.dashLoading = false;
  render();
}

/**
 * Guests booked per day for the last 7 days (today and the 6 days before
 * it), for the "This week" sidebar chart. Fetched once after login —
 * not tied to whichever date the main list happens to be showing.
 */
export async function fetchWeeklyActivity() {
  const isAdmin = state.staffBranchId === null;
  const branchParam = isAdmin ? 'all' : state.staffBranchId;

  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const results = await Promise.all(dates.map(async (date) => {
    try {
      const url = '/api/bookings?branchId=' + encodeURIComponent(branchParam) + '&date=' + encodeURIComponent(date);
      const bookings = await apiFetch('GET', url, undefined, true);
      const guests = bookings
        .filter((b) => ACTIVE_STATUSES.includes(b.status))
        .reduce((sum, b) => sum + Number(b.guests || 0), 0);
      return { date, guests };
    } catch (err) {
      return { date, guests: 0 };
    }
  }));

  state.dashWeeklyActivity = results;
  render();
}

/** Lazily initializes the visible calendar month from the currently
 *  selected date, the first time the calendar renders. After that, the
 *  Prev/Next buttons own which month is shown — selecting a date via the
 *  toolbar's date input further below does NOT yank the calendar back to
 *  that month, so browsing forward/back isn't fought by re-renders. */
function ensureCalendarMonthMatchesSelection() {
  if (!state.calendarMonth) {
    const selected = new Date(state.dashDate + 'T00:00:00');
    state.calendarMonth = { year: selected.getFullYear(), month: selected.getMonth() };
  }
}

function renderCalendarWidget() {
  ensureCalendarMonthMatchesSelection();
  const { year, month } = state.calendarMonth;

  const card = el('div', { class: 'card', style: 'margin-bottom:16px;padding:18px;' });

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const header = el('div', { class: 'cal-header' }, [
    el('button', {
      class: 'cal-nav', 'aria-label': 'Previous month',
      onClick: () => { shiftCalendarMonth(-1); },
    }, ['\u2039']),
    el('div', { class: 'cal-month-label' }, [monthLabel]),
    el('button', {
      class: 'cal-nav', 'aria-label': 'Next month',
      onClick: () => { shiftCalendarMonth(1); },
    }, ['\u203A']),
  ]);
  card.appendChild(header);

  const grid = el('div', { class: 'cal-grid' });
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => grid.appendChild(el('div', { class: 'cal-dow' }, [d])));

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayISO();

  for (let i = 0; i < startWeekday; i++) grid.appendChild(el('div', { class: 'cal-cell empty' }));

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = dateStr === state.dashDate;
    const isToday = dateStr === todayStr;
    grid.appendChild(el('button', {
      class: 'cal-cell' + (isSelected ? ' selected' : '') + (isToday ? ' today' : ''),
      onClick: () => { state.dashDate = dateStr; refreshDashBookings(); },
    }, [String(day)]));
  }
  card.appendChild(grid);

  card.appendChild(el('button', {
    class: 'btn btn-ghost', style: 'width:100%;margin-top:10px;padding:8px;font-size:12.5px;',
    onClick: () => { state.dashDate = todayISO(); state.calendarMonth = null; refreshDashBookings(); },
  }, ['Today']));

  return card;
}

function shiftCalendarMonth(delta) {
  let { year, month } = state.calendarMonth;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  state.calendarMonth = { year, month };
  render();
}

function renderWeeklyChart() {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { style: 'font-size:15px;margin-bottom:2px;' }, ['This week']));
  card.appendChild(el('div', { class: 'hint', style: 'margin-bottom:16px;' }, ['Guests booked, last 7 days']));

  if (!state.dashWeeklyActivity) {
    card.appendChild(el('div', { class: 'spinner-row' }, [el('div', { class: 'spinner' })]));
    return card;
  }

  const maxGuests = Math.max(1, ...state.dashWeeklyActivity.map((d) => d.guests));
  const chart = el('div', { class: 'week-chart' });
  state.dashWeeklyActivity.forEach((day) => {
    const pct = Math.max(4, Math.round((day.guests / maxGuests) * 100));
    const isToday = day.date === todayISO();
    const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
    chart.appendChild(el('div', { class: 'week-chart-col' }, [
      el('div', { class: 'week-chart-value' }, [String(day.guests)]),
      el('div', { class: 'week-chart-track' }, [
        el('div', { class: 'week-chart-bar' + (isToday ? ' today' : ''), style: 'height:' + pct + '%;' }),
      ]),
      el('div', { class: 'week-chart-label' + (isToday ? ' today' : '') }, [dayLabel]),
    ]));
  });
  card.appendChild(chart);
  return card;
}

function renderBookingsPanel(isAdmin) {
  const container = el('div', {});

  const toolbar = el('div', { class: 'dash-toolbar' });
  toolbar.appendChild(el('input', {
    type: 'date', value: state.dashDate,
    onChange: (e) => { state.dashDate = e.target.value; state.calendarMonth = null; refreshDashBookings(); },
  }));
  toolbar.appendChild(el('input', {
    type: 'text', placeholder: 'Search name, phone or reference', value: state.dashSearch, style: 'min-width:220px;',
    onInput: (e) => { state.dashSearch = e.target.value; },
    onKeydown: (e) => { if (e.key === 'Enter') refreshDashBookings(); },
  }));
  toolbar.appendChild(el('button', {
    class: 'btn btn-ghost', style: 'padding:9px 16px;font-size:13px;', onClick: refreshDashBookings,
  }, ['Search']));
  toolbar.appendChild(el('button', {
    class: 'btn btn-primary', style: 'padding:9px 16px;font-size:13px;',
    onClick: () => { state.showAddForm = true; render(); },
  }, ['+ Add booking']));
  container.appendChild(toolbar);

  if (state.dashLoading) {
    container.appendChild(el('div', { class: 'spinner-row' }, [el('div', { class: 'spinner' }), el('span', {}, ['Loading reservations…'])]));
    return container;
  }

  const bookings = state.dashBookings;
  const activeBookings = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const totalGuests = activeBookings.reduce((sum, b) => sum + Number(b.guests || 0), 0);

  container.appendChild(renderStatsRow(bookings, totalGuests));
  container.appendChild(renderBookingsTimeline(bookings, isAdmin));
  return container;
}

function renderStatsRow(bookings, totalGuests) {
  const stats = el('div', { class: 'stat-row' });
  const stat = (n, label, accent) => el('div', { class: 'stat' + (accent ? ' accent-' + accent : '') }, [el('div', { class: 'n' }, [String(n)]), el('div', { class: 'l' }, [label])]);
  stats.appendChild(stat(bookings.length, 'Reservations'));
  stats.appendChild(stat(totalGuests, 'Guests booked', 'brick'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'pending').length, 'Pending', 'warn'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'waitlisted').length, 'Waitlisted', 'gold'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'no_show').length, 'No-shows', 'danger'));
  return stats;
}

/** Guest initials for the avatar circle, e.g. "Claudia Hauser" -> "CH". */
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return letters.join('') || '?';
}

function renderBookingsTimeline(bookings, isAdmin) {
  const wrap = el('div', { class: 'timeline' });

  if (bookings.length === 0) {
    wrap.appendChild(el('div', { class: 'timeline-empty' }, ['No reservations for this date yet.']));
    return wrap;
  }

  let lastTime = null;
  bookings.forEach((booking) => {
    if (booking.time !== lastTime) {
      wrap.appendChild(el('div', { class: 'timeline-time-header' }, [booking.time]));
      lastTime = booking.time;
    }
    wrap.appendChild(renderBookingCard(booking, isAdmin));
  });
  return wrap;
}

function renderBookingCard(booking, isAdmin) {
  const badges = [];
  if (booking.allergy) badges.push(el('span', { class: 'badge-icon', title: 'Allergy: ' + booking.allergy }, ['\u26A0\uFE0F']));
  if (booking.childSeat) badges.push(el('span', { class: 'badge-icon', title: 'Child seat requested' }, ['\uD83D\uDC76']));
  if (booking.source === 'phone') badges.push(el('span', { class: 'badge-icon', title: 'Booked by phone' }, ['\u260E\uFE0F']));
  if (booking.source === 'walk_in') badges.push(el('span', { class: 'badge-icon', title: 'Walk-in' }, ['\uD83D\uDEB6']));

  const subBits = [booking.guests + ' guests'];
  if (isAdmin) {
    const branch = getBranch(booking.branch);
    if (branch) subBits.push(branch.city);
  }
  if (booking.phone) subBits.push(booking.phone);

  return el('div', {
    class: 'booking-card status-edge-' + booking.status,
    onClick: () => { state.selectedBookingId = booking.id; render(); },
  }, [
    el('div', { class: 'avatar-circle' }, [initialsOf(booking.name)]),
    el('div', { class: 'booking-card-main' }, [
      el('div', { class: 'booking-card-name' }, [booking.name, ...badges]),
      el('div', { class: 'booking-card-sub' }, [subBits.join(' · ')]),
    ]),
    el('span', { class: 'status-badge status-' + booking.status }, [statusLabel(booking.status)]),
  ]);
}

function renderBookingDetailPanel(booking, isAdmin) {
  const branch = getBranch(booking.branch);
  const close = () => { state.selectedBookingId = null; render(); };

  const backdrop = el('div', {
    class: 'modal-backdrop',
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
  });
  const modal = el('div', { class: 'modal' });

  modal.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;' }, [
    el('div', {}, [
      el('h2', { style: 'margin-bottom:2px;' }, [booking.name]),
      el('div', { class: 'hint' }, [(branch ? branch.name + ' — ' : '') + booking.date + ' · ' + booking.time + ' · ' + booking.guests + ' guests']),
    ]),
    el('button', {
      onClick: close, style: 'background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:#6b7770;',
    }, ['\u00D7']),
  ]));

  modal.appendChild(el('div', { class: 'hint', style: 'margin-top:10px;' }, ['Reference: ' + booking.ref]));

  const contactRow = el('div', { class: 'field-row', style: 'margin-top:16px;' });
  contactRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Phone']), el('div', {}, [booking.phone || '—'])]));
  contactRow.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Email']), el('div', {}, [booking.email || '—'])]));
  modal.appendChild(contactRow);

  if (booking.notes) modal.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Special requests']), el('div', {}, [booking.notes])]));
  if (booking.allergy) modal.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Allergy / dietary']), el('div', {}, [booking.allergy])]));
  if (booking.childSeat) modal.appendChild(el('div', { class: 'field' }, [el('div', { class: 'hint' }, ['Child seat requested'])]));

  const statusField = el('div', { class: 'field' }, [el('label', {}, ['Status'])]);
  const statusSelect = el('select', {
    onChange: (e) => { updateStatus(booking.id, e.target.value); },
  });
  STATUS_LABELS.forEach((status) => {
    const option = el('option', { value: status }, [statusLabel(status)]);
    if (status === booking.status) option.setAttribute('selected', 'selected');
    statusSelect.appendChild(option);
  });
  statusField.appendChild(statusSelect);
  modal.appendChild(statusField);

  const actions = el('div', { class: 'btn-row split', style: 'margin-top:20px;' });
  actions.appendChild(el('button', {
    onClick: () => {
      const confirmed = confirm('Permanently delete this reservation? This cannot be undone.');
      if (confirmed) { removeBooking(booking.id); close(); }
    },
    style: 'background:none;border:1px solid #ECC6BC;color:var(--brick);border-radius:999px;padding:10px 18px;font-size:13px;',
  }, ['Delete']));

  const rightActions = el('div', { style: 'display:flex;gap:10px;' });
  if (booking.status !== 'cancelled') {
    rightActions.appendChild(el('button', {
      class: 'btn btn-ghost',
      onClick: () => {
        const confirmed = confirm(`Cancel this reservation for ${booking.name} at ${booking.time}? This frees up the table.`);
        if (confirmed) { updateStatus(booking.id, 'cancelled'); close(); }
      },
    }, ['Cancel booking']));
  }
  rightActions.appendChild(el('button', { class: 'btn btn-primary', onClick: close }, ['Done']));
  actions.appendChild(rightActions);
  modal.appendChild(actions);

  backdrop.appendChild(modal);
  return backdrop;
}

async function updateStatus(id, status) {
  try { await apiFetch('PATCH', '/api/bookings/' + encodeURIComponent(id) + '/status', { status }, true); }
  catch (err) { /* refreshDashBookings() below will show whatever the server actually has */ }
  await refreshDashBookings();
}

async function removeBooking(id) {
  try { await apiFetch('DELETE', '/api/bookings/' + encodeURIComponent(id), undefined, true); }
  catch (err) { /* see updateStatus() */ }
  await refreshDashBookings();
}

function renderAddBookingModal() {
  const isAdmin = state.staffBranchId === null;
  const branchOptions = isAdmin ? state.config.branches : [getBranch(state.staffBranchId)];
  if (!state.addFormBranch) state.addFormBranch = branchOptions[0].id;
  if (!state.addFormTime) state.addFormTime = '19:00';
  if (!state.addFormGuests) state.addFormGuests = 2;
  if (state.addFormSource === undefined) state.addFormSource = 'phone';

  const backdrop = el('div', {
    class: 'modal-backdrop',
    onClick: (e) => { if (e.target === e.currentTarget) { state.showAddForm = false; render(); } },
  });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h2', {}, ['Add reservation']));
  modal.appendChild(el('div', { class: 'hint' }, ['For telephone bookings or walk-ins. Date: ' + state.dashDate]));

  if (isAdmin) {
    const branchField = el('div', { class: 'field' }, [el('label', {}, ['Branch'])]);
    const select = el('select', { onChange: (e) => { state.addFormBranch = e.target.value; render(); } });
    branchOptions.forEach((branch) => {
      const option = el('option', { value: branch.id }, [branch.name]);
      if (branch.id === state.addFormBranch) option.setAttribute('selected', 'selected');
      select.appendChild(option);
    });
    branchField.appendChild(select);
    modal.appendChild(branchField);
  }

  const row1 = el('div', { class: 'field-row' });
  row1.appendChild(el('div', { class: 'field' }, [
    el('label', {}, ['Time']),
    el('input', { type: 'time', value: state.addFormTime, onInput: (e) => { state.addFormTime = e.target.value; } }),
  ]));
  row1.appendChild(el('div', { class: 'field' }, [
    el('label', {}, ['Guests']),
    el('input', { type: 'number', min: '1', value: String(state.addFormGuests), onInput: (e) => { state.addFormGuests = Number(e.target.value) || 1; } }),
  ]));
  modal.appendChild(row1);

  const row2 = el('div', { class: 'field-row' });
  row2.appendChild(el('div', { class: 'field' }, [
    el('label', {}, ['Name']),
    el('input', { type: 'text', value: state.addFormName || '', onInput: (e) => { state.addFormName = e.target.value; } }),
  ]));
  row2.appendChild(el('div', { class: 'field' }, [
    el('label', {}, ['Phone']),
    el('input', { type: 'tel', value: state.addFormPhone || '', onInput: (e) => { state.addFormPhone = e.target.value; } }),
  ]));
  modal.appendChild(row2);

  modal.appendChild(el('div', { class: 'field' }, [
    el('label', {}, ['Notes']),
    el('textarea', { onInput: (e) => { state.addFormNotes = e.target.value; } }, [state.addFormNotes || '']),
  ]));

  const sourceField = el('div', { class: 'field' }, [el('label', {}, ['Source'])]);
  const sourceSelect = el('select', { onChange: (e) => { state.addFormSource = e.target.value; } });
  ['phone', 'walk_in'].forEach((source) => {
    const option = el('option', { value: source }, [source === 'phone' ? 'Telephone' : 'Walk-in']);
    if (source === state.addFormSource) option.setAttribute('selected', 'selected');
    sourceSelect.appendChild(option);
  });
  sourceField.appendChild(sourceSelect);
  modal.appendChild(sourceField);

  if (state.addFormError) modal.appendChild(el('div', { class: 'msg error' }, [state.addFormError]));

  modal.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'btn btn-ghost', onClick: () => { state.showAddForm = false; state.addFormError = ''; render(); } }, ['Cancel']),
    el('button', { class: 'btn btn-primary', disabled: state.addFormBusy, onClick: submitStaffBooking }, [state.addFormBusy ? '…' : 'Add reservation']),
  ]));

  backdrop.appendChild(modal);
  return backdrop;
}

async function submitStaffBooking() {
  if (!(state.addFormName || '').trim()) {
    state.addFormError = 'Please enter a guest name.';
    render();
    return;
  }
  state.addFormBusy = true;
  state.addFormError = '';
  render();
  try {
    const result = await apiFetch('POST', '/api/bookings', {
      branch: state.addFormBranch, date: state.dashDate, time: state.addFormTime, guests: state.addFormGuests,
      name: (state.addFormName || '').trim(), email: '', phone: (state.addFormPhone || '').trim(),
      notes: (state.addFormNotes || '').trim(), allergy: '', childSeat: false,
      source: state.addFormSource,
    }, true);
    if (!result.ok) {
      state.addFormError = result.error === 'CLOSED' ? 'The branch is closed that day.' : 'Could not add this reservation.';
      state.addFormBusy = false;
      render();
      return;
    }
    state.showAddForm = false;
    state.addFormError = '';
    state.addFormBusy = false;
    state.addFormName = '';
    state.addFormPhone = '';
    state.addFormNotes = '';
    await refreshDashBookings();
  } catch (err) {
    state.addFormError = t('connectionError');
    state.addFormBusy = false;
    render();
  }
}
