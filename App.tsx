import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import { ModelStoreProvider } from './src/map3d/ModelStore';
import { listenForAlertNotifications, parseAlertUrl, type AlertRequest } from './src/emergency/alertLinks';
import { loadAlignment } from './src/location/campusGps';
import styles from './src/styles/App.styles';

/**
 * Alerts open the guide directly: an alert link (tomasafe://alert/...) from the SMS or a web
 * page, or a tap on the emergency push notification (builds only; Expo Go skips notifications).
 */
export default function App() {
  const [request, setRequest] = useState<(AlertRequest & { id: number }) | null>(null);

  useEffect(() => {
    void loadAlignment(); // saved GPS map alignment from earlier calibrations
    let id = 0;
    const open = (alert: AlertRequest | null) => { if (alert) setRequest({ ...alert, id: ++id }); };
    void Linking.getInitialURL().then(url => open(parseAlertUrl(url))).catch(() => {});
    const link = Linking.addEventListener('url', ({ url }) => open(parseAlertUrl(url)));
    const stopNotifications = listenForAlertNotifications(open);
    return () => { link.remove(); stopNotifications(); };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <ModelStoreProvider>
          <HomeScreen emergencyRequest={request} />
        </ModelStoreProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
