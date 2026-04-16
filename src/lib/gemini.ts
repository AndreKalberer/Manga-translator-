import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your .env.local file.');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
