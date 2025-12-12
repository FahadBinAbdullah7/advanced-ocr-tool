'use server';

import {ai} from '@/ai/genkit';
import {z} from 'zod';  // Changed from 'genkit'

const EnhanceAndRedrawImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A low-quality image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export type EnhanceAndRedrawImageInput = z.infer<typeof EnhanceAndRedrawImageInputSchema>;

const EnhanceAndRedrawImageOutputSchema = z.object({
  redrawnImage: z
    .string()
    .describe('The AI-redrawn, enhanced version of the image, as a data URI.'),
});

export type EnhanceAndRedrawImageOutput = z.infer<typeof EnhanceAndRedrawImageOutputSchema>;

export async function enhanceAndRedrawImage(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  return enhanceAndRedrawImageFlow(input);
}

const enhanceAndRedrawImageFlow = ai.defineFlow(
  {
    name: 'enhanceAndRedrawImageFlow',
    inputSchema: EnhanceAndRedrawImageInputSchema,
    outputSchema: EnhanceAndRedrawImageOutputSchema,
  },
  async input => {
    const response = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {
          text: 'Recreate this image exactly as shown, maintaining all details. Keep transparent background if present. Do not add, remove, or modify any elements including text. Make it cleaner and higher quality while preserving everything exactly.'
        },
      ],
      model: 'googleai/gemini-2.0-flash-exp',  // Updated model
      config: {
        responseModalities: ['IMAGE'],  // Try IMAGE only first
      },
    });

    // Debug: log the response structure
    console.log('Response:', JSON.stringify(response, null, 2));

    // Try different ways to access the image
    const imageUrl = response.media?.url 
      || response.output?.media?.url 
      || response.candidates?.[0]?.content?.media?.url;

    if (!imageUrl) {
      throw new Error('No image URL in response: ' + JSON.stringify(response));
    }

    return {redrawnImage: imageUrl};
  }
);
