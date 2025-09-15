'use server';

/**
 * @fileOverview This flow corrects and summarizes errors in extracted text using Gemini AI.
 *
 * - correctAndSummarizeText - A function that handles the text correction and summarization process.
 * - CorrectAndSummarizeTextInput - The input type for the correctAndSummarizeText function.
 * - CorrectAndSummarizeTextOutput - The return type for the correctAndSummarizeText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CorrectAndSummarizeTextInputSchema = z.object({
  extractedText: z
    .string()
    .describe('The extracted text that needs to be corrected and summarized.'),
});
export type CorrectAndSummarizeTextInput = z.infer<
  typeof CorrectAndSummarizeTextInputSchema
>;

const CorrectionEntrySchema = z.object({
  original: z.string().describe('The original text.'),
  corrected: z.string().describe('The corrected text.'),
});

const CorrectAndSummarizeTextOutputSchema = z.object({
  correctedText: z
    .string()
    .describe('The corrected text with all identified errors fixed.'),
  correctionsSummary: z
    .array(CorrectionEntrySchema)
    .describe('A list of corrections made, with original and corrected text.'),
});
export type CorrectAndSummarizeTextOutput = z.infer<
  typeof CorrectAndSummarizeTextOutputSchema
>;

export async function correctAndSummarizeText(
  input: CorrectAndSummarizeTextInput
): Promise<CorrectAndSummarizeTextOutput> {
  return correctAndSummarizeTextFlow(input);
}

const correctTextPrompt = ai.definePrompt({
  name: 'correctTextPrompt',
  input: {schema: z.object({extractedText: z.string()})},
  output: {schema: z.object({correctedText: z.string()})},
  prompt: `You are an expert text correction specialist. Analyze the following OCR-extracted text and perform comprehensive quality assurance.

CRITICAL INSTRUCTIONS:
1.  Fix spelling mistakes, grammar errors, and punctuation issues.
2.  Correct word spacing problems and character recognition errors.
3.  Support multiple languages: English and Bengali/Bangla.
4.  Identify and format mathematical expressions for clarity.
5.  **Vector Notation**: Vectors are represented by characters with a combining overline (e.g., A̅B̅, A̅C̅). You must recognize and preserve this notation. If you see garbage characters around this notation (like 'U A̅B̅' or 'st A̅C̅'), you MUST remove the garbage characters and keep only the correct vector notation (e.g., 'A̅B̅'). If vectors are written as 'AB→', convert them to the overhead notation by placing a combining overline character (U+0305) over EACH character to form a single continuous line (e.g., 'A̅B̅').
6.  **CRITICAL**: DO NOT change any mathematical signs or operators unless they are clearly part of a typo (e.g., '1 ++ 1' should be '1 + 1'). Preserve correct mathematical notation.
7.  Maintain original meaning and structure—don't change correct text.

Original Text to Correct:
{{{extractedText}}}

Output only the fully corrected text.
`,
});

const summarizeCorrectionsPrompt = ai.definePrompt({
  name: 'summarizeCorrectionsPrompt',
  input: {
    schema: z.object({
      originalText: z.string(),
      correctedText: z.string(),
    }),
  },
  output: {
    schema: z.object({
      correctionsSummary: z.array(CorrectionEntrySchema),
    }),
  },
  prompt: `You are an expert in identifying differences between two versions of a text. Compare the original text with the corrected text and create a summary of the changes.

-   If a word or phrase was changed, list the original and the corrected version.
-   If there are no differences, return an empty array.

Return a valid JSON object with a single key "correctionsSummary" which is an array of objects, each with an "original" and "corrected" key.

Original Text:
{{{originalText}}}

Corrected Text:
{{{correctedText}}}
`,
});

const correctAndSummarizeTextFlow = ai.defineFlow(
  {
    name: 'correctAndSummarizeTextFlow',
    inputSchema: CorrectAndSummarizeTextInputSchema,
    outputSchema: CorrectAndSummarizeTextOutputSchema,
  },
  async input => {
    // Step 1: Correct the text
    const correctTextResult = await correctTextPrompt(input);
    const correctedText = correctTextResult.output?.correctedText || input.extractedText;

    // Step 2: Summarize the corrections
    const summarizeCorrectionsResult = await summarizeCorrectionsPrompt({
      originalText: input.extractedText,
      correctedText: correctedText,
    });
    const correctionsSummary =
      summarizeCorrectionsResult.output?.correctionsSummary || [];

    return {
      correctedText,
      correctionsSummary,
    };
  }
);
