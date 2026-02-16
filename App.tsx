import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import Navigation from './src/navigation';
import { useAppStore } from './src/store/appStore';
import { supabase } from './src/services/supabase';
import { initializeRevenueCat, identifyUser } from './src/services/revenueCat';

const SPLASH_BG = '#1B5E20';
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const showAppTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setUser, setSession, initializePersistedState, setIsInited, darkMode } = useAppStore();

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
          ...MaterialCommunityIcons.font,
        });
        await initializePersistedState();
        await initializeRevenueCat();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session.user);
          await identifyUser(session.user.id);
        }
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session) {
            setSession(session);
            setUser(session.user);
            await identifyUser(session.user.id);
          } else {
            setSession(null);
            setUser(null);
          }
        });
        setIsInited(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (!appIsReady) return;
    (async () => {
      await SplashScreen.hideAsync();
      showAppTimeout.current = setTimeout(() => setShowApp(true), 2500);
    })();
    return () => {
      if (showAppTimeout.current) clearTimeout(showAppTimeout.current);
    };
  }, [appIsReady]);

  const onLayoutRootView = useCallback(() => {}, []);

  if (!appIsReady) {
    return null;
  }

  if (!showApp) {
    return (
      <View style={[styles.splashWrap, { backgroundColor: SPLASH_BG }]}>
        <StatusBar style="light" />
        <Image
          source={require('./assets/splash5.gif')}
          style={styles.splashImage}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <Navigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
});
