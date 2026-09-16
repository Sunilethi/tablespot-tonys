/**
 * The top navigation bar — brand mark, Reserve/Staff toggle, language
 * switcher. Shared across every view.
 */

import { el } from '../dom.js';
import { state } from '../state.js';
import { t } from '../i18n.js';
import { render } from '../render.js';

export function renderTopbar() {
  const bar = el('div', { class: 'topbar' });
  const inner = el('div', { class: 'topbar-inner' });

  inner.appendChild(el('div', { class: 'brand' }, [
    el('span', { class: 'mark' }, ["Tony's"]),
    el('span', { class: 'sub' }, ['RESERVATIONS']),
  ]));

  const nav = el('div', { class: 'topbar-nav' });

  nav.appendChild(el('button', {
    class: 'nav-btn' + (state.view === 'customer' ? ' active' : ''),
    onClick: () => { state.view = 'customer'; render(); },
  }, [t('reserve')]));

  nav.appendChild(el('button', {
    class: 'nav-btn' + (state.view !== 'customer' ? ' active' : ''),
    onClick: () => { state.view = state.loggedIn ? 'staffDash' : 'staffLogin'; render(); },
  }, [t('staff')]));

  const langToggle = el('div', { class: 'lang-toggle' });
  langToggle.appendChild(el('button', {
    class: state.lang === 'en' ? 'active' : '',
    onClick: () => { state.lang = 'en'; render(); },
  }, ['EN']));
  langToggle.appendChild(el('button', {
    class: state.lang === 'de' ? 'active' : '',
    onClick: () => { state.lang = 'de'; render(); },
  }, ['DE']));
  nav.appendChild(langToggle);

  inner.appendChild(nav);
  bar.appendChild(inner);
  return bar;
}
