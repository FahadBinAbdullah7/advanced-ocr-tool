"use server";

import {
  correctAndSummarizeText,
  type CorrectAndSummarizeTextOutput,
} from "@/ai/flows/correct-and-summarize-text";
import { enhanceAndRedrawImage } from "@/ai/flows/enhance-and-redraw-image";

export async function performOcrCorrection(
  text: string
): Promise<CorrectAndSummarizeTextOutput> {
  if (!text) {
    throw new Error("Input text cannot be empty.");
  }
  try {
    const result = await correctAndSummarizeText({ extractedText: text });
    return result;
  } catch (error) {
    console.error("Error in performOcrCorrection:", error);
    throw new Error("Failed to correct text with AI.");
  }
}

export async function convertImageToBase64(imageUrl: string): Promise<string> {
  if (!imageUrl) {
    throw new Error("Image URL cannot be empty.");
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUrlPromise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read image as data URI.'));
        }
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);
    return await dataUrlPromise;
  } catch (error) {
    console.error("Error in convertImageToBase64:", error);
    throw new Error("Failed to convert image to Base64.");
  }
}
