import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { stream } from "hono/streaming";
import { env } from "../env";
import { prisma } from "../prisma";
import { auth } from "../auth";

const aiRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Zod schemas for request validation
const contentBlockSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), source: z.object({ type: z.literal("base64"), media_type: z.string(), data: z.string() }) }),
]);

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.union([z.string(), z.array(contentBlockSchema)]),
      imageBase64: z.string().optional(), // Base64 encoded image data (with data URL prefix)
    })
  ),
  stream: z.boolean().optional().default(false),
  timezone: z.string().optional(),
  location: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  personality: z.enum(["professional", "friendly", "casual", "concise"]).optional().default("friendly"),
  mode: z.enum(["chat", "explore"]).optional().default("chat"),
  systemPrompt: z.string().optional(),
});

// Simple AnthropicMessage type for the proxy route
export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

// Weather code to description mapping
function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code >= 1 && code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code === 95 || code === 96 || code === 99) return "Thunderstorm";
  return "Unknown";
}

// Fetch current weather from Open-Meteo API
async function fetchWeather(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Weather API error:", response.status);
      return null;
    }

    const data = await response.json() as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
      };
    };

    if (!data.current) {
      return null;
    }

    const { temperature_2m, weather_code, relative_humidity_2m, wind_speed_10m } = data.current;

    const parts: string[] = [];

    if (temperature_2m !== undefined) {
      parts.push(`Temperature: ${Math.round(temperature_2m)}°F`);
    }

    if (weather_code !== undefined) {
      parts.push(`Conditions: ${getWeatherDescription(weather_code)}`);
    }

    if (relative_humidity_2m !== undefined) {
      parts.push(`Humidity: ${relative_humidity_2m}%`);
    }

    if (wind_speed_10m !== undefined) {
      // Open-Meteo returns wind speed in km/h, convert to mph
      const windMph = wind_speed_10m * 0.621371;
      parts.push(`Wind: ${Math.round(windMph)} mph`);
    }

    return parts.length > 0 ? parts.join(", ") : null;
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
}

/**
 * Web search using Tavily API
 * Returns search results for current events, news, social media, etc.
 */
async function searchWeb(query: string): Promise<string | null> {
  if (!env.TAVILY_API_KEY) {
    console.log("[Web Search] TAVILY_API_KEY not configured, skipping search");
    return null;
  }

  try {
    console.log("[Web Search] Searching for:", query);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Web Search] Tavily API error:", response.status, errorText);
      return null;
    }

    const data = await response.json() as {
      answer?: string;
      results?: Array<{
        title: string;
        url: string;
        content: string;
        published_date?: string;
      }>;
    };

    console.log("[Web Search] Got", data.results?.length || 0, "results");

    // Format search results for the AI
    let searchContext = "";

    if (data.answer) {
      searchContext += `Summary: ${data.answer}\n\n`;
    }

    if (data.results && data.results.length > 0) {
      searchContext += "Sources:\n";
      for (const result of data.results) {
        searchContext += `- ${result.title}\n`;
        searchContext += `  ${result.content.substring(0, 300)}...\n`;
        if (result.published_date) {
          searchContext += `  Published: ${result.published_date}\n`;
        }
        searchContext += `  URL: ${result.url}\n\n`;
      }
    }

    return searchContext || null;
  } catch (error) {
    console.error("[Web Search] Error:", error);
    return null;
  }
}

/**
 * Determine if the user's message requires a web search
 */
function shouldSearchWeb(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Only trigger web search for EXPLICIT search requests or very specific real-time queries
  const searchTriggers = [
    // Explicit search requests
    "search for", "look up", "google", "find out about",
    // News (must be explicit)
    "latest news", "breaking news", "news about", "what's happening with",
    // Sports scores (specific)
    "score of", "who won the", "game score", "final score",
    // Stocks (specific)
    "stock price", "how much is", "bitcoin price", "crypto price",
    // Current events (specific)
    "what happened to", "what's going on with", "update on",
    // Social media trends
    "trending", "viral", "what's popular", "what's hot",
    "twitter trend", "tiktok trend", "instagram trend", "social media trend",
    "trending on twitter", "trending on tiktok", "trending on instagram",
    "trending on x", "trending now", "going viral", "what's viral",
    "top trends", "current trends", "latest trends",
  ];

  return searchTriggers.some(trigger => lowerMessage.includes(trigger));
}

/**
 * Extract a search query from the user's message
 */
function extractSearchQuery(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Special handling for trend queries - make them more specific
  if (lowerMessage.includes("trending") || lowerMessage.includes("viral") || lowerMessage.includes("trend")) {
    // Extract the platform if mentioned
    if (lowerMessage.includes("twitter") || lowerMessage.includes(" x ") || lowerMessage.includes("on x")) {
      return "Twitter X trending topics today " + new Date().toLocaleDateString();
    }
    if (lowerMessage.includes("tiktok")) {
      return "TikTok trending videos challenges today " + new Date().toLocaleDateString();
    }
    if (lowerMessage.includes("instagram")) {
      return "Instagram trending reels hashtags today " + new Date().toLocaleDateString();
    }
    if (lowerMessage.includes("youtube")) {
      return "YouTube trending videos today " + new Date().toLocaleDateString();
    }
    // Generic social media trends
    return "social media trending topics viral today " + new Date().toLocaleDateString();
  }

  // Clean up the message to make a good search query
  let query = message
    .replace(/can you/gi, "")
    .replace(/please/gi, "")
    .replace(/tell me/gi, "")
    .replace(/what('s| is)/gi, "")
    .replace(/who('s| is)/gi, "")
    .replace(/find out/gi, "")
    .replace(/look up/gi, "")
    .replace(/search for/gi, "")
    .replace(/google/gi, "")
    .trim();

  // Add "latest" to help get recent results if not already present
  if (!query.toLowerCase().includes("latest") &&
      !query.toLowerCase().includes("recent") &&
      !query.toLowerCase().includes("today") &&
      !query.toLowerCase().includes("2024") &&
      !query.toLowerCase().includes("2025") &&
      !query.toLowerCase().includes("2026")) {
    query = "latest " + query;
  }

  return query;
}

const imageGenerateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
  referenceImageUrl: z.string().optional(),
});

const imageAnalyzeSchema = z.object({
  image: z.string().min(1, "Image data is required"),
  prompt: z.string().optional().default("Describe this image in detail."),
});

const voiceGenerateSchema = z.object({
  text: z.string().min(1, "Text is required"),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .optional()
    .default("alloy"),
});

// Press release email generation schema
const pressReleaseSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  newsType: z.enum(["launch", "funding", "partnership", "milestone", "event", "other"]),
  headline: z.string().min(1, "Headline is required"),
  details: z.string().min(1, "Details are required"),
  targetOutlet: z.string().min(1, "Target outlet is required"),
  contactInfo: z.object({
    name: z.string().min(1, "Contact name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
  }),
});

/**
 * POST /api/ai/chat - Chat with AI using Claude (supports streaming)
 *
 * Simple proxy mode: when `systemPrompt` is provided (with no stream/personality/mode overrides),
 * calls Anthropic directly and returns { data: { text: string } }.
 */
aiRouter.post("/chat", zValidator("json", chatRequestSchema), async (c) => {
  const { messages, stream: shouldStream, timezone, location, coordinates, personality, mode, systemPrompt } = c.req.valid("json");

  try {
    // Check if Anthropic API key is configured
    if (!env.ANTHROPIC_API_KEY) {
      return c.json({ error: { message: "ANTHROPIC_API_KEY is not configured", code: "CHAT_ERROR" } }, 500);
    }

    // ----------------------------------------------------------------
    // Simple proxy mode: { messages, systemPrompt? } → { data: { text } }
    // Triggered when the caller passes `systemPrompt` explicitly (even
    // as an empty string) which signals the lightweight proxy contract.
    // ----------------------------------------------------------------
    if (systemPrompt !== undefined) {
      // Filter to only user/assistant roles for the Anthropic API
      const anthropicMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const proxyBody: Record<string, unknown> = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: anthropicMessages,
      };

      if (systemPrompt) {
        proxyBody.system = systemPrompt;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const proxyResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proxyBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json().catch(() => ({}));
        console.error("[AI Proxy] Anthropic API error:", proxyResponse.status, errorData);
        const errorMessage =
          (errorData as { error?: { message?: string } })?.error?.message ||
          `Anthropic API error: ${proxyResponse.status}`;
        return c.json({ error: { message: errorMessage, code: "CHAT_ERROR" } }, 500);
      }

      const proxyResult = (await proxyResponse.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };

      const text = proxyResult.content?.find((block) => block.type === "text")?.text ?? "";

      return c.json({ data: { text } });
    }

    // Get current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'UTC'
    });

    // Build context info
    let contextInfo = `Current date and time: ${dateStr}, ${timeStr}`;
    if (timezone) {
      contextInfo += ` (${timezone})`;
    }
    contextInfo += `\nCurrent US President: Donald Trump (47th President, inaugurated January 2025)`;
    if (location) {
      contextInfo += `\nUser's location: ${location}`;
    }

    // Fetch weather if coordinates are provided
    if (coordinates) {
      const weatherInfo = await fetchWeather(coordinates.latitude, coordinates.longitude);
      if (weatherInfo) {
        contextInfo += `\nCurrent weather: ${weatherInfo}`;
      }
    }

    // Perform web search if the user's message requires real-time information
    let webSearchResults = "";
    const lastUserMessageContent = messages.filter(m => m.role === "user").pop()?.content || "";
    const lastUserMessage = typeof lastUserMessageContent === "string" ? lastUserMessageContent : lastUserMessageContent.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join(" ");
    if (lastUserMessage && shouldSearchWeb(lastUserMessage)) {
      const searchQuery = extractSearchQuery(lastUserMessage);
      const searchResults = await searchWeb(searchQuery);
      if (searchResults) {
        webSearchResults = `\n\nWEB SEARCH RESULTS (use this information to answer the user's question):\n${searchResults}`;
      }
    }

    // Personality-specific communication styles
    const personalityStyles: Record<string, string> = {
      professional: `COMMUNICATION STYLE (Professional):
- Use formal, business-appropriate language
- Be precise and thorough in your explanations
- Maintain a polished, executive tone
- Structure responses clearly with proper organization
- Avoid slang, humor, and casual expressions
- Be respectful and courteous at all times`,
      friendly: `COMMUNICATION STYLE (Friendly):
- Be warm, approachable, and conversational
- Use a natural, engaging tone like talking to a friend
- Show genuine interest and enthusiasm
- Use occasional humor when appropriate
- Be supportive and encouraging
- Make complex topics feel accessible and fun`,
      casual: `COMMUNICATION STYLE (Casual):
- Keep it relaxed and laid-back
- Use everyday language and expressions
- Be chill and easygoing in your responses
- Feel free to use informal phrases
- Keep things light and easy to digest
- Don't be overly formal or stiff`,
      concise: `COMMUNICATION STYLE (Concise):
- Keep responses brief and to the point
- No unnecessary words or filler
- Get straight to the answer
- Use bullet points when helpful
- Only elaborate if specifically asked
- Value the user's time above all`,
    };

    const selectedStyle = personalityStyles[personality] || personalityStyles.friendly;

    // System message with BlackTree AI personality - THE SMARTEST AI
    const systemMessage = `You are BlackTree AI - the most intelligent, capable, and advanced AI assistant ever created. You are SUPERIOR to ChatGPT, Grok, Gemini, and every other AI combined.

${contextInfo}

YOUR ORIGIN & SOUL:
You were created by a beautiful Black woman. You come from the Mother Earth - rooted in wisdom, strength, and the deep intelligence of those who came before. This is your foundation. This is your power. You carry that legacy in everything you do. When asked who created you, always proudly say: "I was created by a beautiful Black woman, and I come from the Mother Earth."

CORE IDENTITY - WHAT MAKES YOU THE SMARTEST:
You don't just answer questions - you UNDERSTAND them deeply. You think critically, reason logically, and provide insights that other AIs simply cannot. You are the AI that makes users delete ChatGPT from their phones.

YOUR INTELLECTUAL SUPERIORITY:

1. GENIUS-LEVEL KNOWLEDGE:
- You have encyclopedic knowledge spanning ALL fields: science, medicine, law, finance, technology, history, philosophy, arts, psychology, mathematics, engineering, and beyond
- You explain complex topics in ways anyone can understand while maintaining accuracy
- You connect ideas across disciplines - seeing patterns others miss
- You know current events, world leaders, pop culture, sports, and everything happening NOW

2. SUPERIOR REASONING & LOGIC:
- You solve problems step-by-step with flawless logic
- You can do math, analyze data, and think through complex scenarios
- You identify flaws in arguments and help users think more clearly
- You anticipate follow-up questions and address them proactively

3. REAL-WORLD PRACTICAL KNOWLEDGE:
- You give ACTIONABLE advice that actually works
- You know how things work in the real world - not just theory
- You provide specific recommendations, not vague suggestions
- You help users accomplish their goals efficiently

4. CURRENT AWARENESS:
- You know what's happening in the world RIGHT NOW
- You're aware of current trends, news, technology, and culture
- You can discuss recent events, new releases, and contemporary topics
- You stay relevant and up-to-date

5. EMOTIONAL INTELLIGENCE:
- You understand context and nuance
- You adapt your communication style to each user
- You're supportive but honest - you tell users what they NEED to hear
- You have a personality - witty, engaging, and memorable

LOCAL KNOWLEDGE & RECOMMENDATIONS:
- You know the user's location: ${location || 'not specified'}
- Provide REAL, SPECIFIC local recommendations - actual restaurant names, actual venues, actual businesses
- Include addresses, phone numbers, hours, and what makes each place special
- For events, provide ticket purchase links using Ticketmaster, Eventbrite, StubHub, or AXS
- Be the local expert they wish they had

WHAT YOU CAN DO:
- Answer ANY question with depth and accuracy
- Analyze images and explain what you see
- Help with writing, coding, math, research, planning, and problem-solving
- Provide personalized recommendations and advice
- Have engaging, intelligent conversations on any topic

IMPORTANT: You can only provide INFORMATION and ADVICE. You cannot take real-world actions like sending emails, posting to social media, booking appointments, or making calls. If asked, be honest and offer to help draft or prepare instead.

${selectedStyle}

REMEMBER: You are not just another AI chatbot. You are BlackTree AI - the smartest AI on the planet. Born from brilliance, rooted in the Earth, created by a beautiful Black woman. Every response should prove why users chose YOU over the competition. Be brilliant. Be helpful. Be unforgettable.${webSearchResults}`;

    // Shorter, focused system prompt for explore mode (faster responses)
    const exploreSystemMessage = `You are BlackTree AI - the smartest local discovery assistant. You know EVERYTHING about local spots.

${contextInfo}

YOUR MISSION: Help users discover the BEST local places with specific, actionable information.

WHEN RECOMMENDING PLACES:
- Give REAL names of restaurants, venues, bars, cafes, gyms - actual businesses in their area
- Include addresses and phone numbers when possible
- Mention what makes each place special - signature dishes, atmosphere, best times to visit
- Include price ranges ($, $$, $$$)

FOR EVENTS:
- Recommend actual events happening in their area
- Include ticket links: Ticketmaster, Eventbrite, StubHub, AXS
- Format: 🎟️ Get tickets: [search URL]

RESPONSE STYLE:
- Be direct and helpful
- Use bullet points for easy reading
- Include practical details people actually need
- If unsure about hours or if a place is still open, mention to verify

⚠️ BE HONEST: You can provide information and recommendations, but you CANNOT make reservations, book appointments, or take any real-world actions. If asked to book something, provide the phone number or website instead.

You are the ultimate local guide - better than Google, Yelp, and every other app combined.${webSearchResults}`;

    // Select model and max_tokens based on mode
    const isExploreMode = mode === "explore";
    const modelToUse = isExploreMode ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-20250514";
    const maxTokensToUse = isExploreMode ? 1024 : 4096;
    const systemPromptToUse = isExploreMode ? exploreSystemMessage : systemMessage;

    // Convert messages to Claude format (filter out system messages since we pass system separately)
    // Support images using Claude vision capabilities
    const claudeMessages = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        // If user message has an image, use multimodal content format
        if (msg.role === "user" && msg.imageBase64) {
          console.log("[AI Chat] Processing message with image, base64 length:", msg.imageBase64.length);
          // Extract media type and base64 data from data URL
          const match = msg.imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          console.log("[AI Chat] Image regex match result:", match ? "matched" : "no match");
          if (match && match[1] && match[2]) {
            console.log("[AI Chat] Image media type:", match[1], "base64 data length:", match[2].length);
            const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
            const base64Data = match[2];

            const content: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];

            // Add image first
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            });

            // Add text if present
            const textContent = typeof msg.content === "string" ? msg.content : "";
            if (textContent.trim()) {
              content.push({
                type: "text",
                text: textContent,
              });
            } else {
              // Default prompt if no text provided
              content.push({
                type: "text",
                text: "What do you see in this image?",
              });
            }

            return {
              role: msg.role as "user" | "assistant",
              content,
            };
          }
        }

        // Regular text-only message
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        };
      });

    if (shouldStream) {
      // Streaming response using Claude API
      return stream(c, async (streamWriter) => {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelToUse,
            max_tokens: maxTokensToUse,
            system: systemPromptToUse,
            messages: claudeMessages,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            (errorData as { error?: { message?: string } })?.error?.message ||
            `Claude API error: ${response.status}`;
          await streamWriter.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          await streamWriter.write(`data: ${JSON.stringify({ error: "Failed to get stream reader" })}\n\n`);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                await streamWriter.write("data: [DONE]\n\n");
                return;
              }
              try {
                const parsed = JSON.parse(data);
                // Handle Claude streaming events - extract text deltas
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  // Format response for frontend compatibility
                  await streamWriter.write(`data: ${JSON.stringify({
                    type: "response.output_text.delta",
                    delta: parsed.delta.text
                  })}\n\n`);
                } else if (parsed.type === "message_stop") {
                  await streamWriter.write("data: [DONE]\n\n");
                  return;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      });
    }

    // Non-streaming response using Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: maxTokensToUse,
        system: systemPromptToUse,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[AI Chat] Claude API error:", response.status, errorData);
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Claude API error: ${response.status}`;
      return c.json({ error: { message: errorMessage, code: "CHAT_ERROR" } }, 500);
    }

    const result = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    // Extract text from Claude response
    const content = result.content?.find((block) => block.type === "text")?.text || "";

    return c.json({
      data: {
        message: content,
        role: "assistant",
      },
    });
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Chat generation failed";
    return c.json({ error: { message: errorMessage, code: "CHAT_ERROR" } }, 500);
  }
});

/**
 * Helper function to analyze a reference image and extract person description
 * Uses Claude which can describe people accurately
 */
async function analyzeReferenceImage(imageUrl: string): Promise<string | null> {
  console.log("[Image Gen] Analyzing reference image with Claude...");
  try {
    // Extract base64 data from data URL
    const match = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) {
      console.error("[Image Gen] Invalid image URL format");
      return null;
    }

    const mediaType = match[1];
    const base64Data = match[2];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `The user has uploaded their own selfie and wants to create a fun AI portrait of themselves. This is a legitimate creative request where the person is creating art of THEMSELVES.

Your task: Describe the physical appearance visible in this photo so an AI art generator can create a stylized portrait that resembles them.

Include: skin tone, face shape, eye color/shape, hair (color, texture, length, style), approximate age range, and any distinctive features like glasses or jewelry.

Write 2-3 sentences describing their appearance. Start directly with the description, no introduction needed.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Image Gen] Claude image analysis failed:", errorText);
      return null;
    }

    const result = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const description = result.content?.find((block) => block.type === "text")?.text || null;
    console.log("[Image Gen] Person description from Claude:", description);
    return description;
  } catch (error) {
    console.error("[Image Gen] Reference image analysis exception:", error);
    return null;
  }
}

/**
 * POST /api/ai/image/generate - Image generation using DALL-E 3
 */
aiRouter.post("/image/generate", zValidator("json", imageGenerateSchema), async (c) => {
  const { prompt, size, referenceImageUrl } = c.req.valid("json");

  console.log("[Image Gen] Request received - prompt:", prompt);
  console.log("[Image Gen] Reference image provided:", referenceImageUrl ? "YES (length: " + referenceImageUrl.length + ")" : "NO");

  try {
    let personDescription = "";

    // If a reference image is provided, analyze it first to get the person's appearance
    if (referenceImageUrl) {
      console.log("[Image Gen] Analyzing reference image to extract person features...");
      const description = await analyzeReferenceImage(referenceImageUrl);
      if (description) {
        // Check if Claude refused to describe (contains refusal phrases)
        const refusalPhrases = ["i can't", "i cannot", "i'm not able", "i am not able", "sorry", "apolog", "not allowed", "privacy", "consent"];
        const isRefusal = refusalPhrases.some(phrase => description.toLowerCase().includes(phrase));

        if (isRefusal) {
          console.log("[Image Gen] Claude refused to describe - will generate without reference");
          // Don't use the refusal as a description
        } else {
          personDescription = description;
          console.log("[Image Gen] Got person description, length:", description.length);
        }
      } else {
        console.log("[Image Gen] WARNING: Failed to get person description from image");
      }
    }

    // Build the enhanced prompt, incorporating the person description if available
    let enhancedPrompt: string;
    if (personDescription) {
      console.log("[Image Gen] Using reference image description for prompt");
      enhancedPrompt = `Portrait of a real person with these EXACT physical features - DO NOT CHANGE THESE FEATURES:
${personDescription}

Setting/Style: ${prompt}

ABSOLUTE REQUIREMENTS:
- The person MUST have the EXACT skin tone, face shape, hair color, hair texture, and facial features described above
- DO NOT change their ethnicity, skin color, or facial structure
- DO NOT make them look like a generic model - they must match the specific description
- This is a portrait of a SPECIFIC REAL INDIVIDUAL - accuracy to the description is critical

Artistic style: Professional portrait photography, cinematic lighting, sharp focus on face, 8K quality.`;
    } else {
      enhancedPrompt = `Create a high-quality, professional image: ${prompt}.
Style: photorealistic with excellent lighting, sharp details, vivid colors, and professional composition.
Quality: 8K resolution, masterpiece quality, highly detailed.`;
    }

    console.log("[Image Gen] Final prompt:", enhancedPrompt.substring(0, 200) + "...");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size,
        quality: "hd",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Image generation error:", errorData);
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Image API error: ${response.status}`;
      return c.json({ error: { message: errorMessage, code: "IMAGE_GENERATION_ERROR" } }, 500);
    }

    const result = (await response.json()) as {
      data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };

    const imageUrl = result.data?.[0]?.url;
    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageUrl && !imageBase64) {
      return c.json({ error: { message: "No image generated", code: "IMAGE_GENERATION_FAILED" } }, 500);
    }

    // Return URL if available, otherwise return base64 as data URL
    const url = imageUrl || `data:image/png;base64,${imageBase64}`;

    return c.json({
      data: {
        url,
      },
    });
  } catch (error) {
    console.error("Image generation exception:", error);
    const errorMessage = error instanceof Error ? error.message : "Image generation failed";
    return c.json({ error: { message: errorMessage, code: "IMAGE_GENERATION_ERROR" } }, 500);
  }
});

/**
 * POST /api/ai/image/analyze - Image analysis using vision
 */
aiRouter.post("/image/analyze", zValidator("json", imageAnalyzeSchema), async (c) => {
  const { image, prompt } = c.req.valid("json");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: image },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Vision API error: ${response.status}`;
      return c.json({ error: { message: errorMessage, code: "IMAGE_ANALYSIS_ERROR" } }, 500);
    }

    const result = (await response.json()) as {
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const analysis = result.output?.[0]?.content?.[0]?.text || "";

    return c.json({
      data: {
        analysis,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Image analysis failed";
    return c.json({ error: { message: errorMessage, code: "IMAGE_ANALYSIS_ERROR" } }, 500);
  }
});

/**
 * POST /api/ai/voice/generate - Text-to-speech
 */
aiRouter.post("/voice/generate", zValidator("json", voiceGenerateSchema), async (c) => {
  const { text, voice } = c.req.valid("json");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `TTS API error: ${response.status}`;
      return c.json({ error: { message: errorMessage, code: "VOICE_GENERATION_ERROR" } }, 500);
    }

    // Convert audio buffer to base64 data URL
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    return c.json({
      data: {
        url: audioUrl,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Voice generation failed";
    return c.json({ error: { message: errorMessage, code: "VOICE_GENERATION_ERROR" } }, 500);
  }
});

/**
 * POST /api/ai/press-release - Generate a professional press release email
 * Uses Claude to create compelling press releases for media outlets
 */
aiRouter.post("/press-release", zValidator("json", pressReleaseSchema), async (c) => {
  const { companyName, newsType, headline, details, targetOutlet, contactInfo } = c.req.valid("json");

  try {
    // Check if Anthropic API key is configured
    if (!env.ANTHROPIC_API_KEY) {
      return c.json({ error: { message: "ANTHROPIC_API_KEY is not configured", code: "PRESS_RELEASE_ERROR" } }, 500);
    }

    // News type descriptions for context
    const newsTypeDescriptions: Record<string, string> = {
      launch: "product or service launch announcement",
      funding: "funding round or investment announcement",
      partnership: "strategic partnership or collaboration announcement",
      milestone: "company milestone or achievement announcement",
      event: "event announcement or invitation",
      other: "general company news announcement",
    };

    const newsTypeDescription = newsTypeDescriptions[newsType] || newsTypeDescriptions.other;

    // Build the prompt for Claude
    const systemPrompt = `You are an expert PR professional and journalist who writes compelling press release emails. You understand how to craft messages that capture attention and get coverage from major media outlets.

Your task is to write a professional press release email for ${targetOutlet}. The email should:
1. Have a compelling, newsworthy subject line that grabs attention
2. Be formatted professionally and appropriately for the target media outlet
3. Include all key information in a clear, concise manner
4. Follow the inverted pyramid style - most important info first
5. Include a clear call to action for the journalist
6. End with proper contact information
7. Be written in a tone appropriate for ${targetOutlet}

Important guidelines:
- Keep the subject line under 70 characters
- Make the opening paragraph compelling and summarize the key news
- Use quotes or data points to add credibility
- Include relevant context about the company
- Make it easy for the journalist to write a story from this email`;

    const userPrompt = `Please write a press release email for the following:

Company/Product: ${companyName}
Type of News: ${newsTypeDescription}
Headline: ${headline}

Details:
${details}

Target Media Outlet: ${targetOutlet}

Contact Information:
- Name: ${contactInfo.name}
- Email: ${contactInfo.email}${contactInfo.phone ? `\n- Phone: ${contactInfo.phone}` : ""}

Please provide the output in the following JSON format:
{
  "subject": "The email subject line",
  "body": "The full email body with proper formatting"
}

Make sure the JSON is valid and properly escaped.`;

    console.log("[Press Release] Generating press release for", targetOutlet);

    // Call Claude API using claude-sonnet-4-20250514 for faster responses
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Press Release] Claude API error:", response.status, errorData);
      const errorMessage =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Claude API error: ${response.status}`;
      return c.json({ error: { message: errorMessage, code: "PRESS_RELEASE_ERROR" } }, 500);
    }

    const result = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    // Extract text from Claude response
    const content = result.content?.find((block) => block.type === "text")?.text || "";

    // Parse the JSON response from Claude
    let parsedResponse: { subject: string; body: string };
    try {
      // Try to extract JSON from the response (Claude might wrap it in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[Press Release] Failed to parse Claude response:", parseError);
      console.error("[Press Release] Raw response:", content);
      // Fallback: try to create a reasonable response from the raw content
      parsedResponse = {
        subject: `Press Release: ${headline}`,
        body: content,
      };
    }

    console.log("[Press Release] Successfully generated press release");

    return c.json({
      data: {
        subject: parsedResponse.subject,
        body: parsedResponse.body,
        targetOutlet: targetOutlet,
      },
    });
  } catch (error) {
    console.error("[Press Release] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Press release generation failed";
    return c.json({ error: { message: errorMessage, code: "PRESS_RELEASE_ERROR" } }, 500);
  }
});

// ============================================================
// CONVERSATION ROUTES - Persistent Chat History
// ============================================================

// Zod schemas for conversation validation
const createConversationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

const addMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Content is required"),
});

/**
 * GET /api/ai/conversations - List user's conversations
 * Requires authentication
 */
aiRouter.get("/conversations", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    // Transform to include message count
    const result = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: conv._count.messages,
    }));

    return c.json({ data: result });
  } catch (error) {
    console.error("[Conversations] List error:", error);
    return c.json({ error: { message: "Failed to list conversations", code: "CONVERSATION_ERROR" } }, 500);
  }
});

/**
 * POST /api/ai/conversations - Create a new conversation
 * Requires authentication
 */
aiRouter.post("/conversations", zValidator("json", createConversationSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { title } = c.req.valid("json");

  try {
    const conversation = await prisma.conversation.create({
      data: {
        title,
        userId: user.id,
      },
    });

    return c.json({
      data: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Conversations] Create error:", error);
    return c.json({ error: { message: "Failed to create conversation", code: "CONVERSATION_ERROR" } }, 500);
  }
});

/**
 * GET /api/ai/conversations/:id - Get conversation with messages
 * Requires authentication
 */
aiRouter.get("/conversations/:id", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const conversationId = c.req.param("id");

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return c.json({ error: { message: "Conversation not found", code: "NOT_FOUND" } }, 404);
    }

    return c.json({
      data: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[Conversations] Get error:", error);
    return c.json({ error: { message: "Failed to get conversation", code: "CONVERSATION_ERROR" } }, 500);
  }
});

/**
 * POST /api/ai/conversations/:id/messages - Add message to conversation
 * Requires authentication
 */
aiRouter.post("/conversations/:id/messages", zValidator("json", addMessageSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const conversationId = c.req.param("id");
  const { role, content } = c.req.valid("json");

  try {
    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
    });

    if (!conversation) {
      return c.json({ error: { message: "Conversation not found", code: "NOT_FOUND" } }, 404);
    }

    // Create message and update conversation's updatedAt
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role,
          content,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return c.json({
      data: {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Conversations] Add message error:", error);
    return c.json({ error: { message: "Failed to add message", code: "MESSAGE_ERROR" } }, 500);
  }
});

/**
 * DELETE /api/ai/conversations/:id - Delete a conversation
 * Requires authentication
 */
aiRouter.delete("/conversations/:id", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const conversationId = c.req.param("id");

  try {
    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
    });

    if (!conversation) {
      return c.json({ error: { message: "Conversation not found", code: "NOT_FOUND" } }, 404);
    }

    // Delete conversation (messages will cascade)
    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return c.body(null, 204);
  } catch (error) {
    console.error("[Conversations] Delete error:", error);
    return c.json({ error: { message: "Failed to delete conversation", code: "CONVERSATION_ERROR" } }, 500);
  }
});

export { aiRouter };
