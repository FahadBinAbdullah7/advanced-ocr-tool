'use server';
/**
 * @fileOverview An AI agent that enhances and redraws images with high fidelity.
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
    const {media} = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {
          text: `Create an exact high-quality recreation of this image with the following requirements:

COMPOSITION & LAYOUT:
- Maintain the exact same composition, framing, and perspective
- Keep all elements in their precise original positions
- Preserve the exact same proportions and scale relationships
- Match the original aspect ratio perfectly

VISUAL ELEMENTS:
- Recreate every single object, person, or element visible in the original
- Maintain all facial features, expressions, and poses exactly as shown
- Preserve all clothing details, patterns, textures, and colors
- Keep all background elements in their exact positions
- Maintain any text, signs, or written elements with identical content and styling

TECHNICAL SPECIFICATIONS:
- Enhance the image quality and resolution significantly
- Improve sharpness and clarity while maintaining authenticity
- Enhance colors to be more vibrant but naturally realistic
- Reduce noise and artifacts from the original image
- Improve lighting and contrast for better visibility
- Use transparent background if the original appears to have one

FIDELITY REQUIREMENTS:
- Do NOT add any new elements not present in the original
- Do NOT remove or omit any details from the original image
- Do NOT change poses, expressions, or positioning of any subjects
- Do NOT alter the artistic style unless it's clearly a quality improvement
- Do NOT change the mood, atmosphere, or overall feel of the image

Create a pixel-perfect, high-definition version that looks like a professionally enhanced version of the exact same photograph or image.`
        },
      ],
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
        temperature: 0.1, // Lower temperature for more consistent reproduction
      },
    });
    
    return {redrawnImage: media.url!};
  }
);

// Alternative version with even more specific prompting for different image types
export async function enhanceAndRedrawImageAdvanced(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  return enhanceAndRedrawImageAdvancedFlow(input);
}

const enhanceAndRedrawImageAdvancedFlow = ai.defineFlow(
  {
    name: 'enhanceAndRedrawImageAdvancedFlow',
    inputSchema: EnhanceAndRedrawImageInputSchema,
    outputSchema: EnhanceAndRedrawImageOutputSchema,
  },
  async input => {
    // First, analyze the image to understand what type it is
    const analysisResponse = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {
          text: `Analyze this image and describe:
1. What type of image this is (photo, illustration, artwork, etc.)
2. Main subjects and their positions
3. Background elements and setting
4. Color scheme and lighting
5. Any text or specific details that must be preserved
6. Overall style and mood

Provide a detailed description that could be used to recreate this image exactly.`
        },
      ],
      model: 'googleai/gemini-2.0-flash-preview',
    });

    // Use the analysis to create a more targeted enhancement prompt
    const {media} = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {
          text: `Based on the analysis: "${analysisResponse.text()}"

Create an EXACT high-quality recreation of this image. Requirements:

PIXEL-PERFECT RECREATION:
- Study every pixel of the original image carefully
- Recreate the exact same scene with identical composition
- Maintain every single detail, no matter how small
- Preserve the exact positioning of all elements
- Keep the same viewing angle and perspective

QUALITY ENHANCEMENT ONLY:
- Increase resolution and sharpness dramatically
- Enhance clarity and reduce blur/pixelation
- Improve color vibrancy and contrast naturally
- Remove noise, compression artifacts, and distortions
- Better lighting and shadow definition
- Smoother gradients and cleaner edges

STRICT FIDELITY RULES:
- No additions, removals
- Maintain exact colors (enhanced but not changed)
- Preserve all text, logos, signs with identical content
- Keep facial expressions and body language unchanged
- Maintain all clothing patterns, textures, and details


OUTPUT: A crystal-clear, high-definition version that looks like the original image was shot with professional equipment and processed by an expert photographer, but with absolutely no changes to the actual content or composition.`
        },
      ],
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.05, // Very low temperature for maximum consistency
      },
    });
    
    return {redrawnImage: media.url!};
  }
);
