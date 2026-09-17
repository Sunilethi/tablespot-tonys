/**
 * Tiny helper for building DOM trees without a framework. The app
 * re-renders by rebuilding subtrees from scratch (see render.js) rather
 * than diffing — simple and fast enough at this scale, but the tradeoff
 * to know about: never call `render()` from inside a text input's own
 * event handler, or it loses focus on every keystroke (see the comments
 * in views/customerView.js for where this matters).
 */

export function el(tag, attrs, children) {
  const element = document.createElement(tag);

  if (attrs) {
    for (const key in attrs) {
      if (key === 'class') element.className = attrs[key];
      else if (key === 'html') element.innerHTML = attrs[key];
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      else if (key === 'disabled') { if (attrs[key]) element.setAttribute('disabled', 'disabled'); }
      // Setting `checked` as a raw attribute is a real trap: if the value
      // passed in is `undefined` (e.g. from `someBoolean || undefined`),
      // setAttribute() stringifies it to the literal text "undefined" —
      // and ANY string value on a checked attribute renders as checked,
      // regardless of your actual data. Using the DOM property directly
      // sidesteps that entirely: it's a real boolean, always.
      else if (key === 'checked') { element.checked = !!attrs[key]; }
      else element.setAttribute(key, attrs[key]);
    }
  }

  (children || []).forEach((child) => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string') element.appendChild(document.createTextNode(child));
    else element.appendChild(child);
  });

  return element;
}
