const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = [
  'suite-ui', 'suite-integrity', 'inventory-ui', 'inventory-owners-ui',
  'provider-inventory-ui', 'accessories-ui', 'commission-removal-ui', 'sales-flow-ui', 'receipt-integrity-ui',
  'warranty-ui', 'launch-ui', 'settings-notices', 'single-brand', 'profiles-ui',
  'android-ui', 'storage', 'el-salvador'
];
for (const name of suites) {
  const result = spawnSync(process.execPath, [path.join('tests', name + '.cjs')], {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env
  });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
