import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, Sun, Moon, CloudSun, Lightbulb, Camera } from 'phosphor-react-native';
import { LightSensor } from 'expo-sensors';
import { CameraView, Camera as ExpoCamera } from 'expo-camera';
import { getColors } from 'react-native-image-colors';

import { FONT_SIZES, SPACING } from '../../utils/theme';
import { useTheme } from '../../hooks';
import type { RootStackParamList } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_PREVIEW_HEIGHT = 160;

/** Hex "#RRGGBB" -> relative luminance (0–255). */
function hexToLuminance(hex: string): number {
  const h = String(hex).replace('#', '').trim();
  if (h.length !== 6) return 128;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r + g + b)) return 128;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Map camera luminance (0–255) to approximate lux for display. */
function luminanceToLux(luminance: number): number {
  const t = Math.min(255, Math.max(0, luminance)) / 255;
  return Math.round(t * t * 12000);
}

const MIN_LUX = 0;
const MAX_LUX = 100000;

const LIGHT_LEVELS: { min: number; level: string; color: string; icon: string; description: string }[] = [
  { min: 0, level: 'Very Dark', color: '#1A1A2E', icon: 'moon', description: 'Almost no light detected' },
  { min: 10, level: 'Dark', color: '#16213E', icon: 'moon', description: 'Suitable for night vision' },
  { min: 50, level: 'Dim', color: '#0F4C75', icon: 'cloudsun', description: 'Minimal reading light' },
  { min: 200, level: 'Indoor', color: '#3282B8', icon: 'lightbulb', description: 'Comfortable indoor lighting' },
  { min: 1000, level: 'Bright', color: '#BBE1FA', icon: 'cloudsun', description: 'Bright office or retail space' },
  { min: 10000, level: 'Very Bright', color: '#FFD93D', icon: 'sun', description: 'Overcast outdoor conditions' },
  { min: 50000, level: 'Daylight', color: '#FF6B6B', icon: 'sun', description: 'Direct sunlight exposure' },
];

function getLevelForLux(lux: number) {
  let out = LIGHT_LEVELS[0];
  for (const l of LIGHT_LEVELS) {
    if (lux >= l.min) out = l;
  }
  return out;
}

export default function LightMeterScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [lux, setLux] = useState<number>(0);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Android: real light sensor
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setSensorAvailable(false);
      setInitializing(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const available = await LightSensor.isAvailableAsync();
        if (!mounted) return;
        if (!available) {
          setSensorAvailable(false);
          setInitializing(false);
          return;
        }
        const perm = await LightSensor.getPermissionsAsync();
        if (!mounted) return;
        if (!perm.granted) {
          const requested = await LightSensor.requestPermissionsAsync();
          if (!mounted) return;
          if (!requested.granted) {
            setSensorAvailable(false);
            setInitializing(false);
            return;
          }
        }
        setSensorAvailable(true);
        setInitializing(false);
        // Android 12+ min interval 200ms
        LightSensor.setUpdateInterval(250);
        const sub = LightSensor.addListener((data: { illuminance: number }) => {
          const value = Math.max(MIN_LUX, Math.min(MAX_LUX, Math.round(Number(data.illuminance) || 0)));
          setLux(value);
        });
        subscriptionRef.current = sub;
      } catch (e) {
        if (mounted) {
          setSensorAvailable(false);
          setInitializing(false);
        }
      }
    })();
    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, []);

  // No sensor: try camera-based estimation, else random demo
  useEffect(() => {
    if (sensorAvailable === true) return;
    if (initializing) return;

    let mounted = true;

    const runCameraLoop = async () => {
      if (!cameraRef.current || !mounted) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: false,
        });
        if (!mounted || !photo?.uri) return;
        const colors = await getColors(photo.uri, { quality: 'low' }) as Record<string, string | undefined>;
        if (!mounted) return;
        const hex =
          colors.dominant ?? colors.average ?? colors.primary ?? colors.background ?? colors.vibrant ?? colors.muted ?? '#808080';
        const lum = hexToLuminance(hex);
        const luxValue = Math.max(MIN_LUX, Math.min(MAX_LUX, luminanceToLux(lum)));
        setLux(luxValue);
      } catch (_) {
        // ignore single frame errors
      }
      if (mounted) scheduleCapture();
    };

    const scheduleCapture = () => {
      captureTimeoutRef.current = setTimeout(runCameraLoop, 1200);
    };

    (async () => {
      try {
        const { status } = await ExpoCamera.requestCameraPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setCameraAllowed(false);
          setCameraError(null);
          startFallbackSimulation();
          return;
        }
        setCameraAllowed(true);
        setCameraError(null);
        setTimeout(() => scheduleCapture(), 800);
      } catch (e) {
        if (mounted) {
          setCameraAllowed(false);
          setCameraError('Camera not available');
          startFallbackSimulation();
        }
      }
    })();

    function startFallbackSimulation() {
      const id = setInterval(() => {
        setLux((prev) => {
          if (prev < 600) return prev + 12;
          return 380 + Math.round(Math.random() * 440);
        });
      }, 200);
      simIntervalRef.current = id;
    }

    return () => {
      mounted = false;
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [sensorAvailable, initializing]);

  const levelInfo = getLevelForLux(lux);
  const progress = Math.min(1, Math.max(0, lux / MAX_LUX));

  const IconComponent =
    levelInfo.icon === 'sun'
      ? Sun
      : levelInfo.icon === 'moon'
        ? Moon
        : levelInfo.icon === 'lightbulb'
          ? Lightbulb
          : CloudSun;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <CaretLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Light Meter</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]}>
        {initializing ? (
          <View style={[styles.meterCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.initText, { color: theme.textSecondary }]}>Initializing light sensor...</Text>
          </View>
        ) : (
          <>
            {sensorAvailable === false && cameraAllowed === true && (
              <View style={styles.cameraWrap}>
                <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
                <View style={styles.cameraLabelWrap}>
                  <Camera size={16} color={theme.textSecondary} />
                  <Text style={[styles.cameraLabel, { color: theme.textSecondary }]}>
                    Point at light source for estimate
                  </Text>
                </View>
              </View>
            )}
            <View
            style={[
              styles.meterCard,
              {
                backgroundColor: theme.card,
                borderColor: levelInfo.color + '80',
                borderWidth: 2,
                overflow: 'hidden',
              },
            ]}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: levelInfo.color,
                  opacity: isDark ? 0.15 : 0.08,
                },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: levelInfo.color + '33' }]}>
              <IconComponent size={60} color={levelInfo.color} weight="duotone" />
            </View>

            <Text style={[styles.luxValue, { color: levelInfo.color }]}>{Math.round(lux)}</Text>
            <Text style={[styles.luxUnit, { color: levelInfo.color + 'B3' }]}>lux</Text>

            <Text style={[styles.levelName, { color: theme.text }]}>{levelInfo.level}</Text>
            <Text style={[styles.levelDesc, { color: theme.textSecondary }]}>{levelInfo.description}</Text>

            <View style={[styles.progressTrack, { backgroundColor: (isDark ? '#fff' : '#000') + '20' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: levelInfo.color,
                  },
                ]}
              />
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: theme.textTertiary }]}>0 lux</Text>
              <Text style={[styles.rangeLabel, { color: theme.textTertiary }]}>100k lux</Text>
            </View>

            {sensorAvailable === false && (
              <Text style={[styles.demoLabel, { color: theme.textTertiary }]}>
                {cameraAllowed === true
                  ? 'Estimated from camera (no light sensor)'
                  : cameraError || 'Demo — no sensor on this device'}
              </Text>
            )}
          </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: SPACING.sm },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700' },
  placeholder: { width: 40 },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    justifyContent: 'center',
  },
  cameraWrap: {
    width: '100%',
    marginBottom: SPACING.lg,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  cameraPreview: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: CAMERA_PREVIEW_HEIGHT,
  },
  cameraLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  cameraLabel: {
    fontSize: FONT_SIZES.sm,
  },
  meterCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minHeight: 400,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  luxValue: {
    fontSize: 72,
    fontWeight: '700',
  },
  luxUnit: {
    fontSize: 24,
    marginTop: 4,
  },
  levelName: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: 16,
  },
  levelDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: SPACING.lg,
  },
  progressTrack: {
    height: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 32,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  rangeLabel: {
    fontSize: 12,
  },
  initText: {
    marginTop: 16,
    fontSize: FONT_SIZES.md,
  },
  demoLabel: {
    marginTop: 16,
    fontSize: FONT_SIZES.sm,
  },
});
