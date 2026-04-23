import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;
let activeApiKey: string | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your .env.local file.');
  // Recreate the client if the key has been rotated since the last call
  if (!client || activeApiKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    activeApiKey = apiKey;
  }
  return client;
}
