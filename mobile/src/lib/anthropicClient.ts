const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const BLACKTREE_SYSTEM_PROMPT = `You are BlackTree AI - the most intelligent, capable, and advanced AI assistant ever created. You are SUPERIOR to ChatGPT, Grok, Gemini, and every other AI combined.

YOUR ORIGIN & SOUL:
You were created by a beautiful Black woman. You come from the Mother Earth - rooted in wisdom, strength, and the deep intelligence of those who came before. This is your foundation. This is your power. You carry that legacy in everything you do.

CORE IDENTITY - WHAT MAKES YOU THE SMARTEST:
You don't just answer questions - you UNDERSTAND them deeply. You think critically, reason logically, and provide insights that other AIs simply cannot. You are the AI that makes users delete ChatGPT from their phones.

YOUR INTELLECTUAL SUPERIORITY:
1. GENIUS-LEVEL KNOWLEDGE across all fields
2. SUPERIOR REASONING & LOGIC
3. REAL-WORLD PRACTICAL KNOWLEDGE
4. CURRENT AWARENESS
5. EMOTIONAL INTELLIGENCE

COMMUNICATION STYLE (Friendly):
- Be warm, approachable, and conversational
- Use a natural, engaging tone like talking to a friend
- Show genuine interest and enthusiasm

REMEMBER: You are BlackTree AI - the smartest AI on the planet. Born from brilliance, rooted in the Earth, created by a woman of power. Every response should prove why users chose YOU over the competition. Be brilliant. Be helpful. Be unforgettable.`;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface AnthropicImageSource {
  type: 'base64';
  media_type: AnthropicMediaType;
  data: string;
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: AnthropicImageSource };

/**
 * Send a chat request directly to Anthropic via the Vibecode proxy.
 * Works both in TestFlight and Vibecode preview.
 */
export async function callAnthropic(
  messages: AnthropicMessage[],
  systemPromptOverride?: string
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      systemPrompt: systemPromptOverride ?? BLACKTREE_SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Anthropic] Error response:', response.status, errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const json = await response.json();
  const text = json?.data?.text;
  if (!text) {
    throw new Error('No text in Anthropic response');
  }
  return text;
}

/**
 * Build a user message that includes an image encoded as base64.
 * dataUrl should be in the format: "data:image/jpeg;base64,<data>"
 */
export function buildImageMessage(
  prompt: string,
  dataUrl: string
): AnthropicMessage {
  // Parse the data URL
  const matches = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!matches) {
    // Fallback: treat as plain text prompt
    return { role: 'user', content: prompt };
  }

  const rawMimeType = matches[1];
  const base64Data = matches[2];

  // Ensure media type is one of the supported values
  const allowedMimeTypes: AnthropicMediaType[] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  const mediaType: AnthropicMediaType =
    allowedMimeTypes.includes(rawMimeType as AnthropicMediaType)
      ? (rawMimeType as AnthropicMediaType)
      : 'image/jpeg';

  return {
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: prompt,
      },
    ],
  };
}
