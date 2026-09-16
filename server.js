/**
 * Entry point. Deliberately thin: all real logic lives under src/.
 * Run with `npm start`.
 */

const config = require('./src/config/env');
const createApp = require('./src/app');

const app = createApp();

app.listen(config.port, () => {
  console.log(`Tablespot server running on port ${config.port}`);
});
