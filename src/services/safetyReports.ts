import { ensureNotificationPermission, notificationsSupported } from '../emergency/alertLinks';
import { firebaseConfigured, firebaseSession, getDocument, setDocument, type FirebaseLogin } from './firebaseRest';

/**
 * Connects this phone to the TomaSafe system: who it belongs to (the sign-in: name, ID number,
 * mobile number and recipient type, entered once), push registration, and status reports for
 * the active alert, so the admin dashboard can count who is navigating, who reached an
 * evacuation area and who is safe.
 *
 * The sign-in also makes the owner a recipient in the admin panel (SMS alerts to their number),
 * linked to this phone. It is kept under the phone's Android ID, which survives uninstalling the
 * app, so a reinstalled app restores it instead of asking again.
 *
 * Two routes, tried in order:
 *  1. Firebase (Firestore, over any internet connection). The PC server listens to it.
 *  2. The PC server directly (EXPO_PUBLIC_API_URL), which only works on the same network.
 *
 * Reports are best effort and never block the user: the latest unsent report is retried every
 * 15 s until it goes through (or the alert is closed), even after navigation has ended.
 */

/** PC server address for the direct route, set at build time (eas.json / .env). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const reachable = firebaseConfigured || Boolean(API_URL);

export type RecipientType = 'student' | 'faculty' | 'campus_personnel';
export const RECIPIENT_TYPES: { id: RecipientType; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'campus_personnel', label: 'Campus Personnel' },
];
/** Philippine mobile number as the admin panel stores it: 09XXXXXXXXX. */
export const PHONE_PATTERN = /^09\d{9}$/;

/** The owner's sign-in. phone and recipientType are missing on profiles saved by older versions
 * (and when only a name was entered while confirming safe during an alert). */
export type Profile = { name: string; idNumber: string; phone?: string; recipientType?: RecipientType };
export type CompleteProfile = Required<Profile>;

export function isCompleteProfile(profile: Profile | null | undefined): profile is CompleteProfile {
  return Boolean(profile && profile.name.trim().length >= 2 && profile.phone && PHONE_PATTERN.test(profile.phone)
    && RECIPIENT_TYPES.some(type => type.id === profile.recipientType));
}
export type SafetyStatus = 'navigating' | 'arrived' | 'safe_confirmed';
export type ReportArea = { id: string; name: string };
/** sent: the system has it. queued: will retry. skipped: nothing to do (no route or alert). */
export type ReportResult = 'sent' | 'queued' | 'skipped';

const RANK: Record<SafetyStatus, number> = { navigating: 0, arrived: 1, safe_confirmed: 2 };
const RETRY_MS = 15000;
const TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Device id, profile and Firebase sign-in, saved on the phone.

/** profileDirty: changed on this phone and not yet saved to profiles/{androidId}. */
type Saved = { deviceId: string; profile: Profile | null; profileDirty?: boolean; firebase?: FirebaseLogin };
const USER_FILE = 'tomasafe-user.json';
let saved: Saved | null = null;
const listeners = new Set<(profile: Profile | null) => void>();

function userFile() {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new File(Paths.document, USER_FILE);
}

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const RESTORE_MS = 7000;

/** The phone's Android ID: the same after the app is uninstalled and installed again (it changes
 * only on a factory reset, or with a differently signed build). Null elsewhere. */
const androidId: string | null = (() => {
  try {
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS !== 'android') return null;
    const id = (require('expo-application') as typeof import('expo-application')).getAndroidId();
    return typeof id === 'string' && ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
})();

function newDeviceId() {
  let id = 'ts-';
  for (let i = 0; i < 24; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

function persist() {
  try {
    const file = userFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(saved));
  } catch { /* storage unavailable: keep it for this session */ }
}

/**
 * Load this phone's id and profile. Call once at startup. On a fresh install, first looks for a
 * sign-in saved before the app was uninstalled (by Android ID), so the user is not asked again.
 */
export async function loadUser(): Promise<Profile | null> {
  if (saved) return saved.profile;
  try {
    const file = userFile();
    if (file.exists) {
      const data = JSON.parse(await file.text()) as Saved;
      if (typeof data?.deviceId === 'string' && data.deviceId.length >= 8) saved = data;
    }
  } catch { /* corrupt: start fresh */ }
  if (!saved) saved = { deviceId: androidId ?? newDeviceId(), profile: null };
  // Installs from before the Android ID was used move over to it.
  if (androidId && saved.deviceId !== androidId) saved.deviceId = androidId;
  persist();
  await restoreSavedProfile();
  return saved.profile;
}

/**
 * No sign-in on this phone (fresh install): take the one saved for its Android ID, if any.
 * Gives up after a few seconds so the app never waits long; registerForPush tries again.
 */
async function restoreSavedProfile(): Promise<boolean> {
  if (!androidId || !saved || saved.profile) return false;
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), RESTORE_MS));
  const restored = await Promise.race([fetchSavedProfile().catch(() => null), timeout]);
  // The user may have signed in while this was loading: theirs wins.
  if (!restored || saved.profile) return false;
  saved.profile = restored;
  saved.profileDirty = false;
  persist();
  listeners.forEach(fn => fn(restored));
  return true;
}

/** A sign-in from the server's copy (Firestore or the PC server), checked; null if not usable. */
function profileFrom(data: Record<string, unknown> | null | undefined): CompleteProfile | null {
  if (!data) return null;
  const profile = {
    name: typeof data.name === 'string' ? data.name.trim() : '',
    idNumber: typeof data.idNumber === 'string' ? data.idNumber.trim() : '',
    phone: typeof data.phone === 'string' ? data.phone.trim() : '',
    recipientType: data.recipientType as RecipientType,
  };
  return isCompleteProfile(profile) ? profile : null;
}

/** The sign-in saved for this phone's Android ID (Firebase first, then the PC server). */
async function fetchSavedProfile(): Promise<CompleteProfile | null> {
  if (!androidId) return null;
  if (firebaseConfigured) {
    try {
      const { idToken } = await firebase();
      return profileFrom(await getDocument(`profiles/${androidId}`, idToken));
    } catch { /* fall back to the PC server */ }
  }
  const res = await request(`/api/app/profile?deviceId=${encodeURIComponent(androidId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { profile?: Record<string, unknown> | null };
  return profileFrom(data.profile);
}

const sameProfile = (a: Profile, b: Profile) =>
  a.name === b.name && a.idNumber === b.idNumber && a.phone === b.phone && a.recipientType === b.recipientType;

/**
 * Keeps profiles/{androidId} and this phone in step: a sign-in changed here is saved there;
 * otherwise a change made there (an admin edited the recipient) is taken here.
 */
async function syncSavedProfile(uid: string, idToken: string) {
  if (!androidId || !saved) return;
  const local = saved.profile;
  if (saved.profileDirty) {
    if (!isCompleteProfile(local)) return;
    const status = await setDocument(`profiles/${androidId}`, {
      name: local.name, idNumber: local.idNumber || null, phone: local.phone, recipientType: local.recipientType,
      uid, updatedAt: new Date(),
    }, idToken);
    if (status >= 200 && status < 300 && saved.profile === local) { saved.profileDirty = false; persist(); }
    return;
  }
  const remote = profileFrom(await getDocument(`profiles/${androidId}`, idToken));
  if (remote && saved.profile === local && (!local || !sameProfile(local, remote))) {
    saved.profile = remote;
    persist();
    listeners.forEach(fn => fn(remote));
  }
}

export function getProfile(): Profile | null {
  return saved?.profile ?? null;
}

/** Save the sign-in, and (re-)register for push alerts with it. */
export function saveProfile(profile: Profile) {
  if (!saved) saved = { deviceId: androidId ?? newDeviceId(), profile: null };
  const phone = profile.phone?.trim();
  saved.profile = {
    name: profile.name.trim(), idNumber: profile.idNumber.trim(),
    // A name-only save (confirming safe during an alert) keeps a number entered earlier.
    phone: phone || saved.profile?.phone,
    recipientType: profile.recipientType ?? saved.profile?.recipientType,
  };
  saved.profileDirty = true;
  persist();
  listeners.forEach(fn => fn(saved!.profile));
  void registerForPush();
}

export function onProfileChange(fn: (profile: Profile | null) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Firebase sign-in for this phone (anonymous; the same user is reused across restarts). */
function firebase() {
  return firebaseSession(saved?.firebase, login => {
    if (!saved) return;
    if (saved.firebase?.uid !== login.uid || saved.firebase?.refreshToken !== login.refreshToken) {
      saved.firebase = login;
      persist();
    }
  });
}

// ---------------------------------------------------------------------------
// Direct route to the PC server

async function request(path: string, init?: { method: string; body: unknown }) {
  if (!API_URL) throw new Error('No server address');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_URL + path, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Push registration

/**
 * Whether this phone can receive push alerts, shown on the alert screen:
 * unavailable (Expo Go / nothing configured), needs-name, blocked (notifications not allowed),
 * no-push (no Firebase token), offline (could not register, retrying), registered.
 */
export type PushStatus = 'unavailable' | 'needs-name' | 'checking' | 'blocked' | 'no-push' | 'offline' | 'registered';
let pushStatus: PushStatus = 'checking';
const pushListeners = new Set<(status: PushStatus) => void>();
function setPushStatus(status: PushStatus) {
  pushStatus = status;
  pushListeners.forEach(fn => fn(status));
}
export function getPushStatus() { return pushStatus; }
export function onPushStatus(fn: (status: PushStatus) => void) {
  pushListeners.add(fn);
  return () => { pushListeners.delete(fn); };
}

let pushToken: string | null = null;
let tokenListener: { remove: () => void } | null = null;
let pushRetry: ReturnType<typeof setTimeout> | null = null;
let registering: Promise<void> | null = null;
const PUSH_RETRY_MS = 30000;

/**
 * Registers this phone for emergency push alerts with the owner's sign-in, so admins know whose
 * device it is and it is linked to their recipient (SMS). Builds only (Expo Go has no push), and
 * only once a name is saved; the mobile number and type are sent once entered.
 * Safe to call often (app start, back to the app, profile saved): calls share one attempt, and
 * a failed attempt retries every 30 s.
 */
export function registerForPush(): Promise<void> {
  if (!registering) registering = doRegister().finally(() => { registering = null; });
  return registering;
}

async function doRegister() {
  if (pushRetry) { clearTimeout(pushRetry); pushRetry = null; }
  if (!notificationsSupported || !reachable) { setPushStatus('unavailable'); return; }
  if (!saved?.profile?.name && !(await restoreSavedProfile())) { setPushStatus('needs-name'); return; }
  if (!saved?.profile?.name) { setPushStatus('needs-name'); return; }
  const N = require('expo-notifications') as typeof import('expo-notifications');
  if (!(await ensureNotificationPermission())) { setPushStatus('blocked'); return; }
  try {
    if (!pushToken) pushToken = String((await N.getDevicePushTokenAsync()).data);
  } catch (error) {
    console.warn('Push token unavailable:', error);
    setPushStatus('no-push');
    pushRetry = setTimeout(() => { void registerForPush(); }, PUSH_RETRY_MS);
    return;
  }
  // Firebase rotates tokens now and then: register the new one for the same phone.
  if (!tokenListener) {
    tokenListener = N.addPushTokenListener(token => { pushToken = String(token.data); void registerForPush(); });
  }
  // 1. Firebase: works on any internet connection.
  if (firebaseConfigured) {
    try {
      const { uid, idToken } = await firebase();
      try { await syncSavedProfile(uid, idToken); } catch { /* not needed to register */ }
      const profile = saved.profile!;
      const signIn: Record<string, string> = {};
      if (isCompleteProfile(profile)) { signIn.phone = profile.phone; signIn.recipientType = profile.recipientType; }
      if (androidId) signIn.androidId = androidId;
      const status = await setDocument(`devices/${uid}`, {
        token: pushToken, name: profile.name, idNumber: profile.idNumber || null, ...signIn,
        platform: 'android', updatedAt: new Date(),
      }, idToken);
      if (status >= 200 && status < 300) { setPushStatus('registered'); return; }
      console.warn('Firestore registration refused: HTTP', status);
    } catch (error) {
      console.warn('Firebase registration failed:', error);
    }
  }
  // 2. The PC server directly (same network only).
  const profile = saved.profile!;
  const complete = isCompleteProfile(profile);
  try {
    const res = await request('/api/devices/register', {
      method: 'POST',
      body: {
        token: pushToken, deviceId: saved.deviceId, name: profile.name, idNumber: profile.idNumber || undefined,
        phone: complete ? profile.phone : undefined, recipientType: complete ? profile.recipientType : undefined,
        androidId: androidId ?? undefined,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setPushStatus('registered');
  } catch (error) {
    console.warn('Push registration failed:', error);
    setPushStatus('offline');
    pushRetry = setTimeout(() => { void registerForPush(); }, PUSH_RETRY_MS);
  }
}

// ---------------------------------------------------------------------------
// The active alert and status reports

let incidentId: number | null = null;
let sentRank = -1;
let pending: { status: SafetyStatus; area?: ReportArea } | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** The alert this phone reports to: from a push tap, or looked up. */
export function setIncident(id: number | null | undefined) {
  if (id == null || !Number.isInteger(id) || id === incidentId) return;
  incidentId = id;
  sentRank = -1;
}

/** The active alert's id (Firebase first, then the PC server), or null when none is active. */
async function fetchActiveIncident(): Promise<number | null> {
  if (firebaseConfigured) {
    try {
      const { idToken } = await firebase();
      const meta = await getDocument('meta/activeIncident', idToken);
      const id = meta?.active ? Number(meta.id) : null;
      if (id != null && Number.isInteger(id)) setIncident(id);
      return id;
    } catch { /* fall back to the PC server */ }
  }
  const res = await request('/api/app/incident');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { incident?: { id: number } | null };
  if (data.incident) setIncident(data.incident.id);
  return data.incident?.id ?? null;
}

/** Sends one report. 'closed': that alert is no longer active. */
async function send(report: { status: SafetyStatus; area?: ReportArea }): Promise<'ok' | 'closed'> {
  const profile = saved?.profile;
  if (firebaseConfigured) {
    try {
      const { uid, idToken } = await firebase();
      const status = await setDocument(`incidents/${incidentId}/status/${uid}`, {
        status: report.status, rank: RANK[report.status],
        areaId: report.area?.id ?? null, areaName: report.area?.name ?? null,
        name: profile?.name ?? null, idNumber: profile?.idNumber || null, updatedAt: new Date(),
      }, idToken);
      if (status >= 200 && status < 300) return 'ok';
      // The rules only accept reports for the active alert.
      if (status === 403) return 'closed';
    } catch { /* fall back to the PC server */ }
  }
  const res = await request('/api/app/status', {
    method: 'POST',
    body: {
      incidentId, deviceId: saved?.deviceId, status: report.status,
      areaId: report.area?.id, areaName: report.area?.name,
      name: profile?.name || undefined, idNumber: profile?.idNumber || undefined,
    },
  });
  if (res.status === 409) return 'closed';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return 'ok';
}

/**
 * Tell the system this phone is navigating, has arrived in an evacuation area, or is safe.
 * Statuses only move forward; a lower one than already reported is ignored.
 */
export async function reportStatus(status: SafetyStatus, area?: ReportArea): Promise<ReportResult> {
  if (!reachable) return 'skipped';
  // Arriving in a different area is still news; anything below what was sent is not.
  if (RANK[status] < sentRank || (RANK[status] === sentRank && status !== 'arrived')) return 'skipped';
  if (pending && RANK[pending.status] > RANK[status]) return 'queued';
  pending = { status, area };
  return flush();
}

async function flush(retried = false): Promise<ReportResult> {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  const report = pending;
  if (!report) return 'sent';
  try {
    if (incidentId == null && (await fetchActiveIncident()) == null) {
      // No active alert (e.g. testing without one): nothing to report to.
      pending = null;
      return 'skipped';
    }
    if ((await send(report)) === 'closed') {
      // That alert was closed. Try once more against the current one, if any.
      incidentId = null;
      if (retried || (await fetchActiveIncident()) == null) { pending = null; return 'skipped'; }
      return flush(true);
    }
    sentRank = Math.max(sentRank, RANK[report.status]);
    if (pending === report) pending = null;
    return 'sent';
  } catch {
    retryTimer = setTimeout(() => { void flush(); }, RETRY_MS);
    return 'queued';
  }
}

/** Start of navigation: find the active alert and report "navigating". */
export function startReporting(pushIncidentId?: number | null) {
  setIncident(pushIncidentId);
  void reportStatus('navigating');
}
