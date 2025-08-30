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

const correctAndSummarizeTextPrompt = ai.definePrompt({
  name: 'correctAndSummarizeTextPrompt',
  input: {schema: CorrectAndSummarizeTextInputSchema},
  output: {schema: CorrectAndSummarizeTextOutputSchema},
  prompt: `You are an AI expert in correcting text and identifying errors. Your primary goal is to fix mistakes while preserving the original structure and formatting of the text as closely as possible.

You will receive extracted text that may contain spelling mistakes, grammatical errors, or other inaccuracies. Your task is to:

1.  Correct any errors in the extracted text to produce a clean, accurate version.
2.  **Crucially, maintain the original line breaks, indentation, and general formatting of the text.** Do not combine paragraphs or alter the layout unless it's essential for correcting a grammatical error.
3.  Identify the specific corrections you made.
4.  Summarize these corrections in a structured format, showing the original and corrected text for each change.

Extracted Text: {{{extractedText}}}

Output the corrected text and a summary of the corrections made. The summary should include the original text and the corrected text for each identified error.

Make sure that the outputted JSON is parseable.

If the extracted text contains no errors, then the correctedText should be the same as the extracted text, and correctionsSummary should be an empty array.
`,
});

const correctAndSummarizeTextFlow = ai.defineFlow(
  {
    name: 'correctAndSummarizeTextFlow',
    inputSchema: CorrectAndSummarizeTextInputSchema,
    outputSchema: CorrectAndSummarizeTextOutputSchema,
  },
  async input => {
    const {output} = await correctAndSummarizeTextPrompt(input);
    return output!;
  }
);
