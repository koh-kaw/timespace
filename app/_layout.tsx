import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';
import { setupAndroidChannel, requestNotificationPermission } from '../lib/notifications';

export default function RootLayout() {
  const setUserId = useSessionStore((s) => s.setUserId);

  useEffect(() => {
    setupAndroidChannel();
    requestNotificationPermission();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, [setUserId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#080714' },
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '500', color: '#FFFFFF' },
            headerTintColor: '#8B7FFF',
            contentStyle: { backgroundColor: '#080714' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Timespace', headerShown: false }} />
          <Stack.Screen name="signin" options={{ headerShown: false }} />
          <Stack.Screen name="goals/index" options={{ title: '目標' }} />
          <Stack.Screen name="settings" options={{ title: '設定' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
