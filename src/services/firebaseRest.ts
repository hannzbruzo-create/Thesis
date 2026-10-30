import Constants from 'expo-constants';

/**
 * Minimal Firebase over plain HTTPS (no native Firebase SDK): anonymous sign-in and Firestore
 * document reads/writes. Lets the phone reach the TomaSafe system from any internet connection;
 * the PC server listens to the same Firestore collections (server/firebaseSync.js).
 *
 * Needs, in the Firebase console: Firestore enabled, Anonymous sign-in enabled, and the rules in
 * server/firestore.rules. The project id and API key come from google-services.json
 * (app.config.js puts them in `extra.firebase`).
 */

const config = Constants.expoConfig?.extra?.firebase as { projectId: string; apiKey: string } | null | undefined;
export const firebaseConfigured = Boolean(config?.projectId && config?.apiKey);

const TIMEOUT_MS = 10000;

/** A stored sign-in: kept on the phone so the same anonymous user is reused. */
export type FirebaseLogin = { uid: string; refreshToken: string };
type Session = FirebaseLogin & { idToken: string; expiresAt: number };

let session: Session | null = null;

async function post(url: string, body: Record<string, string | boolean>, form = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form
        ? Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
        : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A valid Firebase ID token, signing in anonymously the first time. `saved` is the login kept
 * on the phone; `onLogin` is called when it changes, so the caller can store it.
 */
export async function firebaseSession(saved: FirebaseLogin | undefined, onLogin: (login: FirebaseLogin) => void): Promise<Session> {
  if (!config) throw new Error('Firebase is not configured');
  if (session && session.expiresAt - Date.now() > 60000) return session;
  const refresh = session?.refreshToken ?? saved?.refreshToken;
  if (refresh) {
    try {
      const data = await post(`https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`,
        { grant_type: 'refresh_token', refresh_token: refresh }, true);
      session = { uid: data.user_id, refreshToken: data.refresh_token, idToken: data.id_token,
        expiresAt: Date.now() + Number(data.expires_in) * 1000 };
      onLogin({ uid: session.uid, refreshToken: session.refreshToken });
      return session;
    } catch { /* expired or revoked: sign in again below */ }
  }
  const data = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, { returnSecureToken: true });
  session = { uid: data.localId, refreshToken: data.refreshToken, idToken: data.idToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000 };
  onLogin({ uid: session.uid, refreshToken: session.refreshToken });
  return session;
}

type Value = string | number | boolean | null | Date;

function encode(value: Value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: value };
}

function decode(field: Record<string, unknown> | undefined): Value {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue as string;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue as number;
  if ('booleanValue' in field) return field.booleanValue as boolean;
  if ('timestampValue' in field) return new Date(field.timestampValue as string);
  return null;
}

async function firestore(method: 'GET' | 'PATCH', docPath: string, idToken: string, body?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`https://firestore.googleapis.com/v1/projects/${config!.projectId}/databases/(default)/documents/${docPath}`, {
      method,
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Write (replace) a document. Returns the HTTP status (403: the rules refused it). */
export async function setDocument(docPath: string, data: Record<string, Value>, idToken: string): Promise<number> {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
  const res = await firestore('PATCH', docPath, idToken, { fields });
  return res.status;
}

/** Read a document's fields, or null when it does not exist. */
export async function getDocument(docPath: string, idToken: string): Promise<Record<string, Value> | null> {
  const res = await firestore('GET', docPath, idToken);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(data.fields ?? {}).map(([k, v]) => [k, decode(v)]));
}
