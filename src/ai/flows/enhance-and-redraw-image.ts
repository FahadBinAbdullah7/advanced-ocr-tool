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
  colorize: z.boolean().optional().describe('Whether to add color to the image creatively.'),
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
    let promptText = '';
    if (input.colorize) {
      promptText = `You are a professional digital artist. Recreate the provided image with vibrant, realistic colors. Your primary goal is to enhance the existing details, lighting, and overall quality to make it a proper, colorful photograph or illustration. It is absolutely critical to maintain all the original objects, shapes, and composition. Do not add, remove, or change any elements from the original image.`;
    } else {
      promptText = `You are a professional digital artist. Recreate the provided image exactly as it is, but with significantly higher quality. Your task is to upscale the resolution, sharpen the details, and remove any noise or artifacts. DO NOT change any colors, objects, or the composition. The final output should be a clean, crisp, high-resolution version of the original image, preserving every detail.`;
    }

    const {media} = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: promptText},
      ],
      model: 'googleai/gemini-2.5-flash-image-preview',
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
      },
    });

    return {redrawnImage: media.url!};
  }
);
