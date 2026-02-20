import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Plant as PlantIcon,
  Lightning,
  LightningSlash,
  CameraRotate,
  WarningCircle,
  Info,
} from 'phosphor-react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { Camera, CameraView, CameraType, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import { RootStackParamList, type ScannerMode, type Plant } from '../../types';
import { DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../i18n';
import { identifyPlant } from '../../services/api';
import { createSnap } from '../../services/supabase';
import { triggerHaptic } from '../../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Scanner'>;

const { width, height } = Dimensions.get('window');

const analyzingStepKeys = [
  { title: 'scanner.step1.title', subtitle: 'scanner.step1.subtitle' },
  { title: 'scanner.step2.title', subtitle: 'scanner.step2.subtitle' },
  { title: 'scanner.step3.title', subtitle: 'scanner.step3.subtitle' },
  { title: 'scanner.step4.title', subtitle: 'scanner.step4.subtitle' },
] as const;

export default function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userCollection, vibration, isPro, remainingScans, decrementRemainingScans, darkMode } = useAppStore();
  const theme = DARK_COLORS; // Scanner faqat dark mode

  const cameraRef = useRef<CameraView>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [enableTorch, setEnableTorch] = useState(false);
  const [mode, setMode] = useState<ScannerMode>(route.params?.initialMode || 'identify');
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [scanError, setScanError] = useState(false);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [cameraAreaHeight, setCameraAreaHeight] = useState(height);
  // Multi/Diagnose: collect up to 3 photos before analyzing
  const [multiCaptureQueue, setMultiCaptureQueue] = useState<Array<{ base64: string; uri: string }>>([]);

  // Mode pill indicator: position absolute, left/width Reanimated bilan smooth transition
  const modeLayouts = useRef<Record<ScannerMode, { x: number; width: number }>>({
    identify: { x: 0, width: 80 },
    diagnose: { x: 0, width: 90 },
    multiple: { x: 0, width: 85 },
  });
  const pillLeft = useSharedValue(0);
  const pillWidth = useSharedValue(80);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    left: pillLeft.value,
    width: pillWidth.value,
  }));

  const saveModeLayout = (m: ScannerMode, layout: { x: number; width: number }) => {
    modeLayouts.current[m] = { x: layout.x, width: layout.width };
    if (mode === m) {
      pillLeft.value = layout.x;
      pillWidth.value = layout.width;
    }
  };

  const animateModePill = (m: ScannerMode) => {
    const { x, width } = modeLayouts.current[m];
    const config = { duration: 280, easing: Easing.out(Easing.cubic) };
    pillLeft.value = withTiming(x, config);
    pillWidth.value = withTiming(width, config);
  };

  const isMultiPhotoMode = mode === 'multiple' || mode === 'diagnose';

  // Status bar: Scanner’da doim light; chiqganda app darkMode ga qarab qaytariladi
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => {
        setStatusBarStyle(darkMode ? 'light' : 'dark');
      };
    }, [darkMode])
  );

  // When switching to identify, clear multi queue
  useEffect(() => {
    if (mode === 'identify') setMultiCaptureQueue([]);
  }, [mode]);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Flash va rotate tugmalarini header o‘ngiga qo‘yish — header ostida bosilmay qolmasin
  useEffect(() => {
    if (hasPermission !== true) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              {enableTorch ? (
                <Lightning size={22} color={theme.textLight} />
              ) : (
                <LightningSlash size={22} color={theme.textLight} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCameraType}>
              <CameraRotate size={22} color={theme.textLight} />
            </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, hasPermission, enableTorch, theme.textLight]);

  // Load most recent photo from gallery for the gallery button thumbnail
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const available = await MediaLibrary.isAvailableAsync();
        if (!available) return;
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: req } = await MediaLibrary.requestPermissionsAsync();
          if (req !== 'granted' || cancelled) return;
        }
        const { assets } = await MediaLibrary.getAssetsAsync({
          first: 1,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [['creationTime', false]],
        });
        if (cancelled || !assets?.length) return;
        const info = await MediaLibrary.getAssetInfoAsync(assets[0]);
        const uri = (info as any).localUri ?? (info as any).uri ?? assets[0].uri;
        if (uri && !cancelled) setLastPhotoUri(uri);
      } catch (_e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Rotating analyzing steps
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setAnalyzingStep(0);
      interval = setInterval(() => {
        setAnalyzingStep((prev) => (prev + 1) % analyzingStepKeys.length);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    if (!isPro && remainingScans <= 0) {
      Alert.alert(
        t('scanner.alertNoScans'),
        t('scanner.alertNoScansMessage'),
        [
          { text: t('scanner.alertCancel'), style: 'cancel' },
          { text: t('scanner.getMore'), onPress: () => navigation.navigate('Pro', { fromScanner: true }) },
        ]
      );
      return;
    }
    triggerHaptic(vibration);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (!photo?.base64) return;

      if (isMultiPhotoMode) {
        const nextQueue = [...multiCaptureQueue, { base64: photo.base64, uri: photo.uri }];
        setMultiCaptureQueue(nextQueue);

        if (nextQueue.length === 3) {
          setLoading(true);
          setScanError(false);
          setCapturedImage(photo.uri);
          await processImage(
            nextQueue.map((p) => p.base64),
            photo.uri
          );
          setMultiCaptureQueue([]);
        }
        return;
      }

      setLoading(true);
      setScanError(false);
      setCapturedImage(photo.uri);
      await processImage(photo.base64, photo.uri);
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert(t('scanner.alertError'), t('scanner.alertCaptureFailed'));
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (!isPro && remainingScans <= 0) {
      Alert.alert(
        t('scanner.alertNoScans'),
        t('scanner.alertNoScansMessage'),
        [
          { text: t('scanner.alertCancel'), style: 'cancel' },
          { text: t('scanner.getMore'), onPress: () => navigation.navigate('Pro', { fromScanner: true }) },
        ]
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: isMultiPhotoMode,
        selectionLimit: isMultiPhotoMode ? 3 : 1,
      });

      if (result.canceled) return;

      const assets = result.assets.filter((a) => a.base64);
      if (isMultiPhotoMode) {
        if (assets.length !== 3) {
          Alert.alert(
            t('scanner.alertSelect3'),
            t('scanner.alertSelect3Message'),
            [{ text: t('scanner.alertOk') }]
          );
          return;
        }
        setLoading(true);
        setScanError(false);
        setCapturedImage(assets[2].uri);
        await processImage(assets.map((a) => a.base64!) as string[], assets[2].uri);
      } else {
        if (assets[0]?.base64) {
          setLoading(true);
          setScanError(false);
          setCapturedImage(assets[0].uri);
          await processImage(assets[0].base64, assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert(t('scanner.alertError'), t('scanner.alertPickFailed'));
    }
  };

  const processImage = async (base64OrArray: string | string[], _uri?: string) => {
    try {
      const result = await identifyPlant(
        base64OrArray,
        mode as ScannerMode,
        (errorMessage: string) => {
          // Show "no plant found" error state
          setScanError(true);
          setLoading(false);
        }
      );

      if (!result.success || !result.data) {
        setScanError(true);
        setLoading(false);
        return;
      }

      if (!isPro) await decrementRemainingScans();

      const plantData = result.data;

      let snap: any = null;
      if (userCollection?.id) {
        const { data: inserted, error } = await createSnap({
          name: plantData.name ?? null,
          description: plantData.description ?? null,
          labels: plantData.labels ?? null,
          images: plantData.images ?? [],
          overview: plantData.overview ?? null,
          careplan: plantData.careplan ?? null,
          disease: Array.isArray(plantData.disease) ? plantData.disease : null,
          user: userCollection.id,
        });
        if (error) console.error('Create snap error:', error);
        else snap = inserted;
      }

      navigation.navigate('Plant', {
        isGarden: false,
        snap: snap || {
          id: Date.now().toString(),
          name: plantData.name,
          description: plantData.description,
          images: plantData.images,
          labels: plantData.labels,
          overview: plantData.overview,
          careplan: plantData.careplan,
          disease: plantData.disease,
        },
      });
    } catch (error: any) {
      console.error('Process image error:', error);
      setScanError(true);
    } finally {
      setLoading(false);
      setCapturedImage(null);
    }
  };

  const handleRetake = () => {
    setScanError(false);
    setCapturedImage(null);
    setMultiCaptureQueue([]);
  };

  const toggleCameraType = () => {
    setCameraType((current) => {
      const next = current === 'back' ? 'front' : 'back';
      if (next === 'front') setEnableTorch(false);
      return next;
    });
  };

  const toggleFlash = () => {
    setEnableTorch((on) => !on);
  };

  const handleInfo = () => {
    navigation.navigate('InfoScanner');
  };

  const handleClose = () => {
    navigation.goBack();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.textSecondary} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={64} color={theme.textTertiary} />
        <Text style={styles.permissionTitle}>{t('scanner.cameraRequired')}</Text>
        <Text style={styles.permissionText}>{t('scanner.cameraMessage')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handleClose}>
          <Text style={styles.permissionButtonText}>{t('scanner.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = analyzingStepKeys[analyzingStep];

  // 3:4 kamera: kenglikni to'ldiradi (rasmdagi kabi), balandlik markazda
  const cameraBoxWidth = width;
  const cameraBoxHeight = width * (4 / 3);
  const scanSize = Math.min(cameraBoxWidth, cameraBoxHeight) - 40;
  const scanTop = (cameraBoxHeight - scanSize) / 2;
  const scanLeft = (cameraBoxWidth - scanSize) / 2;
  const cameraBoxMarginTop = (cameraAreaHeight - cameraBoxHeight) / 2;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Remaining scans bar – above camera, only for non‑Pro */}
      {!isPro && (
        <View style={[styles.scansBarContainer, { backgroundColor: theme.backgroundTertiary }]}>
          <Text style={[styles.scansBarText, { color: theme.text }]}>
            {t('scanner.remainingScans')}: {remainingScans}
          </Text>
          <TouchableOpacity
            style={styles.scansBarButton}
            onPress={() => navigation.navigate('Pro', { fromScanner: true })}
            activeOpacity={0.8}
          >
            <Text style={styles.scansBarButtonText}>{t('scanner.getMore')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Camera: 3:4, vertikal to'ldiradi (top bar dan mode selector gacha), borderRadius 24 */}
      <View
        style={styles.cameraWrapper}
        onLayout={(e) => setCameraAreaHeight(e.nativeEvent.layout.height)}
      >
        <View
          style={[
            styles.cameraBox,
            {
              width: cameraBoxWidth,
              height: cameraBoxHeight,
              marginTop: cameraBoxMarginTop,
            },
          ]}
        >
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraType}
            flash={flashMode}
            enableTorch={enableTorch}
          />
          {/* Scan frame: 1:1 kvadrat, markazda */}
          {!scanError && (
            <View
              style={[
                styles.scanFrame,
                {
                  left: scanLeft,
                  top: scanTop,
                  width: scanSize,
                  height: scanSize,
                },
              ]}
            >
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          )}
        </View>
      </View>

      {/* Loading/Processing Overlay with rotating steps */}
      {loading && (
        <View style={styles.loadingOverlay}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.capturedImageBg} />
          )}
          <View style={styles.loadingContent}>
            {capturedImage && (
              <View style={styles.circularPreview}>
                <Image source={{ uri: capturedImage }} style={styles.circularImage} />
              </View>
            )}
            <Text style={styles.loadingTitle}>{t(currentStep.title)}</Text>
            <Text style={styles.loadingSubtitle}>{t(currentStep.subtitle)}</Text>
            <ActivityIndicator size="large" color={theme.textLight} style={{ marginTop: SPACING.xl }} />
          </View>
        </View>
      )}

      {/* Scan Error: "There is no plant" */}
      {scanError && !loading && (
        <View style={styles.errorOverlay}>

          {/* Error bottom sheet */}
          <View style={styles.errorSheet}>
            <Text style={styles.errorTitle}>{t('scanner.noPlant')}</Text>
            <Text style={styles.errorSubtitle}>{t('scanner.noPlantSubtitle')}</Text>

            <View style={styles.errorImageContainer}>
              <PlantIcon size={64} color={theme.primary} weight='fill' />
              <View style={styles.errorBadge}>
                <WarningCircle size={20} color="#FF9800" />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.retakeButton, { marginBottom: insets.bottom + SPACING.md }]}
              onPress={handleRetake}
            >
              <CameraIcon size={20} color={theme.textLight} />
              <Text style={styles.retakeButtonText}>{t('scanner.retake')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Mode Selector: orqa fond pill position absolute, left/width bilan smooth siljiydi (iPhone camera style) */}
      {!scanError && (
        <View style={styles.modeContainer}>
          <View style={styles.modeRow}>
            <Animated.View
              pointerEvents="none"
              style={[styles.modePill, pillAnimatedStyle]}
            />
            <TouchableOpacity
              style={styles.modeButton}
              onLayout={(e) => saveModeLayout('identify', e.nativeEvent.layout)}
              onPress={() => {
                setMode('identify');
                animateModePill('identify');
              }}
            >
              <Text style={[styles.modeButtonText, mode === 'identify' && styles.modeButtonTextActive]}>
                {t('scanner.modeIdentify')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeButton}
              onLayout={(e) => saveModeLayout('diagnose', e.nativeEvent.layout)}
              onPress={() => {
                setMode('diagnose');
                animateModePill('diagnose');
              }}
            >
              <Text style={[styles.modeButtonText, mode === 'diagnose' && styles.modeButtonTextActive]}>
                {t('scanner.modeDiagnose')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeButton}
              onLayout={(e) => saveModeLayout('multiple', e.nativeEvent.layout)}
              onPress={() => {
                setMode('multiple');
                animateModePill('multiple');
              }}
            >
              <Text style={[styles.modeButtonText, mode === 'multiple' && styles.modeButtonTextActive]}>
                {t('scanner.modeMultiple')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Multi/Diagnose: show queue progress (1/3, 2/3) and thumbnails */}
        {!scanError && isMultiPhotoMode && multiCaptureQueue.length > 0 && (
          <View style={[styles.multiQueueBar, { backgroundColor: theme.backgroundTertiary }]}>
            <Text style={[styles.multiQueueText, { color: theme.text }]}>
              {t('scanner.photoCount', { n: multiCaptureQueue.length })}
            </Text>
            <View style={styles.multiQueueThumbnails}>
              {multiCaptureQueue.map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={styles.multiQueueThumb} />
              ))}
            </View>
            <TouchableOpacity
              style={styles.multiQueueReset}
              onPress={() => setMultiCaptureQueue([])}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.multiQueueResetText, { color: theme.primary }]}>{t('scanner.reset')}</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Bottom Controls */}
      {!scanError && (
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
            {lastPhotoUri ? (
              <Image source={{ uri: lastPhotoUri }} style={styles.galleryButtonImage} resizeMode="cover" />
            ) : (
              <ImageIcon size={24} color={theme.textLight} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={loading}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoButton} onPress={handleInfo}>
            <Info size={28} color={theme.textLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  scansBarContainer: {
    width: '92%',
    position: 'absolute',
    zIndex: 100,
    left: '4%',
    top: "15%",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
  },
  scansBarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  scansBarButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
  },
  scansBarButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#18191C',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: DARK_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  permissionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: DARK_COLORS.text,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  permissionText: {
    fontSize: FONT_SIZES.md,
    color: DARK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  permissionButton: {
    backgroundColor: DARK_COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
  },
  permissionButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: DARK_COLORS.textLight,
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  capturedImageBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.15,
  },
  loadingContent: {
    alignItems: 'center',
  },
  circularPreview: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: DARK_COLORS.textLight,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  circularImage: {
    width: '100%',
    height: '100%',
  },
  loadingTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: DARK_COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  loadingSubtitle: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  // Error overlay
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  errorTopControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  errorScanFrame: {
    position: 'absolute',
    top: height * 0.18,
    left: width * 0.08,
    right: width * 0.08,
    height: width * 0.55,
    zIndex: 5,
  },
  errorSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DARK_COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    alignItems: 'center',
    boxShadow: '0px 0px 10px 0px rgba(0, 0, 0, 0.1)',
  },
  errorTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: DARK_COLORS.text,
    marginBottom: SPACING.sm,
  },
  errorSubtitle: {
    fontSize: FONT_SIZES.md,
    color: DARK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  errorImageContainer: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.xl,
    backgroundColor: DARK_COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
    position: 'relative',
  },
  errorBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DARK_COLORS.background,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    gap: SPACING.sm,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retakeButtonText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: DARK_COLORS.textLight,
  },
  // Controls
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  headerControlButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  topRightControls: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  controlButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 22,
    // overflow: 'hidden',
    // backgroundColor: 'rgba(80, 80, 80, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.3,
    // shadowRadius: 6,
    // elevation: 4,
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: 88,
  },
  cameraBox: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',

  },
  scanFrame: {
    position: 'absolute',
    zIndex: 5,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: DARK_COLORS.textLight,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.lg,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.lg,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.lg,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.lg,
  },
  modeContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    height: 44,
    position: 'relative',
  },
  modePill: {
    position: 'absolute',
    height: 36,
    borderRadius: 18,
    backgroundColor: DARK_COLORS.primary,
    top: 4,
  },
  modeButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: 'transparent',
  },
  modeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  modeButtonTextActive: {
    color: DARK_COLORS.textLight,
    fontWeight: '700',
  },
  multiQueueBar: {
    position: 'absolute',
    bottom: "25.5%",
    left: '4%',
    right: '4%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    zIndex: 15,
    gap: SPACING.sm,
  },
  multiQueueText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    minWidth: 52,
  },
  multiQueueThumbnails: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  multiQueueThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
  },
  multiQueueReset: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  multiQueueResetText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    zIndex: 10,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  galleryButtonImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  infoButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
