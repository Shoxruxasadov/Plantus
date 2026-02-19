import React, { useEffect, useRef } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform, Linking, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { House, Camera, Sparkle, User, PlantIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../store/appStore';
import { useTranslation } from '../i18n';
import { getAIChat, supabase } from '../services/supabase';
import { triggerHaptic } from '../utils/helpers';
import { RootStackParamList, BottomTabParamList } from '../types';
import { COLORS, DARK_COLORS } from '../utils/theme';

// Auth Screens
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import StartedScreen from '../screens/auth/StartedScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ResetEmailScreen from '../screens/auth/ResetEmailScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import SuccessScreen from '../screens/auth/SuccessScreen';

// Tab Screens
import HomeScreen from '../screens/tabs/HomeScreen';
import MyGardenScreen from '../screens/tabs/MyGardenScreen';
import AssistantScreen from '../screens/tabs/AssistantScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';

// Scanner Screen
import ScannerScreen from '../screens/scanner/ScannerScreen';
import InfoScannerScreen from '../screens/scanner/InfoScannerScreen';

// Plant Screens
import PlantScreen from '../screens/plant/PlantScreen';
import CarePlanDetailScreen from '../screens/plant/CarePlanDetailScreen';
import GroupScreen from '../screens/plant/GroupScreen';
import ArticleScreen from '../screens/plant/ArticleScreen';

// Reminder Screens
import ReminderScreen from '../screens/reminders/ReminderScreen';
import RemindersScreen from '../screens/reminders/RemindersScreen';

// Settings Screens
import PersonalScreen from '../screens/settings/PersonalScreen';
import LocationScreen from '../screens/settings/LocationScreen';
import LoadingLocationScreen from '../screens/settings/LoadingLocationScreen';
import AppSettingsScreen from '../screens/settings/AppSettingsScreen';
import SupportScreen from '../screens/settings/SupportScreen';
import WateringScreen from '../screens/settings/WateringScreen';
import FertilizingScreen from '../screens/settings/FertilizingScreen';
import RepottingScreen from '../screens/settings/RepottingScreen';

// Subscription Screens
import ProScreen from '../screens/subscription/ProScreen';
import OneTimeOfferScreen from '../screens/subscription/OneTimeOfferScreen';

// Chat Screens
import ChatScreen from '../screens/chat/ChatScreen';
import ChatProfileScreen from '../screens/chat/ChatProfileScreen';

// Tools
import LightMeterScreen from '../screens/tools/LightMeterScreen';

// Legal Screens

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const { width: SW } = Dimensions.get('window');
const TAB_BAR_BASE = 60;

// Tab bar background: berilgan SVG (markaziy tepa egri, pasti to'g'ri)
const TAB_BAR_SVG_PATH =
  'M402 127H0V18H161.742C166.74 18 171.207 15.1819 174.606 11.5186C181.181 4.43363 190.572 0 201 0C211.428 0 220.819 4.43363 227.394 11.5186C230.793 15.1819 235.26 18 240.258 18H402V127Z';

const TabBarBackground = ({ backgroundColor }: { backgroundColor: string }) => {
  const insets = useSafeAreaInsets();
  const H = 111;

  return (
    <View style={[tabBarBgStyles.wrap, { height: H }]}>
      <Svg
        width={SW}
        height={H}
        viewBox="0 0 402 127"
        preserveAspectRatio="none"
        style={tabBarBgStyles.svg}
      >
        <Path d={TAB_BAR_SVG_PATH} fill={backgroundColor} />
      </Svg>
    </View>
  );
};

const tabBarBgStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 4 : 8,
  },
  svg: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

// Custom Tab Bar Button for Scanner
const ScannerTabButton = ({ onPress }: { onPress?: (e: GestureResponderEvent) => void }) => (
  <TouchableOpacity
    style={styles.scannerButton}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.scannerButtonInner}>
      <Camera size={28} color="#FFFFFF" weight='fill'  />
    </View>
  </TouchableOpacity>
);

// Bottom Tab Navigator
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);
  const isPro = useAppStore((s) => s.isPro);
  const userCollection = useAppStore((s) => s.userCollection);
  const assistantChatId = useAppStore((s) => s.assistantChatId);
  const chatCreated = useAppStore((s) => s.chatCreated);
  const setAssistantChatId = useAppStore((s) => s.setAssistantChatId);
  const setChatCreated = useAppStore((s) => s.setChatCreated);
  const vibration = useAppStore((s) => s.vibration);
  const theme = darkMode ? DARK_COLORS : COLORS;

  const handleAssistantTabPress = (e: any, navigation: any) => {
    e.preventDefault();
    triggerHaptic(vibration);
    if (!isPro) {
      navigation.navigate('AssistantTab');
      return;
    }
    if (!userCollection?.id) {
      navigation.navigate('AssistantTab');
      return;
    }
    // Persisted chat id bo‘lsa darhol Chat ga (lag yo‘q)
    if (chatCreated && assistantChatId) {
      navigation.navigate('Chat', { chatId: assistantChatId });
      return;
    }
    (async () => {
      try {
        const { data } = await getAIChat(userCollection.id);
        if (data) {
          try {
            await setAssistantChatId(data.id);
            await setChatCreated(true);
          } catch (_) {}
          navigation.navigate('Chat', { chatId: data.id });
        } else {
          navigation.navigate('AssistantTab');
        }
      } catch (_) {
        navigation.navigate('AssistantTab');
      }
    })();
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: Platform.OS === 'android' ? (darkMode ? '#9E9E9E' : '#5D5D5D') : theme.textSecondary,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: Platform.OS === 'android' ? 4 : 0,
          shadowColor: Platform.OS === 'ios' ? '#000' : undefined,
          shadowOffset: Platform.OS === 'ios' ? { width: 0, height: -2 } : undefined,
          shadowOpacity: Platform.OS === 'ios' ? 0.08 : undefined,
          shadowRadius: Platform.OS === 'ios' ? 8 : undefined,
          height: 111,
          paddingTop: 24,
          paddingBottom: insets.bottom,
          position: 'absolute',
        },
        tabBarBackground: () => <TabBarBackground backgroundColor={theme.background} />,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: Platform.OS === 'android' ? 0 : 4,
        },
        tabBarItemStyle: {
          paddingTop: Platform.OS === 'android' ? 2 : 0,
        },
        tabBarIcon: ({ focused, color }) => {
          switch (route.name) {
            case 'HomeTab':
              return <House size={24} color={color} weight="fill" />;
            case 'GardenTab':
              return <PlantIcon size={24} color={color} weight="fill" />;
            case 'ScannerTab':
              return null; // Custom button handles this
            case 'AssistantTab':
              return <Sparkle size={24} color={color} weight="fill" />;
            case 'ProfileTab':
              return <User size={24} color={color} weight="fill" />;
          }
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: t('nav.home') }}
        listeners={() => ({
          tabPress: () => triggerHaptic(vibration),
        })}
      />
      <Tab.Screen
        name="GardenTab"
        component={MyGardenScreen}
        options={{ tabBarLabel: t('nav.myGarden') }}
        listeners={() => ({
          tabPress: () => triggerHaptic(vibration),
        })}
      />
      <Tab.Screen
        name="ScannerTab"
        component={View}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => (
            <ScannerTabButton {...props} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            triggerHaptic(vibration);
            navigation.navigate('Scanner');
          },
        })}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantScreen}
        options={{ tabBarLabel: t('nav.assistant') }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleAssistantTabPress(e, navigation),
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: t('nav.profile') }}
        listeners={() => ({
          tabPress: () => triggerHaptic(vibration),
        })}
      />
    </Tab.Navigator>
  );
};

type NavigateFn = (name: keyof RootStackParamList, params?: object) => void;

// Deep link: password reset (plantus://reset-password#access_token=...&refresh_token=...)
async function handlePasswordResetUrl(url: string, navigate: NavigateFn) {
  if (!url || !url.includes('reset-password')) return;
  const hash = url.includes('#') ? url.split('#')[1] : '';
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    try {
      await supabase.auth.setSession({ access_token, refresh_token });
      navigate('ResetPassword', {});
    } catch (e) {
      console.warn('Reset password deep link setSession:', e);
    }
  }
}

// Main Navigation
export default function Navigation() {
  const { isLoggedIn } = useAppStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    const navigate: NavigateFn = (name, params) => {
      if (navigationRef.current?.isReady()) {
        (navigationRef.current as any).navigate(name, params);
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) handlePasswordResetUrl(url, navigate);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handlePasswordResetUrl(url, navigate));
    return () => sub.remove();
  }, []);

  return (
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {isLoggedIn ? (
          <>
            {/* Logged in - go straight to main app */}
            <Stack.Screen name="MainTabs" component={TabNavigator} />
          </>
        ) : (
          <>
            {/* Not logged in - show onboarding & auth */}
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Started" component={StartedScreen} />
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ResetEmail" component={ResetEmailScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen name="MainTabs" component={TabNavigator} />
          </>
        )}

        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="Success" component={SuccessScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MyGarden" component={MyGardenScreen} />
        <Stack.Screen name="Assistant" component={AssistantScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />

        {/* Scanner: native back (elastic), header to‘liq transparent, flash/rotate sahifada liquid glass */}
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{
            headerShown: true,
            headerTransparent: true,
            headerTitle: '',
            headerShadowVisible: false,
            headerBackTitleVisible: false,
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: 'transparent' }} />
            ),
          }}
        />
        <Stack.Screen name="InfoScanner" component={InfoScannerScreen} />

        {/* Plant screens */}
        <Stack.Screen name="Plant" component={PlantScreen} />
        <Stack.Screen name="CarePlanDetail" component={CarePlanDetailScreen} />
        <Stack.Screen name="Group" component={GroupScreen} />
        <Stack.Screen name="Article" component={ArticleScreen} />

        {/* Reminders */}
        <Stack.Screen name="Reminder" component={ReminderScreen} />
        <Stack.Screen name="Reminders" component={RemindersScreen} />

        {/* Settings */}
        <Stack.Screen name="Personal" component={PersonalScreen} />
        <Stack.Screen name="Location" component={LocationScreen} />
        <Stack.Screen name="LoadingLocation" component={LoadingLocationScreen} />
        <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Watering" component={WateringScreen} />
        <Stack.Screen name="Fertilizing" component={FertilizingScreen} />
        <Stack.Screen name="Repotting" component={RepottingScreen} />

        {/* Subscription — full-screen modal, slide from bottom, 250ms */}
        <Stack.Screen
          name="Pro"
          component={ProScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            animationDuration: 200,
          }}
        />
        <Stack.Screen
          name="OneTimeOffer"
          component={OneTimeOfferScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            animationDuration: 100,
          }}
        />

        {/* Tools */}
        <Stack.Screen name="LightMeter" component={LightMeterScreen} />

        {/* Chat */}
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ChatProfile" component={ChatProfileScreen} />

      </Stack.Navigator>
      </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  scannerButton: {
    top: -13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
