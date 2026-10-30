// Extends app.json for what the safety reports need on Android:
//  - Firebase push, once google-services.json (for com.ustlegazpi.tomasafe) is in the project,
//    and the Firebase project id / API key the app uses to write to Firestore
//  - plain http:// to the TomaSafe server on the local Wi-Fi (fallback; release builds block it)
const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('expo/config-plugins');

function withCleartextTraffic(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
}

/** Project id and API key for this app's package, from google-services.json. */
function firebaseConfig(file, androidPackage) {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const client = json.client.find((c) => c.client_info?.android_client_info?.package_name === androidPackage);
    const apiKey = client?.api_key?.[0]?.current_key;
    return apiKey ? { projectId: json.project_info.project_id, apiKey } : null;
  } catch {
    return null;
  }
}

module.exports = ({ config }) => {
  const servicesFile = path.join(__dirname, 'google-services.json');
  const firebase = fs.existsSync(servicesFile) ? firebaseConfig(servicesFile, config.android?.package) : null;
  return withCleartextTraffic({
    ...config,
    android: {
      ...config.android,
      ...(firebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    extra: { ...config.extra, firebase },
  });
};
