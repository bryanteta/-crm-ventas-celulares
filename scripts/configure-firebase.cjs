const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (!input) throw new Error('Uso: node scripts/configure-firebase.cjs /ruta/google-services.json');
const config = JSON.parse(fs.readFileSync(input, 'utf8'));
const client = config.client?.find(c => c.client_info?.android_client_info?.package_name === 'com.crmcelulares.app');
const values = {
  projectId: config.project_info?.project_id,
  appId: client?.client_info?.mobilesdk_app_id,
  apiKey: client?.api_key?.[0]?.current_key
};
if (!client || Object.values(values).some(v => typeof v !== 'string' || !v || /[\r\n\\]/.test(v))) {
  throw new Error('El archivo no contiene una app Android válida para com.crmcelulares.app.');
}
const output = path.resolve(__dirname, '../android/firebase.properties');
if (fs.existsSync(output)) throw new Error('Ya existe android/firebase.properties. Revísalo antes de reemplazar la configuración.');
fs.writeFileSync(output, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
console.log(`Configuración pública guardada para el proyecto ${values.projectId}. El APK debe recompilarse.`);
