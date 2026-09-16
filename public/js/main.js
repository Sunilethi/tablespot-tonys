/**
 * Entry point, loaded by index.html as `<script type="module">`.
 * Everything else is imported from here transitively.
 */

import { loadInitialConfig } from './render.js';

loadInitialConfig();
