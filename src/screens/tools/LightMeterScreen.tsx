import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, ArrowLeft, Sun, Moon, CloudSun, Lightbulb } from 'phosphor-react-native';
import { LightSensor } from 'expo-sensors';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';

// react-native-image-colors is a native module — not available in Expo Go; use dev build (expo run:ios)
let ImageColorsModule: typeof import('react-native-image-colors') | null = null;
try {
  ImageColorsModule = require('react-native-image-colors').default;
} catch {
  ImageColorsModule = null;
}

import { FONT_SIZES, SPACING, RADIUS, COLORS } from '../../utils/theme';
import { useTheme } from '../../hooks';

const MIN_LUX = 0;
const MAX_LUX = 100000;
const CAMERA_SAMPLE_INTERVAL_MS = 100;

const LIGHT_LEVELS: { min: number; level: string; color: string; icon: string; description: string }[] = [
  { min: 0, level: 'Very Dark', color: '#1A1A2E', icon: 'moon', description: 'Almost no light' },
  { min: 10, level: 'Dark', color: '#16213E', icon: 'moon', description: 'Night vision' },
  { min: 50, level: 'Dim', color: '#0F4C75', icon: 'cloudsun', description: 'Minimal reading' },
  { min: 200, level: 'Indoor', color: '#3282B8', icon: 'lightbulb', description: 'Comfortable indoor' },
  { min: 1000, level: 'Bright', color: '#BBE1FA', icon: 'cloudsun', description: 'Office / retail' },
  { min: 10000, level: 'Very Bright', color: '#FFD93D', icon: 'sun', description: 'Overcast outdoor' },
  { min: 50000, level: 'Daylight', color: '#FF6B6B', icon: 'sun', description: 'Direct sunlight' },
];

function getLevelForLux(lux: number) {
  let out = LIGHT_LEVELS[0];
  for (const l of LIGHT_LEVELS) {
    if (lux >= l.min) out = l;
  }
  return out;
}

function hexToLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// iOS: camera → dominant color → luminance → lux (estimate).
// Calibration: dark → 0, room ~400–500, outdoor bright 5k–10k (avoid 35k–99k for indoor).
function luminanceToLux(luminance: number): number {
  const normalized = Math.max(0, Math.min(255, luminance)) / 255;
  const gammaCorrected = Math.pow(normalized, 1.6);
  let raw = gammaCorrected * MAX_LUX;
  // Scale down so indoor (high raw from camera) lands ~400–500, outdoor 5k–10k
  if (raw < 500) raw = raw;
  else if (raw < 40000) raw *= 0.012;  // ~35k → ~420 (room)
  else raw *= 0.1;                       // 50k→5k, 100k→10k (outdoor)
  return Math.round(Math.max(MIN_LUX, Math.min(MAX_LUX, raw)));
}

export default function LightMeterScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [lux, setLux] = useState<number>(0);
  const [displayLux, setDisplayLux] = useState<number>(0);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLuxUnavailable, setCameraLuxUnavailable] = useState(false);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const sampleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const imageColorsUnavailableRef = useRef(false);
  const animatedLux = useRef(new Animated.Value(0)).current;
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Android: real light sensor (no camera needed when available)
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
        LightSensor.setUpdateInterval(250);
        const sub = LightSensor.addListener((data: { illuminance: number }) => {
          const value = Math.max(MIN_LUX, Math.min(MAX_LUX, Math.round(Number(data.illuminance) || 0)));
          setLux(value);
        });
        subscriptionRef.current = sub;
      } catch {
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

  // iOS (and Android when no sensor): camera-based lux — sample every 500ms
  const sampleLuxFromCamera = useRef(async () => {
    if (!cameraRef.current || sensorAvailable === true || imageColorsUnavailableRef.current) return;
    if (!ImageColorsModule) {
      imageColorsUnavailableRef.current = true;
      if (mountedRef.current) setCameraLuxUnavailable(true);
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.12,
        base64: false,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!mountedRef.current || !photo?.uri) return;
      const colors = await ImageColorsModule.getColors(photo.uri, { cache: false });
      const hex = Platform.OS === 'android'
        ? (colors as { average?: string }).average
        : (colors as { primary?: string }).primary ?? (colors as { background?: string }).background;
      let newLux: number;
      if (hex) {
        const lum = hexToLuminance(hex);
        // Qorong'u / qopqoq kamerada past lux — luminance juda past bo'lsa 0 deb hisobla
        if (lum < 25) {
          newLux = 0;
        } else {
          newLux = luminanceToLux(lum);
        }
      } else {
        newLux = 0;  // rang yo'q (kamera qopqoq) → 0
      }
      setLux((prev) => {
        const diff = Math.abs(newLux - prev);
        // Kamera qimirlamaganda: kichik farq bo'lsa bir xil qiymatni ushlab turish (barqaror)
        const stable = diff < 120;
        let blendPrev: number, blendNew: number;
        if (stable) {
          blendPrev = 0.92;
          blendNew = 0.08;
        } else if (newLux < 80) {
          blendPrev = 0.2;
          blendNew = 0.8;
        } else {
          blendPrev = 0.6;
          blendNew = 0.4;
        }
        const blended = Math.round(prev * blendPrev + newLux * blendNew);
        return Math.max(MIN_LUX, Math.min(MAX_LUX, blended));
      });
    } catch (e: any) {
      // Native module missing in Expo Go — stop retrying
      if (e?.message?.includes('ImageColors') || e?.message?.includes('native module')) {
        imageColorsUnavailableRef.current = true;
        if (mountedRef.current) setCameraLuxUnavailable(true);
      }
    }
    if (mountedRef.current && !imageColorsUnavailableRef.current) {
      sampleTimeoutRef.current = setTimeout(sampleLuxFromCamera.current, CAMERA_SAMPLE_INTERVAL_MS);
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (sampleTimeoutRef.current) {
        clearTimeout(sampleTimeoutRef.current);
        sampleTimeoutRef.current = null;
      }
    };
  }, []);

  // Start camera sampling when camera is ready and we're not using Android sensor
  useEffect(() => {
    if (sensorAvailable === true || !cameraReady || !permission?.granted) return;
    sampleLuxFromCamera.current();
    return () => {
      if (sampleTimeoutRef.current) {
        clearTimeout(sampleTimeoutRef.current);
        sampleTimeoutRef.current = null;
      }
    };
  }, [sensorAvailable, cameraReady, permission?.granted]);

  // Animate lux number and progress bar when lux changes
  useEffect(() => {
    const listenerId = animatedLux.addListener(({ value }) => {
      setDisplayLux(Math.round(value));
    });
    return () => animatedLux.removeListener(listenerId);
  }, []);

  useEffect(() => {
    const progress = Math.min(1, Math.max(0, lux / MAX_LUX));
    Animated.parallel([
      Animated.timing(animatedLux, {
        toValue: lux,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 280,
        useNativeDriver: false,
      }),
    ]).start();
  }, [lux]);

  const levelInfo = getLevelForLux(lux);
  const progress = Math.min(1, Math.max(0, lux / MAX_LUX));
  const progressAnimatedStyle = {
    width: animatedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  };
  const IconComponent =
    levelInfo.icon === 'sun' ? Sun
    : levelInfo.icon === 'moon' ? Moon
    : levelInfo.icon === 'lightbulb' ? Lightbulb
    : CloudSun;

  const showCamera = permission?.granted && (sensorAvailable === false || sensorAvailable === null);
  const stillInitializing = initializing || (showCamera && !cameraReady);

  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.initText, { color: theme.textSecondary, marginTop: 16 }]}>Checking camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background, paddingHorizontal: SPACING.xl }]}>
        <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={theme.text} weight="bold" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Light Meter</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[styles.permissionText, { color: theme.text }]}>Camera access is needed to measure light.</Text>
          <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: COLORS.primary }]} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCamera ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => {
            setCameraReady(true);
            setInitializing(false);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />
      )}

      {stillInitializing && (sensorAvailable === false || sensorAvailable === null) && (
        <View style={[StyleSheet.absoluteFill, styles.initializingOverlay]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.initializingText}>Preparing camera...</Text>
        </View>
      )}

      <View style={[styles.headerOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <CaretLeft size={24} color="#fff" weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Light Meter</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + SPACING.lg }]} pointerEvents="box-none">
        <BlurView intensity={isDark ? 70 : 50} tint={isDark ? 'dark' : 'light'} style={styles.glassCard}>
          <View style={[styles.glassInner, { backgroundColor: (isDark ? '#000' : '#fff') + '18' }]}>
            <View style={[styles.iconWrap, { backgroundColor: levelInfo.color + '35' }]}>
              <IconComponent size={40} color={levelInfo.color} weight="duotone" />
            </View>
            <View style={styles.luxRow}>
              <Text style={[styles.luxValue, { color: levelInfo.color }]}>{displayLux}</Text>
              <Text style={[styles.luxUnit, { color: levelInfo.color + 'DD' }]}>lux</Text>
            </View>
            <Text style={[styles.levelName, { color: theme.text }]}>{levelInfo.level}</Text>
            <Text style={[styles.levelDesc, { color: theme.textSecondary }]}>{levelInfo.description}</Text>
            <View style={[styles.progressTrack, { backgroundColor: (isDark ? '#fff' : '#000') + '22' }]}>
              <Animated.View
                style={[styles.progressFill, progressAnimatedStyle, { backgroundColor: levelInfo.color }]}
              />
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: theme.textTertiary }]}>0</Text>
              <Text style={[styles.rangeLabel, { color: theme.textTertiary }]}>100k</Text>
            </View>
            {sensorAvailable === false && showCamera && (
              <Text style={[styles.hint, { color: theme.textTertiary }]}>
                {cameraLuxUnavailable
                  ? 'Camera meter needs dev build: npx expo run:ios'
                  : 'Estimated lux • Best for comparing rooms, not pro measurement'}
              </Text>
            )}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700' },
  backBtn: { padding: SPACING.sm },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: '#fff' },
  placeholder: { width: 40 },
  initializingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initializingText: {
    marginTop: 16,
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.9)',
  },
  initText: { fontSize: FONT_SIZES.md },
  permissionText: { fontSize: FONT_SIZES.lg, textAlign: 'center', marginBottom: 24 },
  permissionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.round },
  permissionBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  glassInner: {
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  luxRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  luxValue: { fontSize: 56, fontWeight: '800' },
  luxUnit: { fontSize: 20, fontWeight: '600' },
  levelName: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  levelDesc: { fontSize: 13, marginTop: 4 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  rangeLabel: { fontSize: 11 },
  hint: { fontSize: 11, marginTop: 12 },
});
