import { GoogleGenerativeAI } from '@google/generative-ai';

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your .env.local file.');
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}
