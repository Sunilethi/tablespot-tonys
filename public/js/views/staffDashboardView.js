/**
 * The staff/admin reservations dashboard: today's bookings for a branch
 * (or every branch, for an admin), status changes, cancel/delete, and
 * adding phone/walk-in bookings manually.
 */

import { el } from '../dom.js';
import { state, getBranch } from '../state.js';
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
      }, ['Tablespot']),
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

  wrap.appendChild(renderBookingsPanel(isAdmin));
  if (state.showAddForm) wrap.appendChild(renderAddBookingModal());
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

function renderBookingsPanel(isAdmin) {
  const container = el('div', {});

  const toolbar = el('div', { class: 'dash-toolbar' });
  toolbar.appendChild(el('input', {
    type: 'date', value: state.dashDate,
    onChange: (e) => { state.dashDate = e.target.value; refreshDashBookings(); },
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
  container.appendChild(renderBookingsTable(bookings, isAdmin));
  return container;
}

function renderStatsRow(bookings, totalGuests) {
  const stats = el('div', { class: 'stat-row' });
  const stat = (n, label) => el('div', { class: 'stat' }, [el('div', { class: 'n' }, [String(n)]), el('div', { class: 'l' }, [label])]);
  stats.appendChild(stat(bookings.length, 'Reservations'));
  stats.appendChild(stat(totalGuests, 'Guests booked'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'pending').length, 'Pending'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'waitlisted').length, 'Waitlisted'));
  stats.appendChild(stat(bookings.filter((b) => b.status === 'no_show').length, 'No-shows'));
  return stats;
}

function renderBookingsTable(bookings, isAdmin) {
  const table = el('table', { class: 'bookings' });
  const columnCount = isAdmin ? 9 : 8;

  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['Time']), el('th', {}, ['Guests']), el('th', {}, ['Name']),
    isAdmin ? el('th', {}, ['Branch']) : null,
    el('th', {}, ['Contact']), el('th', {}, ['Notes']), el('th', {}, ['Source']),
    el('th', {}, ['Status']), el('th', {}, ['Actions']),
  ].filter(Boolean))]));

  const tbody = el('tbody', {});
  if (bookings.length === 0) {
    tbody.appendChild(el('tr', { class: 'empty-row' }, [el('td', { colspan: columnCount }, ['No reservations for this date yet.'])]));
  } else {
    bookings.forEach((booking) => tbody.appendChild(renderBookingRow(booking, isAdmin)));
  }
  table.appendChild(tbody);
  return table;
}

function renderBookingRow(booking, isAdmin) {
  const notesBits = [];
  if (booking.notes) notesBits.push(booking.notes);
  if (booking.allergy) notesBits.push('Allergy: ' + booking.allergy);
  if (booking.childSeat) notesBits.push('Child seat');

  return el('tr', {}, [
    el('td', {}, [booking.time]),
    el('td', {}, [String(booking.guests)]),
    el('td', {}, [
      el('div', { style: 'font-weight:600;' }, [booking.name]),
      el('div', { style: 'font-size:11px;color:#8a8477;' }, [booking.ref]),
    ]),
    isAdmin ? el('td', {}, [getBranch(booking.branch) ? getBranch(booking.branch).city : booking.branch]) : null,
    el('td', {}, [
      el('div', {}, [booking.phone || '—']),
      el('div', { style: 'font-size:11px;color:#8a8477;' }, [booking.email || '']),
    ]),
    el('td', { style: 'max-width:180px;white-space:normal;' }, [notesBits.join(' · ') || '—']),
    el('td', {}, [booking.source]),
    el('td', {}, [el('span', { class: 'status-badge status-' + booking.status }, [statusLabel(booking.status)])]),
    el('td', {}, [renderRowActions(booking)]),
  ].filter(Boolean));
}

function renderRowActions(booking) {
  const wrap = el('div', { class: 'row-actions' });

  const select = el('select', { onChange: (e) => updateStatus(booking.id, e.target.value) });
  STATUS_LABELS.forEach((status) => {
    const option = el('option', { value: status }, [statusLabel(status)]);
    if (status === booking.status) option.setAttribute('selected', 'selected');
    select.appendChild(option);
  });
  wrap.appendChild(select);

  if (booking.status !== 'cancelled') {
    wrap.appendChild(el('button', {
      class: 'danger',
      onClick: () => {
        const confirmed = confirm(`Cancel this reservation for ${booking.name} at ${booking.time}? This frees up the table.`);
        if (confirmed) updateStatus(booking.id, 'cancelled');
      },
    }, ['Cancel']));
  }

  wrap.appendChild(el('button', {
    onClick: () => {
      const confirmed = confirm('Permanently delete this reservation? This cannot be undone.');
      if (confirmed) removeBooking(booking.id);
    },
  }, ['Delete']));

  return wrap;
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
