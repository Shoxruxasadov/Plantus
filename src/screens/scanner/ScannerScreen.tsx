import React, { useState, useRef, useEffect } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Lightning,
  LightningSlash,
  Image as ImageIcon,
  Camera as CameraIcon,
  CameraRotate,
  Leaf,
  WarningCircle,
  Info,
} from 'phosphor-react-native';
import { Camera, CameraView, CameraType, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import { RootStackParamList } from '../../types';
import { ScannerMode, identifyPlant } from '../../services/api';
import { DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { createSnap } from '../../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Scanner'>;

const { width, height } = Dimensions.get('window');

const analyzingSteps = [
  { title: 'Scanning plant', subtitle: 'Looking at leaf shape, color, and texture' },
  { title: 'Identifying species', subtitle: 'Matching your plant with our plant database' },
  { title: 'Analyzing condition', subtitle: 'Checking signs of stress, health, or growth' },
  { title: 'Preparing care tips', subtitle: 'Personalizing care advice just for your plant' },
];

export default function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { userCollection } = useAppStore();
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
        setAnalyzingStep((prev) => (prev + 1) % analyzingSteps.length);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      setScanError(false);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo?.base64) {
        setCapturedImage(photo.uri);
        await processImage(photo.base64, photo.uri);
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture image');
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        setLoading(true);
        setScanError(false);
        setCapturedImage(result.assets[0].uri);
        await processImage(result.assets[0].base64, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const processImage = async (base64: string, uri: string) => {
    try {
      const result = await identifyPlant(
        base64,
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

      const plantData = result.data;

      const { data: snap, error } = await createSnap({
        name: plantData.name,
        description: plantData.description,
        labels: plantData.labels,
        images: plantData.images,
        overview: JSON.stringify(plantData.overview),
        careplan: JSON.stringify(plantData.careplan),
        disease: JSON.stringify(plantData.disease),
        user: userCollection.id,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Create snap error:', error);
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
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Please enable camera access in your device settings to scan plants.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handleClose}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = analyzingSteps[analyzingStep];

  // 3:4 kamera: kenglikni to'ldiradi (rasmdagi kabi), balandlik markazda
  const cameraBoxWidth = width;
  const cameraBoxHeight = width * (4 / 3);
  const scanSize = Math.min(cameraBoxWidth, cameraBoxHeight) - 40;
  const scanTop = (cameraBoxHeight - scanSize) / 2;
  const scanLeft = (cameraBoxWidth - scanSize) / 2;
  const cameraBoxMarginTop = (cameraAreaHeight - cameraBoxHeight) / 2;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Camera: 3:4, vertikal to‘ldiradi (top bar dan mode selector gacha), borderRadius 24 */}
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
            <Text style={styles.loadingTitle}>{currentStep.title}</Text>
            <Text style={styles.loadingSubtitle}>{currentStep.subtitle}</Text>
            <ActivityIndicator size="large" color={theme.textLight} style={{ marginTop: SPACING.xl }} />
          </View>
        </View>
      )}

      {/* Scan Error: "There is no plant" */}
      {scanError && !loading && (
        <View style={styles.errorOverlay}>
          {/* Top controls still visible */}
          <View style={[styles.errorTopControls, { paddingTop: insets.top + SPACING.sm }]}>
            <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
              <X size={26} color={theme.textLight} />
            </TouchableOpacity>
            <View style={styles.topRightControls}>
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
          </View>

          {/* Scan frame dimmed */}
          <View style={styles.errorScanFrame}>
            <View style={[styles.corner, styles.topLeft, { borderColor: 'rgba(255,255,255,0.3)' }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: 'rgba(255,255,255,0.3)' }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: 'rgba(255,255,255,0.3)' }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: 'rgba(255,255,255,0.3)' }]} />
          </View>

          {/* Error bottom sheet */}
          <View style={styles.errorSheet}>
            <Text style={styles.errorTitle}>There is no plant</Text>
            <Text style={styles.errorSubtitle}>
              Unable to identify plant! Please try retaking your photo
            </Text>

            <View style={styles.errorImageContainer}>
              <Leaf size={64} color={theme.primary} />
              <View style={styles.errorBadge}>
                <WarningCircle size={20} color="#FF9800" />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.retakeButton, { marginBottom: insets.bottom + SPACING.md }]}
              onPress={handleRetake}
            >
              <CameraIcon size={20} color={theme.textLight} />
              <Text style={styles.retakeButtonText}>Retake Photo</Text>
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
                Identify
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
                Diagnose
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
                Multiple
              </Text>
            </TouchableOpacity>
          </View>
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
