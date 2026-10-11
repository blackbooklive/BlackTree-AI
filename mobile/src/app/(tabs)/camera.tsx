import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedProps, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Camera, X, Sparkles, Send, RotateCcw, Crown, ZoomIn, Lock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts, borderRadius, spacing } from '@/lib/theme';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageStore } from '@/stores/usageStore';
import { callAnthropic, buildImageMessage, AnthropicMessage } from '@/lib/anthropicClient';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
}

export default function CameraScreen() {
  const router = useRouter();
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const canSendMessage = useUsageStore((s) => s.canSendMessage);
  const incrementMessages = useUsageStore((s) => s.incrementMessages);
  const getRemainingMessages = useUsageStore((s) => s.getRemainingMessages);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const remaining = getRemainingMessages(isPro);

  // Pinch to zoom gesture
  const baseZoom = useSharedValue(0);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Scale factor to zoom (0-1 range)
      const newZoom = Math.min(Math.max(baseZoom.value + (e.scale - 1) * 0.5, 0), 1);
      runOnJS(setZoom)(newZoom);
    })
    .onEnd(() => {
      baseZoom.value = zoom;
    });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const openPaywall = () => {
    
    router.push('/paywall');
  };

  const openImageViewer = () => {
    
    setIsImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    
    setIsImageViewerOpen(false);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      
    }
  };

  const retakePhoto = () => {
    
    setCapturedPhoto(null);
    setMessages([]);
    setInput('');
  };

  const analyzePhoto = async (customPrompt?: string) => {
    if (!capturedPhoto) return;

    // Check usage limits
    if (!isSubscriptionLoading && !canSendMessage(isPro)) {
      openPaywall();
      return;
    }

    
    incrementMessages();

    const prompt = customPrompt || 'What is in this image? Please describe what you see in detail.';

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      imageUri: messages.length === 0 ? capturedPhoto : undefined,
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    if (messages.length === 0) {
      setIsAnalyzing(true);
    }
    scrollToBottom();

    try {
      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(capturedPhoto, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imageDataUrl = `data:image/jpeg;base64,${base64}`;
      console.log('[Camera] Image base64 size:', base64.length, 'chars');

      // Build Anthropic messages array, with image in the first user turn
      const anthropicMessages: AnthropicMessage[] = messages.length === 0
        ? [buildImageMessage(prompt, imageDataUrl)]
        : [
            buildImageMessage(messages[0].content, imageDataUrl),
            ...messages.slice(1).map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            { role: 'user' as const, content: prompt },
          ];

      const content = await callAnthropic(anthropicMessages);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id ? { ...m, content } : m
        )
      );
      scrollToBottom();

      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Camera] analyzePhoto error:', errorMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `Sorry, something went wrong: ${errorMsg}` }
            : m
        )
      );
      
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const sendFollowUp = () => {
    if (!input.trim() || isLoading) return;
    analyzePhoto(input.trim());
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <LoadingIndicator size={32} />
        </View>
      </SafeAreaView>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <Animated.View entering={FadeInDown.delay(200)} style={styles.permissionCard}>
            <View style={styles.iconCircle}>
              <Camera size={40} color={colors.text} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access</Text>
            <Text style={styles.permissionDescription}>
              Allow camera access to take photos and get AI-powered explanations of what you capture.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Show photo preview and analysis view
  if (capturedPhoto) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Fullscreen Image Viewer Modal */}
        <Modal
          visible={isImageViewerOpen}
          transparent
          animationType="fade"
          onRequestClose={closeImageViewer}
        >
          <Pressable style={styles.imageViewerContainer} onPress={closeImageViewer}>
            <Image
              source={{ uri: capturedPhoto }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
            <View style={styles.closeButtonContainer}>
              <Pressable style={styles.closeButton} onPress={closeImageViewer}>
                <X size={24} color={colors.text} />
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Header */}
        <View style={styles.previewHeader}>
          <Pressable style={styles.headerButton} onPress={retakePhoto}>
            <RotateCcw size={20} color={colors.text} />
            <Text style={styles.headerButtonText}>Retake</Text>
          </Pressable>
          {isSubscriptionLoading ? null : isPro ? (
            <View style={styles.proBadge}>
              <Crown size={14} color={colors.background} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <Pressable style={styles.usageBadge} onPress={openPaywall}>
              <Text style={styles.usageBadgeText}>{remaining} left</Text>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.flex}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Photo Preview - Tap to view fullscreen */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.photoContainer}>
              <Pressable onPress={openImageViewer}>
                <Image
                  source={{ uri: capturedPhoto }}
                  style={styles.photoPreview}
                  contentFit="cover"
                />
                <View style={styles.tapToViewOverlay}>
                  <ZoomIn size={16} color={colors.text} />
                  <Text style={styles.tapToViewText}>Tap to view</Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Analysis Messages */}
            {messages.length === 0 ? (
              <Animated.View entering={FadeInUp.delay(200)} style={styles.askAiContainer}>
                <Pressable
                  style={[styles.askAiButton, isAnalyzing && styles.askAiButtonDisabled]}
                  onPress={() => analyzePhoto()}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <LoadingIndicator size={24} />
                  ) : (
                    <>
                      <Sparkles size={22} color={colors.background} />
                      <Text style={styles.askAiButtonText}>Ask AI</Text>
                    </>
                  )}
                </Pressable>
                <Text style={styles.askAiHint}>
                  Tap to get an AI explanation of your photo
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.messagesContainer}>
                {messages.map((message, index) => (
                  <Animated.View
                    key={message.id}
                    entering={FadeInUp.delay(index * 50).springify()}
                    style={[
                      styles.messageRow,
                      message.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                    ]}
                  >
                    <View style={styles.messageContent}>
                      {message.role === 'assistant' && message.content === '' ? (
                        <LoadingIndicator size={24} />
                      ) : (
                        <Text
                          style={[
                            styles.messageText,
                            message.role === 'user' ? styles.userText : styles.assistantText,
                          ]}
                        >
                          {message.content}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Follow-up input - only show after initial analysis */}
          {messages.length > 0 ? (
            <View style={styles.inputContainer}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask a follow-up question..."
                  placeholderTextColor={colors.textMuted}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={1000}
                  onSubmitEditing={sendFollowUp}
                  blurOnSubmit={false}
                />
                <Pressable
                  style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
                  onPress={sendFollowUp}
                  disabled={!input.trim() || isLoading}
                >
                  <Send size={20} color={!input.trim() || isLoading ? colors.textMuted : colors.background} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Camera viewfinder
  return (
    <GestureHandlerRootView style={styles.cameraContainer}>
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            zoom={zoom}
          >
            {/* Top overlay with title */}
            <SafeAreaView style={styles.cameraOverlay} edges={['top']}>
              <View style={styles.cameraHeader}>
                <Text style={styles.cameraTitle}>Camera</Text>
                <Text style={styles.cameraSubtitle}>Pinch to zoom • Tap to capture</Text>
              </View>
            </SafeAreaView>

            {/* Zoom indicator */}
            {zoom > 0.01 && (
              <View style={styles.zoomIndicator}>
                <ZoomIn size={14} color={colors.text} />
                <Text style={styles.zoomText}>{(1 + zoom * 9).toFixed(1)}x</Text>
              </View>
            )}

            {/* Bottom overlay with capture button */}
            <View style={styles.cameraControls}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Pressable style={styles.captureButton} onPress={takePhoto}>
                <View style={styles.captureButtonInner} />
              </Pressable>
            </View>
          </CameraView>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  permissionCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 320,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  permissionDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cameraHeader: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  cameraTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.text,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomIndicator: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoomText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.text,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.text,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.text,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
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
  previewScrollContent: {
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  photoContainer: {
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  askAiContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  askAiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: 160,
    justifyContent: 'center',
  },
  askAiButtonDisabled: {
    backgroundColor: colors.surface,
  },
  askAiButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  askAiHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  messagesContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowAssistant: {
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '85%',
    paddingVertical: 4,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFD700',
  },
  assistantText: {
    color: colors.text,
  },
  inputContainer: {
    overflow: 'hidden',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  },
  tapToViewOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
  },
  tapToViewText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
