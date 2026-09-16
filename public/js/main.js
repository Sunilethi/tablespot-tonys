/**
 * Entry point, loaded by index.html as `<script type="module">`.
 * Everything else is imported from here transitively.
 *
 * Two URLs, one codebase: "/" is the customer booking site, "/staff" is
 * the staff & admin login/dashboard. Both are served by the same
 * server.js catch-all route (see src/app.js) — the split happens here,
 * purely client-side, by reading the current path once at boot.
 */

import { state } from './state.js';
import { loadInitialConfig } from './render.js';

state.appMode = window.location.pathname.startsWith('/staff') ? 'staff' : 'customer';
state.view = state.appMode === 'staff' ? 'staffLogin' : 'customer';

loadInitialConfig();
