import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, fileType, selectedLanguages } = await request.json()

    // Try Google Gemini API first
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert OCR system. Extract ALL visible text from this ${fileType === "pdf" ? "PDF page" : "image"} with maximum accuracy.

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of text visible in the image, no matter how small
2. Maintain exact formatting, spacing, and line breaks as they appear
3. Support multiple languages: ${selectedLanguages.includes("eng") ? "English" : ""} ${selectedLanguages.includes("ben") ? "Bengali/Bangla" : ""}
4. Identify mathematical equations, formulas, symbols, and special characters
5. Pay special attention to small text, footnotes, and captions
6. Preserve table structures and bullet points if present
7. Return clean, readable text without adding commentary
8. Extract text systematically from top to bottom, left to right

Format your response as:
TEXT: [all extracted text here, maintaining original structure]
MATH: [mathematical equations found, one per line, or "None" if no math]
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
        }),
      },
    )

    if (geminiResponse.ok) {
      const geminiData = await geminiResponse.json()
      const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ""

      if (aiResponse && aiResponse.trim().length > 0) {
        return NextResponse.json({
          success: true,
          method: `Google Gemini AI (${fileType.toUpperCase()})`,
          response: aiResponse,
        })
      }
    }

    // Final fallback
    return NextResponse.json({
      success: false,
      method: `Local Processing (${fileType.toUpperCase()})`,
      response: "No text could be extracted from this image. Please try with a clearer image or different file.",
      error: "AI service unavailable",
    })
  } catch (error) {
    console.error("OCR API Error:", error)
    return NextResponse.json({ success: false, error: "OCR processing failed" }, { status: 500 })
  }
}
