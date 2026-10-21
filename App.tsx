import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import styles from './src/styles/App.styles';

/**
 * Field-test workflow for Expo Go. It deliberately does not import
 * expo-notifications. Later the FCM notification-tap handler can pass
 * { id, type } as an emergencyRequest to HomeScreen.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <HomeScreen />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
