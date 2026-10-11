import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Play, Pause, Volume2, Mic } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { GlassCard } from '@/components/GlassCard';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { BACKEND_URL } from '@/lib/config';

type VoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface VoiceOption {
  id: VoiceId;
  name: string;
  description: string;
}

const voiceOptions: VoiceOption[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral & balanced' },
  { id: 'echo', name: 'Echo', description: 'Warm & resonant' },
  { id: 'fable', name: 'Fable', description: 'Expressive & British' },
  { id: 'onyx', name: 'Onyx', description: 'Deep & authoritative' },
  { id: 'nova', name: 'Nova', description: 'Bright & feminine' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft & gentle' },
];

const baseUrl = BACKEND_URL;

export default function VoiceScreen() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('alloy');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const generateVoice = async () => {
    if (!text.trim() || isLoading) return;

    
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    // Stop any playing audio
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }

    try {
      const response = await fetch(`${baseUrl}/api/ai/voice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice: selectedVoice }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate voice');
      }

      const data = await response.json();
      setAudioUrl(data.data.url);
      
    } catch (err) {
      setError('Failed to generate voice. Please try again.');
      
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = async () => {
    if (!audioUrl) return;

    

    try {
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      setError('Failed to play audio.');
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
          <GlassCard style={styles.inputCard}>
            <Text style={styles.label}>Enter your text</Text>
            <TextInput
              style={styles.input}
              placeholder="Type the text you want to convert to speech..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4096}
              numberOfLines={6}
            />
            <Text style={styles.charCount}>{text.length}/4096</Text>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.sectionTitle}>Select Voice</Text>
          <View style={styles.voiceGrid}>
            {voiceOptions.map((voice, index) => (
              <Animated.View
                key={voice.id}
                entering={FadeInDown.delay(250 + index * 50)}
                style={styles.voiceItemWrapper}
              >
                <Pressable
                  style={[
                    styles.voiceItem,
                    selectedVoice === voice.id && styles.voiceItemActive,
                  ]}
                  onPress={() => {
                    
                    setSelectedVoice(voice.id);
                  }}
                >
                  <View style={styles.voiceIconContainer}>
                    <Mic
                      size={18}
                      color={selectedVoice === voice.id ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.voiceName,
                      selectedVoice === voice.id && styles.voiceNameActive,
                    ]}
                  >
                    {voice.name}
                  </Text>
                  <Text style={styles.voiceDescription}>{voice.description}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500)}>
          <Pressable
            style={[styles.generateButton, (!text.trim() || isLoading) && styles.generateButtonDisabled]}
            onPress={generateVoice}
            disabled={!text.trim() || isLoading}
          >
            {isLoading ? (
              <LoadingIndicator size={24} color={colors.background} />
            ) : (
              <>
                <Volume2 size={20} color={colors.background} />
                <Text style={styles.generateButtonText}>Generate Voice</Text>
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

        {audioUrl ? (
          <Animated.View entering={FadeIn}>
            <GlassCard style={styles.playerCard}>
              <View style={styles.playerContent}>
                <Pressable style={styles.playButton} onPress={togglePlayback}>
                  {isPlaying ? (
                    <Pause size={28} color={colors.background} />
                  ) : (
                    <Play size={28} color={colors.background} fill={colors.background} />
                  )}
                </Pressable>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerTitle}>Audio Ready</Text>
                  <Text style={styles.playerSubtitle}>
                    Voice: {voiceOptions.find((v) => v.id === selectedVoice)?.name}
                  </Text>
                </View>
              </View>
              <View style={styles.waveformContainer}>
                {[...Array(20)].map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height: 8 + Math.random() * 24,
                        opacity: isPlaying ? 0.8 : 0.3,
                        backgroundColor: isPlaying ? colors.primary : colors.textMuted,
                      },
                    ]}
                  />
                ))}
              </View>
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
  inputCard: {
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
    minHeight: 140,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  voiceItemWrapper: {
    width: '50%',
    padding: 6,
  },
  voiceItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  voiceItemActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  voiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  voiceName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  voiceNameActive: {
    color: colors.primary,
  },
  voiceDescription: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
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
  playerCard: {
    overflow: 'hidden',
  },
  playerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  playerInfo: {
    flex: 1,
  },
  playerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  playerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 4,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
});
