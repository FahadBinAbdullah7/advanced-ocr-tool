'use server';
/**
 * @fileOverview An AI agent that enhances and redraws images.
 *
 * - enhanceAndRedrawImage - A function that handles the image enhancement and redrawing process.
 * - EnhanceAndRedrawImageInput - The input type for the enhanceAndRedrawImage function.
 * - EnhanceAndRedrawImageOutput - The return type for the enhanceAndRedrawImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
    const {media, text} = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: recreate this image, maintain all small and big details with transparent background, do not add or remove anything from the image, do not modify the image, if there is text in the given image keep the text same, do not delete or modify the texts, maintaining all the details just make it beautiful, while making it beautiful do not add or change anything, maintain exact same thing of the ooriginal image.' }, // (Keep your full prompt)
      ],
      // Correct the model name
      model: 'googleai/gemini-2.5-flash-image', 
      // Try removing the config first, or use just ['IMAGE'] if supported by your Genkit version
      // config: {
      //   responseModalities: ['IMAGE'], 
      // },
    });

    if (!media || !media.url) {
        throw new Error(`Image generation failed. Model response: ${text}`);
    }

    return {redrawnImage: media.url};
  }
);
