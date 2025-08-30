import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey:
        process.env.GOOGLE_API_KEY || 'AIzaSyCWFqfCAdrqAgQFB1JKpoLadvV9QGzw14E',
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});
