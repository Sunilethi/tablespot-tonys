/**
 * Floor plan: a visual layout of a branch's tables.
 *
 * Two modes sharing one screen:
 *   - Live view (default, everyone) — read-only, shows each table's
 *     current status (free / occupied, with the guest's name) for
 *     whichever date is selected on the dashboard, plus a list of
 *     bookings flagged "needs a human" (too big for any single table).
 *   - Edit mode (admin only, via the "Edit layout" button) — add/remove
 *     tables and drag them into position to match the real room.
 *
 * Table POSITION is purely cosmetic. The booking engine (bookingService.js
 * on the backend) never reads x/y/width/height — only capacity, zone, and
 * active status feed into real booking logic. A dragging glitch here can
 * never corrupt a reservation.
 */

import { el } from '../dom.js';
import { state, getBranch } from '../state.js';
import { apiFetch } from '../api.js';
import { render } from '../render.js';
import { showToast } from '../toast.js';

const ZONE_LABEL = { indoor: 'Indoor', outdoor: 'Outdoor' };

export function renderFloorTab(isAdmin) {
  ensureFloorBranchSelected(isAdmin);
  const wrap = el('div', {});

  if (isAdmin) wrap.appendChild(renderBranchPicker());

  if (!state.floorBranchId) {
    wrap.appendChild(el('div', { class: 'card' }, [el('div', { class: 'hint' }, ['Select a branch to view its floor plan.'])]));
    return wrap;
  }

  const toolbar = el('div', { class: 'dash-toolbar', style: 'justify-content:space-between;' });
  toolbar.appendChild(el('div', { style: 'font-weight:700;font-size:15px;' }, [getBranch(state.floorBranchId).name]));
  if (isAdmin) {
    toolbar.appendChild(el('button', {
      class: 'btn ' + (state.floorEditMode ? 'btn-primary' : 'btn-ghost'), style: 'padding:9px 18px;font-size:13px;',
      onClick: () => { state.floorEditMode = !state.floorEditMode; loadFloorData(isAdmin); },
    }, [state.floorEditMode ? '\u2713 Done editing' : 'Edit layout']));
  }
  wrap.appendChild(toolbar);

  if (state.floorLoading) {
    wrap.appendChild(el('div', { class: 'spinner-row' }, [el('div', { class: 'spinner' }), el('span', {}, ['Loading floor plan…'])]));
    return wrap;
  }

  wrap.appendChild(state.floorEditMode ? renderFloorEditor() : renderFloorLiveView(isAdmin));
  return wrap;
}

function ensureFloorBranchSelected(isAdmin) {
  if (state.floorBranchId) return;
  state.floorBranchId = isAdmin ? state.config.branches[0].id : state.staffBranchId;
  loadFloorData(isAdmin);
}

function renderBranchPicker() {
  const field = el('div', { style: 'margin-bottom:14px;max-width:320px;' });
  const select = el('select', {
    onChange: (e) => {
      state.floorBranchId = e.target.value;
      loadFloorData(true);
    },
  });
  state.config.branches.forEach((branch) => {
    const option = el('option', { value: branch.id }, [branch.name + ' — ' + branch.city]);
    if (branch.id === state.floorBranchId) option.setAttribute('selected', 'selected');
    select.appendChild(option);
  });
  field.appendChild(select);
  return field;
}

async function loadFloorData(isAdmin) {
  state.floorLoading = true;
  render();
  try {
    if (state.floorEditMode) {
      state.floorTables = await apiFetch('GET', '/api/admin/tables?branchId=' + encodeURIComponent(state.floorBranchId), undefined, true);
    } else {
      const url = '/api/floor?branchId=' + encodeURIComponent(state.floorBranchId) + '&date=' + encodeURIComponent(state.dashDate);
      state.floorStatus = await apiFetch('GET', url, undefined, true);
    }
  } catch (err) {
    state.floorTables = [];
    state.floorStatus = { tables: [], flagged: [] };
  }
  state.floorLoading = false;
  render();
}

// Re-export so staffDashboardView.js can refresh the floor's live status
// whenever the selected date changes (it drives the toolbar's date picker).
export function reloadFloorIfVisible(isAdmin) {
  if (state.dashTab === 'floor' && state.floorBranchId) loadFloorData(isAdmin);
}

// ---------- Live view (read-only) ----------

function renderFloorLiveView(isAdmin) {
  const wrap = el('div', {});
  const statusData = state.floorStatus || { tables: [], flagged: [] };

  if (statusData.flagged.length > 0) {
    const flagCard = el('div', { class: 'card', style: 'border-color:#F0C4C4;background:#FBEAEA;margin-bottom:16px;' });
    flagCard.appendChild(el('h2', { style: 'font-size:14px;color:var(--danger);margin-bottom:10px;' }, ['\u26A0 Needs a table — ' + statusData.flagged.length]));
    statusData.flagged.forEach((b) => {
      const row = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #F0C4C4;' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:600;' }, [b.time + ' — ' + b.name]),
          el('div', { style: 'font-size:12px;color:#6b7770;' }, [b.guests + ' guests · ' + b.ref]),
        ]),
        el('button', {
          class: 'btn btn-ghost', style: 'padding:6px 14px;font-size:12.5px;',
          onClick: async () => {
            try {
              const result = await apiFetch('POST', '/api/bookings/' + encodeURIComponent(b.id) + '/reassign-table', undefined, true);
              showToast(result.assigned ? 'Table assigned' : 'Still no table fits — try again after rearranging');
            } catch (err) {
              showToast('Could not reassign — try again');
            }
            loadFloorData(isAdmin);
          },
        }, ['Try again']),
      ]);
      flagCard.appendChild(row);
    });
    wrap.appendChild(flagCard);
  }

  const canvasCard = el('div', { class: 'card' });
  if (statusData.tables.length === 0) {
    canvasCard.appendChild(el('div', { class: 'hint' }, [
      'No tables set up yet for this branch.' + (isAdmin ? ' Click "Edit layout" to add some.' : ' Ask an admin to set up the floor plan.'),
    ]));
  } else {
    ['indoor', 'outdoor'].forEach((zone) => {
      const zoneTables = statusData.tables.filter((t) => t.zone === zone && t.active);
      if (zoneTables.length === 0) return;
      canvasCard.appendChild(el('div', { class: 'floor-zone-label' }, [ZONE_LABEL[zone]]));
      const canvas = el('div', { class: 'floor-canvas' });
      zoneTables.forEach((t) => canvas.appendChild(renderLiveTile(t)));
      canvasCard.appendChild(canvas);
    });
  }
  wrap.appendChild(canvasCard);
  return wrap;
}

function renderLiveTile(t) {
  const isOccupied = t.status === 'occupied';
  const tile = el('div', {
    class: 'floor-tile' + (isOccupied ? ' occupied' : ' free') + (t.shape === 'round' ? ' round' : ''),
    style: `left:${t.x}px;top:${t.y}px;width:${t.width}px;height:${t.height}px;`,
    title: isOccupied ? `${t.booking.name} · ${t.booking.guests} guests · ${t.booking.time}` : 'Free',
  }, [
    el('div', { class: 'floor-tile-name' }, [t.name]),
    el('div', { class: 'floor-tile-cap' }, [isOccupied ? t.booking.name : t.capacity + ' seats']),
  ]);
  return tile;
}

// ---------- Editor (admin, drag-and-drop) ----------

function renderFloorEditor() {
  const wrap = el('div', {});
  const tables = state.floorTables || [];

  wrap.appendChild(renderAddTableForm());

  const outdoorToggleCard = el('div', { class: 'card', style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;' });
  const branch = getBranch(state.floorBranchId);
  outdoorToggleCard.appendChild(el('div', {}, [
    el('div', { style: 'font-weight:600;font-size:13.5px;' }, ['Outdoor tables active']),
    el('div', { class: 'hint' }, ['Switch off in winter — outdoor tables stop being offered to customers entirely.']),
  ]));
  const toggle = el('input', { type: 'checkbox', checked: branch.outdoorActive || undefined });
  toggle.addEventListener('change', async (e) => {
    try {
      await apiFetch('PATCH', '/api/admin/branches/' + encodeURIComponent(state.floorBranchId), { outdoorActive: e.target.checked }, true);
      branch.outdoorActive = e.target.checked;
      showToast(e.target.checked ? 'Outdoor tables active' : 'Outdoor tables switched off');
    } catch (err) {
      showToast('Could not update — please try again');
    }
    render();
  });
  outdoorToggleCard.appendChild(toggle);
  wrap.appendChild(outdoorToggleCard);

  const canvasCard = el('div', { class: 'card' });
  if (tables.length === 0) {
    canvasCard.appendChild(el('div', { class: 'hint' }, ['No tables yet — add your first one above.']));
  } else {
    ['indoor', 'outdoor'].forEach((zone) => {
      const zoneTables = tables.filter((t) => t.zone === zone);
      canvasCard.appendChild(el('div', { class: 'floor-zone-label' }, [ZONE_LABEL[zone] + (zoneTables.length ? '' : ' (empty)')]));
      const canvas = el('div', { class: 'floor-canvas editable' });
      zoneTables.forEach((t) => canvas.appendChild(renderEditableTile(t)));
      canvasCard.appendChild(canvas);
    });
  }
  wrap.appendChild(canvasCard);
  return wrap;
}

function renderAddTableForm() {
  const card = el('div', { class: 'card', style: 'margin-bottom:16px;' });
  card.appendChild(el('h2', { style: 'font-size:14px;margin-bottom:12px;' }, ['Add a table']));

  const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;' });
  const inputStyle = 'padding:9px;border:1px solid var(--line);border-radius:4px;';

  const nameInput = el('input', { type: 'text', placeholder: 'e.g. T1, Window 4', style: inputStyle + 'width:150px;' });
  const capInput = el('input', { type: 'number', value: '2', min: '1', style: inputStyle + 'width:80px;' });
  const zoneSelect = el('select', { style: inputStyle });
  zoneSelect.appendChild(el('option', { value: 'indoor' }, ['Indoor']));
  zoneSelect.appendChild(el('option', { value: 'outdoor' }, ['Outdoor']));
  const shapeSelect = el('select', { style: inputStyle });
  shapeSelect.appendChild(el('option', { value: 'rect' }, ['Rectangle / square']));
  shapeSelect.appendChild(el('option', { value: 'round' }, ['Round']));

  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Name']), nameInput]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Seats']), capInput]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Zone']), zoneSelect]));
  row.appendChild(el('div', {}, [el('div', { class: 'hint', style: 'margin-bottom:4px;' }, ['Shape']), shapeSelect]));
  row.appendChild(el('button', {
    class: 'btn btn-primary', style: 'padding:9px 18px;font-size:13px;',
    onClick: async () => {
      if (!nameInput.value.trim()) { showToast('Give the table a name first'); return; }
      try {
        await apiFetch('POST', '/api/admin/tables', {
          branchId: state.floorBranchId, name: nameInput.value.trim(),
          capacity: Number(capInput.value) || 2, zone: zoneSelect.value, shape: shapeSelect.value,
        }, true);
        showToast('Table added');
      } catch (err) {
        showToast('Could not add table — please try again');
      }
      loadFloorData(true);
    },
  }, ['+ Add']));
  card.appendChild(row);
  return card;
}

function renderEditableTile(table) {
  const tile = el('div', {
    class: 'floor-tile editable' + (table.shape === 'round' ? ' round' : '') + (table.active ? '' : ' inactive'),
    style: `left:${table.x}px;top:${table.y}px;width:${table.width}px;height:${table.height}px;`,
  }, [
    el('button', {
      class: 'floor-tile-delete',
      onClick: async (e) => {
        e.stopPropagation();
        const confirmed = confirm(`Delete table "${table.name}"?`);
        if (!confirmed) return;
        try {
          await apiFetch('DELETE', '/api/admin/tables/' + encodeURIComponent(table.id), undefined, true);
        } catch (err) { /* loadFloorData below reflects real state either way */ }
        loadFloorData(true);
      },
    }, ['\u00D7']),
    el('div', { class: 'floor-tile-name' }, [table.name]),
    el('div', { class: 'floor-tile-cap' }, [table.capacity + ' seats']),
  ]);

  attachDragHandlers(tile, table);
  return tile;
}

/**
 * Direct DOM manipulation during the drag itself (not a full render() on
 * every pointermove) — same principle as text inputs elsewhere in this
 * codebase: rebuilding the DOM mid-interaction would kill the drag.
 * Position is only persisted to the server once, on release.
 */
function attachDragHandlers(tileEl, table) {
  let dragging = false;
  let startClientX = 0, startClientY = 0, startX = 0, startY = 0;

  tileEl.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('floor-tile-delete')) return;
    dragging = true;
    tileEl.setPointerCapture(e.pointerId);
    startClientX = e.clientX;
    startClientY = e.clientY;
    startX = table.x;
    startY = table.y;
    tileEl.style.zIndex = '10';
    tileEl.style.cursor = 'grabbing';
  });

  tileEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const newX = Math.max(0, startX + (e.clientX - startClientX));
    const newY = Math.max(0, startY + (e.clientY - startClientY));
    tileEl.style.left = newX + 'px';
    tileEl.style.top = newY + 'px';
    table.x = newX;
    table.y = newY;
  });

  tileEl.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;
    tileEl.style.zIndex = '';
    tileEl.style.cursor = '';
    try {
      await apiFetch('PATCH', '/api/admin/tables/' + encodeURIComponent(table.id), { x: table.x, y: table.y }, true);
    } catch (err) { /* position will reload correctly next fetch either way */ }
  });
}
