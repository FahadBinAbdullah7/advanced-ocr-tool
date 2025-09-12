'use server';
/**
 * @fileOverview An AI agent that enhances images using different approaches.
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
  // Try multiple approaches in order of likelihood to succeed
  const approaches = [
    () => tryDirectGeneration(input),
    () => tryWithDetailedAnalysis(input),
    () => tryWithSimplePrompt(input),
    () => tryWithDifferentConfig(input)
  ];

  let lastError: Error | null = null;

  for (const approach of approaches) {
    try {
      const result = await approach();
      if (result.redrawnImage) {
        return result;
      }
    } catch (error) {
      lastError = error as Error;
      console.log(`Approach failed: ${error}. Trying next approach...`);
    }
  }

  throw lastError || new Error('All enhancement approaches failed');
}

// Approach 1: Direct generation with simple, clear instructions
async function tryDirectGeneration(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  const response = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {text: 'Create a high-quality version of this exact image. Keep all details identical but improve the resolution and clarity.'}
    ],
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  if (!response.media?.url) {
    throw new Error('No image generated in direct approach');
  }

  return {redrawnImage: response.media.url};
}

// Approach 2: With detailed analysis first
async function tryWithDetailedAnalysis(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  // First, get detailed description
  const analysisResponse = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {text: 'Describe this image in complete detail, including all objects, people, colors, positions, expressions, clothing, background elements, and any text or symbols present.'}
    ],
    model: 'googleai/gemini-2.0-flash-preview',
  });

  // Then generate based on description + reference
  const response = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {text: `Looking at this reference image, create a high-definition version with these exact details: ${analysisResponse.text()}. The output should be identical in content but with enhanced quality, sharpness, and resolution.`}
    ],
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  if (!response.media?.url) {
    throw new Error('No image generated in detailed analysis approach');
  }

  return {redrawnImage: response.media.url};
}

// Approach 3: Very simple prompt
async function tryWithSimplePrompt(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  const response = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {text: 'Make this image higher quality and resolution while keeping everything exactly the same.'}
    ],
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0,
    },
  });

  if (!response.media?.url) {
    throw new Error('No image generated in simple prompt approach');
  }

  return {redrawnImage: response.media.url};
}

// Approach 4: Different configuration
async function tryWithDifferentConfig(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  const response = await ai.generate({
    prompt: [
      {media: {url: input.photoDataUri}},
      {text: 'Reproduce this image with better quality, maintaining all original details, colors, positions, and elements exactly as shown.'}
    ],
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: ['IMAGE'], // Try IMAGE only
      temperature: 0.1,
    },
  });

  if (!response.media?.url) {
    throw new Error('No image generated in different config approach');
  }

  return {redrawnImage: response.media.url};
}

// Alternative: Try using Gemini Flash for text analysis + generation
export async function enhanceWithTextGuidance(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput> {
  try {
    // Get very detailed description using regular Gemini
    const description = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: `Provide an extremely detailed description of this image that could be used to recreate it exactly. Include:
        1. Overall composition and layout
        2. Every person/object and their exact positions
        3. Facial expressions, poses, gestures
        4. Clothing details, colors, patterns
        5. Background elements and their positions  
        6. Lighting, shadows, color palette
        7. Any text, signs, or symbols
        8. Style and mood of the image
        9. Technical aspects (blur, focus, etc.)
        
        Be extremely specific about positions, colors, and details.`}
      ],
      model: 'googleai/gemini-2.0-flash-preview',
    });

    // Now use that description with the reference image
    const enhancedResponse = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: `Using this reference image and following this exact description: "${description.text()}"
        
        Create a high-definition, enhanced version that matches every single detail described above. The result should look like the same photo taken with professional equipment and processed for maximum quality.
        
        Requirements:
        - Identical composition and positioning
        - Same people/objects in same poses
        - Same colors and lighting
        - Same background elements
        - Enhanced resolution and clarity
        - Reduced noise and improved sharpness
        - No additions or changes to content`}
      ],
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0,
      },
    });

    if (!enhancedResponse.media?.url) {
      throw new Error('No enhanced image generated');
    }

    return {redrawnImage: enhancedResponse.media.url};

  } catch (error) {
    throw new Error(`Text-guided enhancement failed: ${error}`);
  }
}

// Debug version that provides more error information
export async function enhanceWithDebug(input: EnhanceAndRedrawImageInput): Promise<EnhanceAndRedrawImageOutput & {debug?: string}> {
  try {
    console.log('Starting image enhancement...');
    
    const response = await ai.generate({
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: 'Create a clearer, higher resolution version of this image.'}
      ],
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    console.log('Generation response:', {
      hasText: !!response.text(),
      hasMedia: !!response.media,
      mediaUrl: response.media?.url,
      mediaContentType: response.media?.contentType
    });

    if (!response.media?.url) {
      return {
        redrawnImage: input.photoDataUri, // Return original as fallback
        debug: `No media URL returned. Response text: ${response.text()}`
      };
    }

    return {
      redrawnImage: response.media.url,
      debug: 'Success'
    };

  } catch (error) {
    console.error('Enhancement error:', error);
    return {
      redrawnImage: input.photoDataUri, // Return original as fallback
      debug: `Error: ${error}`
    };
  }
}
