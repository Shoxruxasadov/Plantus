import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Platform, type GestureResponderEvent } from 'react-native';
import { House, Camera, Sparkle, User, PlantIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../store/appStore';
import { getAIChat } from '../services/supabase';
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

// Subscription Screen
import ProScreen from '../screens/subscription/ProScreen';

// Chat Screens
import ChatScreen from '../screens/chat/ChatScreen';
import ChatProfileScreen from '../screens/chat/ChatProfileScreen';

// Tools
import LightMeterScreen from '../screens/tools/LightMeterScreen';

// Legal Screens
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen';
import TermsUseScreen from '../screens/legal/TermsUseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

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
  const darkMode = useAppStore((s) => s.darkMode);
  const userCollection = useAppStore((s) => s.userCollection);
  const theme = darkMode ? DARK_COLORS : COLORS;

  const handleAssistantTabPress = (e: any, navigation: any) => {
    e.preventDefault();
    (async () => {
      if (!userCollection?.id) {
        navigation.navigate('AssistantTab');
        return;
      }
      const { data } = await getAIChat(userCollection.id);
      if (data) {
        navigation.navigate('Chat', { chatId: data.id });
      } else {
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
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color }) => {
          const weight = focused ? 'fill' : 'regular';
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
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="GardenTab"
        component={MyGardenScreen}
        options={{ tabBarLabel: 'My Garden' }}
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
            navigation.navigate('Scanner');
          },
        })}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantScreen}
        options={{ tabBarLabel: 'Assistant' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleAssistantTabPress(e, navigation),
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main Navigation
export default function Navigation() {
  const { isLoggedIn } = useAppStore();

  return (
    <NavigationContainer>
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
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="Success" component={SuccessScreen} />
            <Stack.Screen name="MainTabs" component={TabNavigator} />
          </>
        )}

        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MyGarden" component={MyGardenScreen} />
        <Stack.Screen name="Assistant" component={AssistantScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />

        {/* Scanner */}
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          // options={{ animation: 'slide_from_bottom' }}
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

        {/* Subscription */}
        {/* <Stack.Screen
          name="Pro"
          component={ProScreen}
          // options={{ animation: 'slide_from_bottom' }}
        /> */}

        {/* Tools */}
        <Stack.Screen name="LightMeter" component={LightMeterScreen} />

        {/* Chat */}
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ChatProfile" component={ChatProfileScreen} />

        {/* Legal */}
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="TermsUse" component={TermsUseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  scannerButton: {
    top: -20,
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
