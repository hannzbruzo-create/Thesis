import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { NotificationResponse } from 'expo-notifications';
import { parseEmergencyType, type EmergencyType } from './emergencyTypes';

/** An emergency alert that should open the guide (or go straight to the map when `outside`). */
export type AlertRequest = { type: EmergencyType; outside: boolean };

/**
 * Reads an alert link from the SMS or a web page, e.g.
 *   tomasafe://alert/EQ-1028?type=earthquake
 *   tomasafe://alert?type=fire&outside=1
 *   tomasafe://earthquake
 * The type comes from `type`/`emergency`, else from the alert id prefix (EQ / FR), else the path.
 */
export function parseAlertUrl(url: string | null | undefined): AlertRequest | null {
  if (!url || !url.toLowerCase().startsWith('tomasafe://')) return null;
  const [path, query = ''] = url.slice('tomasafe://'.length).split('?');
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k) params[decodeURIComponent(k).toLowerCase()] = decodeURIComponent(v);
  }
  const parts = path.toLowerCase().split('/').filter(Boolean);
  let type = parseEmergencyType(params);
  const id = parts[0] === 'alert' ? parts[1] ?? '' : '';
  if (!type && id.startsWith('eq')) type = 'earthquake';
  if (!type && (id.startsWith('fr') || id.startsWith('fi'))) type = 'fire';
  if (!type) type = parseEmergencyType({ type: parts.find(p => p === 'earthquake' || p === 'fire') });
  if (!type) return null;
  return { type, outside: params.outside === '1' || params.outside === 'true' };
}

/** Expo Go (store client) has no remote push on Android; notification code only runs in builds. */
export const notificationsSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Notification category with the two buttons shown on the alert. */
export const ALERT_CATEGORY = 'emergency-alert';
/** Android channel for alerts: loudest importance, shows on the lock screen. */
export const ALERT_CHANNEL = 'emergency';

/**
 * Sets up emergency push notifications (channel, buttons, foreground display) and calls
 * `onAlert` when the user taps an alert or one of its buttons, including the tap that launched
 * the app. The push payload must carry `data.emergencyType` ("earthquake" | "fire").
 * Returns an unsubscribe function. Does nothing in Expo Go.
 */
export function listenForAlertNotifications(onAlert: (request: AlertRequest) => void): () => void {
  if (!notificationsSupported) return () => {};
  // Loaded lazily so Expo Go never touches the notifications native module.
  const N = require('expo-notifications') as typeof import('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  void N.requestPermissionsAsync().catch(() => {});
  void N.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: 'Emergency alerts',
    importance: N.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    bypassDnd: true,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
  }).catch(() => {});
  void N.setNotificationCategoryAsync(ALERT_CATEGORY, [
    { identifier: 'open', buttonTitle: 'Open guide', options: { opensAppToForeground: true } },
    { identifier: 'outside', buttonTitle: "I'm safe outside", options: { opensAppToForeground: true } },
  ]).catch(() => {});

  const handle = (response: NotificationResponse | null) => {
    if (!response) return;
    const type = parseEmergencyType(response.notification.request.content.data as Record<string, unknown>);
    if (type) onAlert({ type, outside: response.actionIdentifier === 'outside' });
  };
  void N.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
