const fs = require('node:fs');
const path = require('node:path');
exports.path = filename => {
  const directory = process.env.LUNIVO_ARTIFACT_DIR || path.resolve(__dirname, '../test-results');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, filename);
};
