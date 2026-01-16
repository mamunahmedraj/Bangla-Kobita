import { GoogleGenAI, Modality } from "@google/genai";

// Audio Context constants
const SAMPLE_RATE = 24000;

/**
 * Base64 decoding helper
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM data into an AudioBuffer
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Generates a new poem text based on user inputs
 */
export async function generatePoemText(topic: string, mood: string, style: string): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Write a high-quality Bengali poem.
  Topic: ${topic}
  Mood: ${mood}
  Style: ${style}
  
  Requirements:
  1. Output ONLY the poem text in Bengali script.
  2. Do not include English translations or explanations.
  3. The poem should be rhythmic and emotionally resonant.
  4. Keep it between 8 to 16 lines.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
}

/**
 * Generates revolutionary speech using Gemini
 */
export async function generateRevolutionarySpeech(text: string): Promise<AudioBuffer> {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Constructed prompt to guide the model towards a highly emotional, realistic performance.
  // We explicitly ask for specific emotions: sorrow, rage, and a human-like breaking voice.
  const emotionalPrompt = `Recite the following Bengali poem with intense, gut-wrenching emotion. 
  Your voice should sound realistic, human, and heavy with the pain of sacrifice, yet filled with revolutionary rage. 
  It must be heartbreaking, as if you are on the verge of tears but screaming for justice.
  
  Poem:
  ${text}`;

  // We are using the specialized TTS model
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: emotionalPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          // 'Fenrir' provides the deep resonance needed for this intense revolutionary weight
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("No audio data returned from Gemini");
  }

  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: SAMPLE_RATE
  });
  
  const audioBytes = decode(base64Audio);
  return await decodeAudioData(audioBytes, outputAudioContext, SAMPLE_RATE, 1);
}