"use server";

import {
  correctAndSummarizeText,
  type CorrectAndSummarizeTextOutput,
} from "@/ai/flows/correct-and-summarize-text";
import { enhanceAndRedrawImage } from "@/ai/flows/enhance-and-redraw-image";
import { extractTextFromImage } from "@/ai/flows/extract-text-from-image";

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

async function imageUrlToDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image as data URI."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function performImageRedraw(imageUrl: string): Promise<string> {
  if (!imageUrl) {
    throw new Error("Image URL cannot be empty.");
  }
  try {
    const dataUri = await imageUrlToDataUri(imageUrl);
    const result = await enhanceAndRedrawImage({ photoDataUri: dataUri });
    return result.redrawnImage;
  } catch (error) {
    console.error("Error in performImageRedraw:", error);
    throw new Error("Failed to redraw image with AI.");
  }
}

export async function convertImageToBase64(imageUrl: string): Promise<string> {
  if (!imageUrl) {
    throw new Error("Image URL cannot be empty.");
  }
  try {
    const dataUri = await imageUrlToDataUri(imageUrl);
    return dataUri;
  } catch (error) {
    console.error("Error in convertImageToBase64:", error);
    throw new Error("Failed to convert image to Base64.");
  }
}

export async function performOcr(dataUri: string): Promise<string> {
  if (!dataUri) {
    throw new Error("Image data URI cannot be empty.");
  }
  try {
    const result = await extractTextFromImage({ photoDataUri: dataUri });
    return result.extractedText;
  } catch (error) {
    console.error("Error in performOcr:", error);
    throw new Error("Failed to extract text from image with AI.");
  }
}
