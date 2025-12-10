
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, fileType, prompt } = await request.json();

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt || `You are an expert OCR system. Extract ALL visible text from this ${fileType === "pdf" ? "PDF page" : "image"} with maximum accuracy.

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of text visible in the image, no matter how small
2. Maintain exact formatting, spacing, and line breaks as they appear
3. Support multiple languages: English, Bengali/Bangla
4. Identify mathematical equations, formulas, symbols, and special characters
5. **Vector Notation**: Recognize vector arrows above characters (e.g., AB, AC). Represent them by placing a combining overline character (U+0305) over EACH character in the vector to form a single continuous line (e.g., A̅B̅, A̅C̅).
6. Pay special attention to small text, footnotes, and captions
7. Preserve table structures and bullet points if present
8. Return clean, readable text without adding commentary
9. Extract text systematically from top to bottom, left to right

Format your response as:
TEXT: [all extracted text here, maintaining original structure]
CONFIDENCE: [your confidence percentage 85-98]`,
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        topP: 0.8,
        topK: 40,
      },
    };

    // Use a different generationConfig for the QAC/mapping prompts
    if (prompt) {
      requestBody.generationConfig.maxOutputTokens = 6000;
    }


    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (geminiResponse.ok) {
      const geminiData = await geminiResponse.json();
      const aiResponse =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (aiResponse && aiResponse.trim().length > 0) {
        return NextResponse.json({
          success: true,
          method: `Google Gemini AI (${fileType ? fileType.toUpperCase() : 'Image'})`,
          response: aiResponse,
        });
      }
    }

    // Final fallback
    return NextResponse.json({
      success: false,
      method: `Local Processing (${fileType ? fileType.toUpperCase() : 'Image'})`,
      response:
        "No text could be extracted from this image. Please try with a clearer image or different file.",
      error: "AI service unavailable",
    });
  } catch (error) {
    console.error("OCR API Error:", error);
    return NextResponse.json(
      { success: false, error: "OCR processing failed" },
      { status: 500 }
    );
  }
}
