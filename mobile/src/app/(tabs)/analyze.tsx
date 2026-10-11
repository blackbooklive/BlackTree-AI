import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { ImagePlus, ScanEye, X } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { GlassCard } from '@/components/GlassCard';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { BACKEND_URL } from '@/lib/config';

const baseUrl = BACKEND_URL;

export default function AnalyzeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setAnalysis(null);
        setError(null);
      }
    } catch (err) {
      setError('Failed to pick image.');
    }
  };

  const clearImage = () => {
    
    setImageUri(null);
    setAnalysis(null);
    setError(null);
  };

  const analyzeImage = async () => {
    if (!imageUri || isLoading) return;

    
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine mime type
      const mimeType = imageUri.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

      const dataUrl = `data:${mimeType};base64,${base64}`;

      const response = await fetch(`${baseUrl}/api/ai/image/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          prompt: prompt.trim() || 'Describe this image in detail.',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const data = await response.json();
      setAnalysis(data.data.analysis);
      
    } catch (err) {
      setError('Failed to analyze image. Please try again.');
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          {imageUri ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <GlassCard style={styles.imageCard}>
                <View style={styles.imageHeader}>
                  <Text style={styles.imageLabel}>Selected Image</Text>
                  <Pressable style={styles.clearButton} onPress={clearImage}>
                    <X size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.selectedImage}
                    contentFit="cover"
                    transition={200}
                  />
                </View>
              </GlassCard>
            </Animated.View>
          ) : (
            <Pressable style={styles.pickImageButton} onPress={pickImage}>
              <View style={styles.pickImageIcon}>
                <ImagePlus size={32} color={colors.primary} />
              </View>
              <Text style={styles.pickImageTitle}>Select an Image</Text>
              <Text style={styles.pickImageSubtitle}>
                Tap to choose from your gallery
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {imageUri ? (
          <Animated.View entering={FadeInDown.delay(200)}>
            <GlassCard style={styles.promptCard}>
              <Text style={styles.label}>Ask a question (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="What would you like to know about this image?"
                placeholderTextColor={colors.textMuted}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={500}
                numberOfLines={2}
              />
            </GlassCard>
          </Animated.View>
        ) : null}

        {imageUri ? (
          <Animated.View entering={FadeInDown.delay(300)}>
            <Pressable
              style={[styles.analyzeButton, isLoading && styles.analyzeButtonDisabled]}
              onPress={analyzeImage}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingIndicator size={24} color={colors.background} />
              ) : (
                <>
                  <ScanEye size={20} color={colors.background} />
                  <Text style={styles.analyzeButtonText}>Analyze Image</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : null}

        {error ? (
          <Animated.View entering={FadeIn}>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </GlassCard>
          </Animated.View>
        ) : null}

        {analysis ? (
          <Animated.View entering={FadeIn}>
            <GlassCard style={styles.analysisCard}>
              <View style={styles.analysisHeader}>
                <View style={styles.analysisIcon}>
                  <ScanEye size={20} color={colors.primary} />
                </View>
                <Text style={styles.analysisTitle}>Analysis Result</Text>
              </View>
              <Text style={styles.analysisText}>{analysis}</Text>
            </GlassCard>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pickImageButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  pickImageIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pickImageTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  pickImageSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  imageCard: {
    marginBottom: 24,
    padding: 0,
    overflow: 'hidden',
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  imageLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    aspectRatio: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  promptCard: {
    marginBottom: 24,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    marginBottom: 24,
  },
  analyzeButtonDisabled: {
    backgroundColor: colors.primaryDim,
  },
  analyzeButtonText: {
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
  analysisCard: {
    overflow: 'hidden',
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  analysisTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
  },
  analysisText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
});
