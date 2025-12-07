import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey:
        process.env.GOOGLE_API_KEY || 'AIzaSyCWFqfCAdrqAgQFB1JKpoLadvV9QGzw14E',
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});
