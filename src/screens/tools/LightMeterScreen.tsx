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
import { useTranslation } from '../../i18n';

const MIN_LUX = 0;
const MAX_LUX = 100000;
const CAMERA_SAMPLE_INTERVAL_MS = 350;
/** Kadr o'zgarmasa lux o'zgarmasin: shu farqdan kam bo'lsa eski qiymat saqlanadi */
const LUX_STABLE_THRESHOLD = 90;

const LIGHT_LEVEL_KEYS: { min: number; levelKey: string; descKey: string; color: string; icon: string }[] = [
  { min: 0, levelKey: 'lightMeter.veryDark', descKey: 'lightMeter.veryDarkDesc', color: '#1A1A2E', icon: 'moon' },
  { min: 10, levelKey: 'lightMeter.dark', descKey: 'lightMeter.darkDesc', color: '#16213E', icon: 'moon' },
  { min: 50, levelKey: 'lightMeter.dim', descKey: 'lightMeter.dimDesc', color: '#0F4C75', icon: 'cloudsun' },
  { min: 200, levelKey: 'lightMeter.indoor', descKey: 'lightMeter.indoorDesc', color: '#3282B8', icon: 'lightbulb' },
  { min: 1000, levelKey: 'lightMeter.bright', descKey: 'lightMeter.brightDesc', color: '#BBE1FA', icon: 'cloudsun' },
  { min: 10000, levelKey: 'lightMeter.veryBright', descKey: 'lightMeter.veryBrightDesc', color: '#FFD93D', icon: 'sun' },
  { min: 50000, levelKey: 'lightMeter.daylight', descKey: 'lightMeter.daylightDesc', color: '#FF6B6B', icon: 'sun' },
];

function getLevelForLux(lux: number) {
  let out = LIGHT_LEVEL_KEYS[0];
  for (const l of LIGHT_LEVEL_KEYS) {
    if (lux >= l.min) out = l;
  }
  return out;
}

/** Hex → HSL. Returns h [0-360], s [0-100], l [0-100]. */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  let r = parseInt(h.slice(0, 2), 16) / 255;
  let g = parseInt(h.slice(2, 4), 16) / 255;
  let b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let l = (max + min) / 2;
  let s = 0;
  let hVal = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hVal = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hVal = ((b - r) / d + 2) / 6;
    else hVal = ((r - g) / d + 4) / 6;
  }
  return { h: hVal * 360, s: s * 100, l: l * 100 };
}

/**
 * Lightness (HSL L, 0–100) → lux estimate.
 * L=0 → 0; indoor ~300–700 (L ~11–17); outdoor 1000–6000 (L ~20–50); direct sun 25k+ (L high).
 */
function lightnessToLux(L: number): number {
  const clamped = Math.max(0, Math.min(100, L));
  const lux = 2.5 * (clamped * clamped);
  return Math.round(Math.max(MIN_LUX, Math.min(MAX_LUX, lux)));
}

export default function LightMeterScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
        const { l: lightness } = hexToHSL(hex);
        if (lightness <= 0) {
          newLux = 0;
        } else {
          newLux = lightnessToLux(lightness);
        }
      } else {
        newLux = 0;
      }
      setLux((prev) => {
        const diff = Math.abs(newLux - prev);
        if (diff < LUX_STABLE_THRESHOLD) return prev;
        if (diff < 200) {
          const blended = Math.round(prev * 0.92 + newLux * 0.08);
          return Math.max(MIN_LUX, Math.min(MAX_LUX, blended));
        }
        if (diff < 500) {
          const blended = Math.round(prev * 0.75 + newLux * 0.25);
          return Math.max(MIN_LUX, Math.min(MAX_LUX, blended));
        }
        const blended = Math.round(prev * 0.5 + newLux * 0.5);
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
        <Text style={[styles.initText, { color: theme.textSecondary, marginTop: 16 }]}>{t('lightMeter.checkingCamera')}</Text>
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
          <Text style={[styles.title, { color: theme.text }]}>{t('lightMeter.title')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[styles.permissionText, { color: theme.text }]}>{t('lightMeter.cameraNeeded')}</Text>
          <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: COLORS.primary }]} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>{t('lightMeter.allowCamera')}</Text>
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
          <Text style={styles.initializingText}>{t('lightMeter.preparingCamera')}</Text>
        </View>
      )}

      <View style={[styles.headerOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <CaretLeft size={24} color="#fff" weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('lightMeter.title')}</Text>
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
              <Text style={[styles.luxUnit, { color: levelInfo.color + 'DD' }]}>{t('lightMeter.lux')}</Text>
            </View>
            <Text style={[styles.levelName, { color: theme.text }]}>{t(levelInfo.levelKey)}</Text>
            <Text style={[styles.levelDesc, { color: theme.textSecondary }]}>{t(levelInfo.descKey)}</Text>
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
                  ? t('lightMeter.hintDevBuild')
                  : t('lightMeter.hintEstimated')}
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
