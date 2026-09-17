/**
 * PIN-based login for branch staff and the admin/owner. Deliberately
 * simple — appropriate for a small internal tool, not a general-purpose
 * auth system (see src/services/authService.js on the backend).
 */

import { el } from '../dom.js';
import { state } from '../state.js';
import { t } from '../i18n.js';
import { apiFetch } from '../api.js';
import { render } from '../render.js';
import { refreshDashBookings, fetchWeeklyActivity } from './staffDashboardView.js';

export function renderStaffLogin() {
  const wrap = el('div', { class: 'login-wrap' });
  wrap.appendChild(el('div', {
    style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;margin-bottom:4px;',
  }, ['TableSpot']));
  wrap.appendChild(el('h2', {}, ['Staff & admin access']));
  wrap.appendChild(el('div', { class: 'hint', style: 'margin:6px 0 16px;' }, ['Select your branch (or admin) and enter your PIN.']));

  if (state.loginError) wrap.appendChild(el('div', { class: 'msg error' }, [state.loginError]));

  let loginBtn;
  function syncLoginButton() {
    if (loginBtn) loginBtn.disabled = !state.staffLoginTarget || !(state.staffPinInput || '').trim() || state.loginBusy;
  }

  const targetField = el('div', { class: 'field' }, [el('label', { for: 'staff-branch' }, ['Branch'])]);
  const targetSelect = el('select', {
    id: 'staff-branch', name: 'branch',
    onChange: (e) => { state.staffLoginTarget = e.target.value || null; render(); },
  });
  targetSelect.appendChild(el('option', { value: '' }, ['— Select —']));
  state.config.branches.forEach((branch) => {
    const option = el('option', { value: branch.id }, [branch.name + ' — ' + branch.city]);
    if (state.staffLoginTarget === branch.id) option.setAttribute('selected', 'selected');
    targetSelect.appendChild(option);
  });
  const adminOption = el('option', { value: 'admin' }, ['Administrator — All branches']);
  if (state.staffLoginTarget === 'admin') adminOption.setAttribute('selected', 'selected');
  targetSelect.appendChild(adminOption);
  targetField.appendChild(targetSelect);
  wrap.appendChild(targetField);

  wrap.appendChild(el('div', { class: 'field', style: 'margin-top:18px;' }, [
    el('label', { for: 'staff-pin' }, ['PIN']),
    el('input', {
      type: 'password', id: 'staff-pin', name: 'pin', autocomplete: 'off',
      inputmode: 'numeric', required: 'required', value: state.staffPinInput || '',
      onInput: (e) => { state.staffPinInput = e.target.value; syncLoginButton(); },
    }),
  ]));

  loginBtn = el('button', {
    class: 'btn btn-primary',
    disabled: !state.staffLoginTarget || !(state.staffPinInput || '').trim() || state.loginBusy,
    onClick: attemptLogin,
  }, [state.loginBusy ? '…' : 'Log in']);
  wrap.appendChild(el('div', { class: 'btn-row' }, [loginBtn]));
  return wrap;
}

async function attemptLogin() {
  state.loginBusy = true;
  render();
  try {
    const result = await apiFetch('POST', '/api/staff/login', {
      target: state.staffLoginTarget, pin: (state.staffPinInput || '').trim(),
    });
    if (result.ok) {
      state.staffToken = result.token;
      state.staffBranchId = result.role === 'admin' ? null : result.branchId;
      state.loggedIn = true;
      state.dashTab = 'today';
      state.loginError = '';
      state.view = 'staffDash';
      state.loginBusy = false;

      // Admins need the full config (including PINs, for the settings
      // screen) — the public config the app loaded with intentionally
      // strips those out, so fetch the privileged version now.
      if (result.role === 'admin') {
        try { state.config = await apiFetch('GET', '/api/admin/config', undefined, true); }
        catch (err) { /* keep the public config if this fails; settings screen will just be read-only-ish */ }
      }

      await refreshDashBookings();
      fetchWeeklyActivity(); // don't block login on this — it fills in once ready
      return;
    }
    state.loginError = 'Incorrect PIN. Please try again.';
  } catch (err) {
    state.loginError = t('connectionError');
  }
  state.loginBusy = false;
  render();
}
