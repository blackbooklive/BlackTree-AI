import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated2, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Sparkles, Download, Square, RectangleHorizontal, RectangleVertical, Plus, X, Crown, Smartphone, Lock } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { GlassCard } from '@/components/GlassCard';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { pickImage } from '@/lib/file-picker';
import { uploadFile } from '@/lib/upload';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageStore } from '@/stores/usageStore';
import { BACKEND_URL } from '@/lib/config';

type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';
type CreateMode = 'image' | 'appstore';

interface SizeOption {
  value: ImageSize;
  label: string;
  icon: React.ReactNode;
}

const sizeOptions: SizeOption[] = [
  { value: '1024x1024', label: 'Square', icon: <Square size={20} color={colors.text} /> },
  { value: '1792x1024', label: 'Landscape', icon: <RectangleHorizontal size={20} color={colors.text} /> },
  { value: '1024x1792', label: 'Portrait', icon: <RectangleVertical size={20} color={colors.text} /> },
];

const appStoreSizeOptions: SizeOption[] = [
  { value: '1024x1792', label: 'iPhone', icon: <Smartphone size={20} color={colors.text} /> },
];

const baseUrl = BACKEND_URL;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CreateScreen() {
  const router = useRouter();
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const canGenerateImage = useUsageStore((s) => s.canGenerateImage);
  const incrementImages = useUsageStore((s) => s.incrementImages);
  const getRemainingImages = useUsageStore((s) => s.getRemainingImages);

  const [mode, setMode] = useState<CreateMode>('image');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{ uri: string; url?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const remainingImages = getRemainingImages(isPro);

  const openPaywall = () => {
    
    router.push('/paywall');
  };

  // Zoom state for image viewer
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
        savedScale.value = 5;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const generateImage = async () => {
    if (!prompt.trim() || isLoading) return;

    // Check usage limits - only block if subscription is loaded and user is not pro
    if (!isSubscriptionLoading && !isPro && !canGenerateImage(false)) {
      openPaywall();
      return;
    }

    
    incrementImages();
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    // Build the prompt based on mode
    let finalPrompt = prompt.trim();
    let finalSize = size;

    if (mode === 'appstore') {
      finalSize = '1024x1792';
      finalPrompt = `Create a high-quality Apple App Store screenshot for an iPhone app. Show a realistic iPhone 15 Pro with thin bezels displaying the app screen. The app shows: ${prompt.trim()}.

Requirements:
- Modern iPhone 15 Pro device with Dynamic Island at top
- App UI should look like a real polished iOS app with clean typography
- Beautiful gradient or solid color background (dark blue, purple, or black works well)
- The phone should be slightly angled or straight-on, taking up about 70% of the image height
- Professional, marketing-ready quality like Apple's own App Store screenshots
- No text overlays or captions - just the phone and background`;
    }

    try {
      // Build request body, including reference image URL if user uploaded one
      const requestBody: { prompt: string; size: string; referenceImageUrl?: string } = {
        prompt: finalPrompt,
        size: finalSize,
      };

      // If user uploaded a reference image, include its URL so the AI can match their appearance
      if (uploadedImage?.url) {
        requestBody.referenceImageUrl = uploadedImage.url;
      }

      const response = await fetch(`${baseUrl}/api/ai/image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(data.data.url);
      
    } catch (err) {
      setError('Failed to generate image. Please try again.');
      
    } finally {
      setIsLoading(false);
    }
  };

  const saveToGallery = async () => {
    if (!generatedImage) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to save images.');
        return;
      }

      

      const filename = `ai-image-${Date.now()}.png`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.downloadAsync(generatedImage, fileUri);
      await MediaLibrary.saveToLibraryAsync(fileUri);

      
      Alert.alert('Saved!', 'Image saved to your gallery.');
    } catch (err) {
      
      Alert.alert('Error', 'Failed to save image.');
    }
  };

  const getAspectRatio = () => {
    switch (size) {
      case '1792x1024':
        return 1792 / 1024;
      case '1024x1792':
        return 1024 / 1792;
      default:
        return 1;
    }
  };

  const handlePickImage = async () => {
    const file = await pickImage();
    if (!file) return;

    
    setUploadedImage({ uri: file.uri });
    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadFile(file.uri, file.filename, file.mimeType);
      setUploadedImage({ uri: file.uri, url: result.url });
      
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      setUploadedImage(null);
      
    } finally {
      setIsUploading(false);
    }
  };

  const removeUploadedImage = () => {
    
    setUploadedImage(null);
  };

  const openImageViewer = (imageUri: string) => {
    
    setViewerImage(imageUri);
  };

  const closeImageViewer = () => {
    setViewerImage(null);
    resetZoom();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Pro badge or remaining count */}
      <View style={styles.header}>
        {isPro ? (
          <View style={styles.proBadge}>
            <Crown size={14} color={colors.background} />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        ) : (
          <Pressable style={styles.usageBadge} onPress={openPaywall}>
            <Text style={styles.usageBadgeText}>{remainingImages} images left today</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
      >

        <Animated.View entering={FadeInDown.delay(100)}>
          <GlassCard style={styles.inputCard}>
            <Text style={styles.label}>
              {mode === 'appstore' ? 'Describe your app screenshot' : 'Describe your image'}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={
                  mode === 'appstore'
                    ? "A fitness tracking app showing workout progress with charts..."
                    : "A futuristic city at sunset with flying cars..."
                }
                placeholderTextColor={colors.textMuted}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={1000}
                numberOfLines={4}
              />
              <View style={styles.inputActions}>
                {uploadedImage ? (
                  <View style={styles.thumbnailContainer}>
                    <Image
                      source={{ uri: uploadedImage.uri }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                    />
                    {isUploading ? (
                      <View style={styles.thumbnailOverlay}>
                        <LoadingIndicator size={16} color={colors.text} />
                      </View>
                    ) : null}
                    <Pressable style={styles.thumbnailRemove} onPress={removeUploadedImage}>
                      <X size={12} color={colors.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.addImageButton} onPress={handlePickImage}>
                    <Plus size={20} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {mode === 'image' ? (
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={styles.sectionTitle}>Size</Text>
            <View style={styles.sizeContainer}>
              {sizeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.sizeOption,
                    size === option.value && styles.sizeOptionActive,
                  ]}
                  onPress={() => {
                    
                    setSize(option.value);
                  }}
                >
                  {option.icon}
                  <Text
                    style={[
                      styles.sizeLabel,
                      size === option.value && styles.sizeLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(300)}>
          <Pressable
            style={[styles.generateButton, (!prompt.trim() || isLoading) && styles.generateButtonDisabled]}
            onPress={generateImage}
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? (
              <LoadingIndicator size={24} color={colors.background} />
            ) : (
              <>
                <Sparkles size={20} color={colors.background} />
                <Text style={styles.generateButtonText}>
                  {mode === 'appstore' ? 'Generate Screenshot' : 'Generate Image'}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {error ? (
          <Animated.View entering={FadeIn}>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </GlassCard>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <Animated.View entering={FadeInUp.springify()}>
            <GlassCard style={styles.loadingCard}>
              <LoadingIndicator size={48} color={colors.accent} />
              <Text style={styles.loadingTitle}>Creating your image...</Text>
              <Text style={styles.loadingSubtitle}>This may take a moment</Text>
            </GlassCard>
          </Animated.View>
        ) : null}

        {generatedImage ? (
          <Animated.View entering={FadeInUp.springify()}>
            <GlassCard style={styles.imageCard}>
              <Pressable
                style={[styles.imageContainer, { aspectRatio: getAspectRatio() }]}
                onPress={() => openImageViewer(generatedImage)}
              >
                <Image
                  source={{ uri: generatedImage }}
                  style={styles.generatedImage}
                  contentFit="cover"
                  transition={300}
                />
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveToGallery}>
                <Download size={18} color={colors.text} />
                <Text style={styles.saveButtonText}>Save to Gallery</Text>
              </Pressable>
            </GlassCard>
          </Animated.View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen Image Viewer Modal with Zoom */}
      <Modal
        visible={viewerImage !== null}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <GestureHandlerRootView style={styles.modalContainer}>
          <Pressable style={styles.modalBackground} onPress={closeImageViewer} />
          <GestureDetector gesture={composedGesture}>
            <Animated2.View style={[styles.modalContent, animatedImageStyle]}>
              {viewerImage ? (
                <Image
                  source={{ uri: viewerImage }}
                  style={styles.modalImage}
                  contentFit="contain"
                  transition={200}
                />
              ) : null}
            </Animated2.View>
          </GestureDetector>
          <Pressable style={styles.closeButton} onPress={closeImageViewer}>
            <X size={24} color={colors.text} />
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockedCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 320,
  },
  lockedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  lockedDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  proBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.background,
  },
  usageBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  inputCard: {
    marginBottom: 24,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  loadingTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
  },
  loadingSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputActions: {
    marginLeft: 12,
    alignItems: 'center',
  },
  addImageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sizeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  sizeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeOptionActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  sizeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  sizeLabelActive: {
    color: colors.primary,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    marginBottom: 24,
  },
  generateButtonDisabled: {
    backgroundColor: colors.surface,
  },
  generateButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  errorCard: {
    marginBottom: 24,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  imageCard: {
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 16,
  },
  generatedImage: {
    width: '100%',
    height: '100%',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceBright,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  uploadedImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  uploadedBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.background,
  },
  uploadButton: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH - 32,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeToggleActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  modeToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  modeToggleTextActive: {
    color: colors.primary,
  },
  treeHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  treeImage: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  treeTitle: {
    fontFamily: fonts.header,
    fontSize: 28,
    color: colors.text,
    letterSpacing: 1,
  },
  treeSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
