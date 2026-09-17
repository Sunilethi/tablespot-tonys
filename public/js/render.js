/**
 * The root of the render tree. Decides which top-level view to show and
 * rebuilds the DOM under #root accordingly.
 *
 * Every view module calls this `render()` after mutating `state`, to
 * reflect the change on screen — there's no separate reactivity system.
 * This does create a circular import with the view modules (they import
 * `render` from here, and this file imports their render-entry functions)
 * but that's safe in ES modules as long as the circular binding is only
 * *used* inside function bodies, never evaluated at module load time —
 * which is the case everywhere in this app.
 */

import { el } from './dom.js';
import { state } from './state.js';
import { apiFetch } from './api.js';
import { renderTopbar } from './views/topbar.js';
import { renderCustomer } from './views/customerView.js';
import { renderStaffLogin } from './views/staffLoginView.js';
import { renderStaffDash } from './views/staffDashboardView.js';

export async function loadInitialConfig() {
  try {
    state.config = await apiFetch('GET', '/api/config');
  } catch (err) {
    state.config = null;
  }
  state.loaded = true;
  render();
}

export function render() {
  const root = document.getElementById('root');
  root.innerHTML = '';

  // TS-QA-009: the <html lang="..."> attribute and document title were
  // permanently stuck in English even when the customer switched the UI
  // to German — screen readers and browser features (spellcheck, translate
  // prompts) rely on this being accurate.
  document.documentElement.lang = state.appMode === 'customer' ? state.lang : 'en';
  document.title = state.appMode === 'staff'
    ? 'Staff Dashboard — TableSpot'
    : (state.lang === 'de' ? "Tony's — Tischreservierung" : "Tony's — Table Reservations");

  if (!state.loaded) {
    root.appendChild(el('div', { style: 'padding:60px;text-align:center;color:#6b7770;' }, ['Loading…']));
    return;
  }

  if (!state.config) {
    root.appendChild(el(
      'div',
      { style: 'padding:60px;text-align:center;color:#A33B2B;max-width:420px;margin:0 auto;' },
      ['Could not connect to the reservation system. Please reload the page, or check that the server is running.']
    ));
    return;
  }

  const isStaffView = state.view !== 'customer';
  const themeWrap = el('div', { class: isStaffView ? 'staff-theme' : '' });
  themeWrap.appendChild(renderTopbar());

  const app = el('div', { class: 'app' });
  if (state.view === 'customer') app.appendChild(renderCustomer());
  else if (state.view === 'staffLogin') app.appendChild(renderStaffLogin());
  else if (state.view === 'staffDash') app.appendChild(renderStaffDash());
  app.appendChild(el('footer', { class: 'note' }, ['Powered by TableSpot']));

  themeWrap.appendChild(app);
  root.appendChild(themeWrap);
}
