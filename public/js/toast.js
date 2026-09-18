/**
 * Tiny toast notification system — a brief "Saved" style confirmation
 * that appears at the bottom of the screen and clears itself. Used
 * anywhere an action succeeds silently otherwise (e.g. admin settings,
 * which auto-save on every field change with no other feedback).
 */

import { state } from './state.js';
import { render } from './render.js';

let hideTimer = null;

export function showToast(message, durationMs = 2200) {
  state.toast = message;
  render();
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    state.toast = null;
    render();
  }, durationMs);
}
