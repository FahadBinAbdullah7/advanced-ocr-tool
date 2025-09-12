'use server';
/**
 * @fileOverview An AI agent that enhances and upscales images while maintaining exact details.
 *
 * - enhanceAndRedrawImage - A function that handles the image enhancement process.
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
    .describe('The AI-enhanced version of the image, as a data URI.'),
});

export type EnhanceAndRedrawImageOutput = z.infer<typeof EnhanceAndRedrawImageOutputSchema>;

export async function enhanceAndRedrawImage(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  return enhanceImageFlow(input);
}

// Method 1: Try image editing/enhancement instead of generation
const enhanceImageFlow = ai.defineFlow(
  {
    name: 'enhanceImageFlow',
    inputSchema: EnhanceAndRedrawImageInputSchema,
    outputSchema: EnhanceAndRedrawImageOutputSchema,
  },
  async input => {
    try {
      // Try using image editing capabilities if available
      const {media} = await ai.generate({
        prompt: [
          {media: {url: input.photoDataUri}},
          {
            text: `UPSCALE and ENHANCE this image. Do not recreate or redraw - only improve the existing image quality:

ENHANCEMENT INSTRUCTIONS:
- Upscale resolution by 2-4x
- Sharpen blurry areas
- Reduce noise and compression artifacts  
- Enhance contrast and brightness naturally
- Improve color saturation slightly
- Clean up pixelation
- Maintain transparent background if present

CRITICAL: Do not change, add, remove, or redraw any content. Only enhance the quality of what already exists.`
          },
        ],
        model: 'googleai/gemini-2.0-flash-preview-image-generation',
        config: {
          responseModalities: ['IMAGE'],
          temperature: 0,
        },
      });
      
      return {redrawnImage: media.url!};
    } catch (error) {
      // Fallback to recreation method with very specific instructions
      return await recreateWithMaximumFidelity(input);
    }
  }
);

// Method 2: Multi-step approach for better detail preservation
const recreateWithMaximumFidelity = async (input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> => {
  // Step 1: Get extremely detailed description
  const description = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {
        text: `Create an EXHAUSTIVE, pixel-level description of this image for exact recreation:

COMPOSITION:
- Exact dimensions and aspect ratio
- Position of every element (use percentages)
- Viewing angle and perspective details

SUBJECTS (if people):
- Age, gender, ethnicity appearance
- Facial features in detail (eyes, nose, mouth, hair)
- Exact facial expression and head position
- Body posture and limb positioning
- Clothing details (colors, patterns, fit, style)

OBJECTS:
- List every single object visible
- Exact colors (use specific color names/hex if possible)
- Textures and materials
- Positions relative to each other
- Any text, logos, or symbols with exact wording

BACKGROUND:
- Setting description
- All background elements and their positions
- Lighting direction and quality
- Shadows and highlights
- Color palette

TECHNICAL DETAILS:
- Image quality/resolution assessment
- Any blur, noise, or artifacts present
- Lighting conditions
- Color temperature and mood

Be extremely specific - this description will be used to recreate the image exactly.`
      },
    ],
    model: 'googleai/gemini-2.0-flash-preview',
  });

  // Step 2: Use the detailed description to recreate
  const {media} = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {
        text: `Reference image provided above. Using this detailed analysis: "${description.text()}"

CREATE IDENTICAL IMAGE with these strict requirements:

FIDELITY RULES:
- Use the reference image as the absolute ground truth
- Every pixel must correspond to the original
- Zero creative interpretation allowed
- No style changes or artistic improvements
- Maintain exact same composition and framing

ENHANCEMENT ONLY:
- Increase resolution to high definition
- Remove blur, noise, and compression artifacts
- Enhance sharpness and clarity
- Improve color vibrancy naturally
- Better contrast and lighting
- Smoother gradients

VERIFICATION CHECKLIST:
✓ Same number of people/objects
✓ Identical poses and expressions  
✓ Same clothing and colors
✓ Same background elements
✓ Same lighting and shadows
✓ Same text/signs if any
✓ Same overall mood and atmosphere

OUTPUT: A high-quality version that looks like the exact same photo/image taken with better equipment.`
      },
    ],
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: ['IMAGE'],
      temperature: 0,
    },
  });

  return {redrawnImage: media.url!};
};

// Method 3: Alternative approach using different model parameters
export async function enhanceImageAlternative(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  return enhanceImageAlternativeFlow(input);
}

const enhanceImageAlternativeFlow = ai.defineFlow(
  {
    name: 'enhanceImageAlternativeFlow', 
    inputSchema: EnhanceAndRedrawImageInputSchema,
    outputSchema: EnhanceAndRedrawImageOutputSchema,
  },
  async input => {
    // Try multiple attempts with different prompting strategies
    const attempts = [
      // Attempt 1: Direct upscaling instruction
      {
        text: "Upscale this image to higher resolution. Keep everything exactly the same, just make it clearer and sharper.",
        temp: 0
      },
      // Attempt 2: Photo restoration approach
      {
        text: "Restore and enhance this image like a professional photo editor would. Remove any blur, noise, or quality issues while keeping all content identical.",
        temp: 0.1
      },
      // Attempt 3: Technical enhancement
      {
        text: "Apply super-resolution enhancement to this image. Increase pixel density and improve clarity without changing any visual content.",
        temp: 0
      }
    ];

    for (const attempt of attempts) {
      try {
        const {media} = await ai.generate({
          prompt: [
            {media: {url: input.photoDataUri}},
            {text: attempt.text},
          ],
          model: 'googleai/gemini-2.0-flash-preview-image-generation',
          config: {
            responseModalities: ['IMAGE'],
            temperature: attempt.temp,
          },
        });
        
        if (media?.url) {
          return {redrawnImage: media.url};
        }
      } catch (error) {
        console.log(`Attempt failed, trying next approach...`);
        continue;
      }
    }
    
    throw new Error("All enhancement attempts failed");
  }
);

// Method 4: Try using Imagen or other models if available
export async function enhanceWithDifferentModel(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  const models = [
    'googleai/gemini-2.0-flash-preview-image-generation',
    'googleai/imagen-3.0-generate-001', // If available
    'googleai/imagen-3.0-fast-generate-001', // If available
  ];

  for (const model of models) {
    try {
      const {media} = await ai.generate({
        prompt: [
          {media: {url: input.photoDataUri}},
          {text: "Enhance image quality. Same content, better resolution and clarity."},
        ],
        model: model,
        config: {
          responseModalities: ['IMAGE'],
          temperature: 0,
        },
      });
      
      if (media?.url) {
        return {redrawnImage: media.url};
      }
    } catch (error) {
      console.log(`Model ${model} failed, trying next...`);
      continue;
    }
  }
  
  throw new Error("All models failed to enhance image");
}
