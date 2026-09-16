/**
 * The top navigation bar — brand mark, Reserve/Staff toggle, language
 * switcher. Shared across every view.
 */

import { el } from '../dom.js';
import { state } from '../state.js';
import { render } from '../render.js';

export function renderTopbar() {
  const bar = el('div', { class: 'topbar' });
  const inner = el('div', { class: 'topbar-inner' });

  const logoSrc = state.appMode === 'staff' ? '/images/tonys-logo-white.png' : '/images/tonys-logo.png';
  inner.appendChild(el('div', { class: 'brand' }, [
    el('img', { src: logoSrc, alt: "Tony's", class: 'brand-logo' }),
    el('span', { class: 'sub' }, ['RESERVATIONS']),
  ]));

  const nav = el('div', { class: 'topbar-nav' });

  if (state.appMode === 'customer') {
    // The customer-facing site deliberately has no visible link to the
    // staff/admin login — that lives at its own separate /staff URL,
    // shared only with staff, not advertised to diners.
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
  } else {
    // Staff/admin site: a quiet link back to the public booking page,
    // no language toggle (this side is English-only, see i18n.js).
    nav.appendChild(el('a', {
      href: '/', class: 'nav-btn',
      style: 'text-decoration:none;display:inline-flex;align-items:center;',
    }, ['View booking site']));
  }

  inner.appendChild(nav);
  bar.appendChild(inner);
  return bar;
}
