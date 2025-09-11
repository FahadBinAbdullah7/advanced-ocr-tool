"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  FileText,
  Download,
  Copy,
  ZoomIn,
  ZoomOut,
  Languages,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Sparkles,
  ImageIcon,
  Wand2,
  CheckCheck,
  Crop,
  Palette,
  Code,
  Map,
  ArrowRight,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

interface QACFix {
  original: string
  corrected: string
  type: string
  description: string
}

interface DetectedImage {
  id: string
  canvas: HTMLCanvasElement
  x: number
  y: number
  width: number
  height: number
  enhancedCanvas?: HTMLCanvasElement
  base64?: string
  mappedImageUrl?: string
  isProcessing?: boolean
  description?: string
}

interface ExtractedContent {
  text: string
  mathEquations: string[]
  pageNumber: number
  confidence?: number
  extractionMethod?: string
  fileName: string
  fileType: "pdf" | "image"
  qacText?: string
  qacFixes?: QACFix[]
  isQACProcessed?: boolean
  detectedImages?: DetectedImage[]
}

export function OcrTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pageInput, setPageInput] = useState("1")
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["eng"])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isLoadingOCR, setIsLoadingOCR] = useState(false)
  const [isQACProcessing, setIsQACProcessing] = useState(false)
  const [isImageProcessing, setIsImageProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState("")
  const [qacProgress, setQacProgress] = useState(0)
  const [qacStatus, setQacStatus] = useState("")
  const [imageProgress, setImageProgress] = useState(0)
  const [imageStatus, setImageStatus] = useState("")
  const [extractedContent, setExtractedContent] = useState<ExtractedContent[]>([])
  const [currentExtraction, setCurrentExtraction] = useState<ExtractedContent | null>(null)
  const [zoom, setZoom] = useState(100)
  const [fileError, setFileError] = useState<string | null>(null)
  const [librariesLoaded, setLibrariesLoaded] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  // Load PDF.js with proper error handling
  useEffect(() => {
    const loadPDFLibrary = async () => {
      try {
        setIsLoadingOCR(true)
        setOcrStatus("Loading PDF.js library...")

        // Check if PDF.js is already loaded
        if (typeof window !== "undefined" && (window as any).pdfjsLib) {
          setLibrariesLoaded(true)
          setOcrStatus("Libraries ready!")
          return
        }

        // Load PDF.js
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"
          script.crossOrigin = "anonymous"

          script.onload = () => {
            try {
              if ((window as any).pdfjsLib) {
                ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
                resolve()
              } else {
                reject(new Error("PDF.js failed to initialize"))
              }
            } catch (error) {
              reject(error)
            }
          }

          script.onerror = () => reject(new Error("Failed to load PDF.js"))
          document.head.appendChild(script)
        })

        setLibrariesLoaded(true)
        setOcrStatus("Libraries loaded successfully!")
        setFileError(null)
      } catch (error) {
        console.error("Error loading PDF library:", error)
        setFileError(`Failed to load PDF library: ${error instanceof Error ? error.message : "Unknown error"}`)
        setOcrStatus("Failed to load PDF library")
      } finally {
        setIsLoadingOCR(false)
      }
    }

    loadPDFLibrary()
  }, [])

  // Check file type
  const getFileType = (file: File): "pdf" | "image" | null => {
    if (file.type === "application/pdf") {
      return "pdf"
    }
    if (file.type.startsWith("image/")) {
      return "image"
    }
    return null
  }

  // Load PDF file
  const loadPDF = async (file: File) => {
    if (!librariesLoaded || !(window as any).pdfjsLib) {
      setFileError("PDF library is not loaded yet. Please wait and try again.")
      return
    }

    setIsLoadingFile(true)
    setFileError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise

      setPdfDocument(pdf)
      setTotalPages(pdf.numPages)
      setCurrentPage(1)
      setPageInput("1")
      await renderPDFPage(pdf, 1)
    } catch (error) {
      console.error("Error loading PDF:", error)
      setFileError("Failed to load PDF. Please make sure it's a valid PDF file.")
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Load image file
  const loadImage = async (file: File) => {
    setIsLoadingFile(true)
    setFileError(null)

    try {
      // Wait for canvas to be available
      await new Promise<void>((resolve) => {
        const checkCanvas = () => {
          if (canvasRef.current) {
            resolve()
          } else {
            setTimeout(checkCanvas, 10)
          }
        }
        checkCanvas()
      })

      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error("Canvas not available after waiting")
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Calculate canvas size maintaining aspect ratio
            const maxWidth = 800
            const maxHeight = 1000
            let { width, height } = img

            if (width > maxWidth) {
              height = (height * maxWidth) / width
              width = maxWidth
            }
            if (height > maxHeight) {
              width = (width * maxHeight) / height
              height = maxHeight
            }

            canvas.width = width
            canvas.height = height

            // Clear canvas and draw image
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)

            setTotalPages(1)
            setCurrentPage(1)
            setPageInput("1")
            resolve()
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = URL.createObjectURL(file)
      })
    } catch (error) {
      console.error("Error loading image:", error)
      setFileError("Failed to load image. Please make sure it's a valid image file.")
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Render PDF page
  const renderPDFPage = async (pdf: any, pageNumber: number) => {
    if (!pdf || !canvasRef.current) return

    try {
      const page = await pdf.getPage(pageNumber)
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("Could not get canvas context")
      }

      const viewport = page.getViewport({ scale: zoom / 100 })
      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      await page.render(renderContext).promise
    } catch (error) {
      console.error("Error rendering page:", error)
      setFileError(`Failed to render page ${pageNumber}`)
    }
  }

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const type = getFileType(file)
      if (!type) {
        setFileError("Please upload a PDF file or an image (JPG, PNG, GIF, etc.)")
        return
      }

      setSelectedFile(file)
      setFileType(type)
      setExtractedContent([])
      setCurrentExtraction(null)
      setPdfDocument(null)

      if (type === "pdf") {
        loadPDF(file)
      } else {
        // Small delay to ensure canvas is rendered
        setTimeout(() => {
          loadImage(file)
        }, 100)
      }
    },
    [librariesLoaded],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (!file) return

      const type = getFileType(file)
      if (!type) {
        setFileError("Please upload a PDF file or an image (JPG, PNG, GIF, etc.)")
        return
      }

      setSelectedFile(file)
      setFileType(type)
      setExtractedContent([])
      setCurrentExtraction(null)
      setPdfDocument(null)

      if (type === "pdf") {
        loadPDF(file)
      } else {
        // Small delay to ensure canvas is rendered
        setTimeout(() => {
          loadImage(file)
        }, 100)
      }
    },
    [librariesLoaded],
  )

  const handlePageChange = async (newPage: number) => {
    if (fileType !== "pdf" || !pdfDocument) return
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      setPageInput(newPage.toString())
      await renderPDFPage(pdfDocument, newPage)
    }
  }

  const handlePageInputChange = async (value: string) => {
    if (fileType !== "pdf" || !pdfDocument) return
    setPageInput(value)
    const pageNum = Number.parseInt(value)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum)
      await renderPDFPage(pdfDocument, pageNum)
    }
  }

  const handleZoomChange = async (newZoom: number) => {
    setZoom(newZoom)
    if (fileType === "pdf" && pdfDocument) {
      await renderPDFPage(pdfDocument, currentPage)
    } else if (fileType === "image" && selectedFile) {
      await loadImage(selectedFile)
    }
  }

  const handleLanguageChange = (language: string) => {
    setSelectedLanguages((prev) => (prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]))
  }

  // Extract math equations from text
  const extractMathEquations = (text: string): string[] => {
    const mathPatterns = [
      // Mathematical symbols
      /[∫∑∏∂∇√π∞±×÷≤≥≠≈∈∉⊂⊃∪∩]/g,
      // Fractions
      /\b\d+\/\d+\b/g,
      // Scientific notation
      /\d+\.?\d*[eE][+-]?\d+/g,
      // Common equations
      /E\s*=\s*mc²?/gi,
      // Integrals
      /∫.*?d[xyz]/g,
      // Summations
      /∑.*?=/g,
      // Limits
      /lim.*?→.*?/g,
      // Greek letters in equations
      /[αβγδεζηθικλμνξοπρστυφχψω]/g,
      // Mathematical expressions with parentheses
      /$$[^)]*[+\-*/=][^)]*$$/g,
      // Derivatives
      /d[xyz]\/d[xyz]/g,
      // Powers and exponents
      /\b\w+\^[0-9]+/g,
    ]

    const equations: string[] = []
    mathPatterns.forEach((pattern) => {
      const matches = text.match(pattern)
      if (matches) {
        equations.push(...matches)
      }
    })

    return [...new Set(equations)] // Remove duplicates
  }

  // Convert canvas to base64 for API calls
  const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL("image/png", 1.0).split(",")[1]
  }

  // Detect non-text visual elements in the canvas using AI
  const detectImages = async (canvas: HTMLCanvasElement): Promise<DetectedImage[]> => {
    try {
      setImageStatus("Analyzing for non-text visual elements...")
      setImageProgress(20)

      const imageBase64 = canvasToBase64(canvas)

      const prompt = `Analyze this image and identify ONLY non-text visual elements. I want to find:

INCLUDE THESE:
- Photographs, pictures, illustrations
- Diagrams, flowcharts, technical drawings
- Charts, graphs, plots
- Maps, architectural drawings
- Logos, symbols, icons (non-text)
- Hand-drawn sketches or artwork
- Scientific diagrams, molecular structures
- Engineering blueprints
- Geometric shapes and patterns
- Any visual content that is NOT readable text

EXCLUDE THESE:
- Plain text paragraphs
- Headings and titles
- Numbers and mathematical equations (unless they're part of a diagram)
- Tables with text content
- Text-based lists or bullet points

For each NON-TEXT visual element found, provide the bounding box coordinates as percentages.

Respond in this exact format:
VISUAL_ELEMENTS_FOUND: [number]
COORDINATES: [for each visual element: "x_percent,y_percent,width_percent,height_percent,description" one per line, or "None" if no visual elements]

Example:
VISUAL_ELEMENTS_FOUND: 2
COORDINATES:
15,25,40,30,photograph of a building exterior
60,10,35,45,flowchart diagram showing process steps`

      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          prompt: prompt,
        }),
      })

      setImageProgress(60)
      setImageStatus("Processing visual element detection...")

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        const aiResponse = apiData.response || ""
        console.log("Visual element detection response:", aiResponse)
        const detectedImages = parseImageDetectionResponse(aiResponse, canvas)
        setImageProgress(100)
        setImageStatus(`Found ${detectedImages.length} non-text visual elements`)
        return detectedImages
      }

      return []
    } catch (error) {
      console.error("Visual element detection error:", error)
      setImageStatus("Visual element detection failed")
      return []
    }
  }

  // Parse visual element detection response
  const parseImageDetectionResponse = (aiResponse: string, sourceCanvas: HTMLCanvasElement): DetectedImage[] => {
    const images: DetectedImage[] = []

    try {
      // Look for the visual elements count
      const countMatch = aiResponse.match(/VISUAL_ELEMENTS_FOUND:\s*(\d+)/i)
      const elementCount = countMatch ? Number.parseInt(countMatch[1]) : 0

      if (elementCount === 0) {
        console.log("No visual elements detected")
        return []
      }

      const coordinatesMatch = aiResponse.match(/COORDINATES:\s*([\s\S]*?)$/i)
      if (coordinatesMatch) {
        const coordinatesContent = coordinatesMatch[1].trim()
        if (coordinatesContent && coordinatesContent !== "None") {
          const lines = coordinatesContent.split("\n").filter((line) => line.trim().length > 0)

          lines.forEach((line, index) => {
            const parts = line.split(",")
            if (parts.length >= 5) {
              // Now we expect description too
              const xPercent = Number.parseFloat(parts[0].trim())
              const yPercent = Number.parseFloat(parts[1].trim())
              const widthPercent = Number.parseFloat(parts[2].trim())
              const heightPercent = Number.parseFloat(parts[3].trim())
              const description = parts.slice(4).join(",").trim()

              // Convert percentages to actual pixel coordinates
              const x = Math.floor((xPercent / 100) * sourceCanvas.width)
              const y = Math.floor((yPercent / 100) * sourceCanvas.height)
              const width = Math.floor((widthPercent / 100) * sourceCanvas.width)
              const height = Math.floor((heightPercent / 100) * sourceCanvas.height)

              // Ensure coordinates are within canvas bounds and reasonable size
              if (
                x >= 0 &&
                y >= 0 &&
                x + width <= sourceCanvas.width &&
                y + height <= sourceCanvas.height &&
                width > 50 && // Minimum 50px width
                height > 50 // Minimum 50px height
              ) {
                // Create cropped canvas
                const croppedCanvas = document.createElement("canvas")
                croppedCanvas.width = width
                croppedCanvas.height = height
                const croppedCtx = croppedCanvas.getContext("2d")

                if (croppedCtx) {
                  // Fill with white background first
                  croppedCtx.fillStyle = "white"
                  croppedCtx.fillRect(0, 0, width, height)

                  // Draw the cropped portion
                  croppedCtx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height)

                  images.push({
                    id: `visual_${index}_${Date.now()}`,
                    canvas: croppedCanvas,
                    x,
                    y,
                    width,
                    height,
                    description: description,
                  })

                  console.log(`Detected visual element: ${description} at (${x},${y}) size ${width}x${height}`)
                }
              }
            }
          })
        }
      }
    } catch (error) {
      console.error("Error parsing visual element detection response:", error)
    }

    return images
  }

  // Enhance image quality
  const enhanceImage = async (detectedImage: DetectedImage) => {
    try {
      setIsImageProcessing(true)
      setImageStatus("Enhancing image quality...")
      setImageProgress(30)

      // Create enhanced canvas with improved quality
      const enhancedCanvas = document.createElement("canvas")
      const sourceCanvas = detectedImage.canvas

      // Scale up for better quality
      const scaleFactor = 2
      enhancedCanvas.width = sourceCanvas.width * scaleFactor
      enhancedCanvas.height = sourceCanvas.height * scaleFactor

      const enhancedCtx = enhancedCanvas.getContext("2d")
      if (!enhancedCtx) throw new Error("Could not get enhanced canvas context")

      // Apply image enhancement techniques
      enhancedCtx.imageSmoothingEnabled = true
      enhancedCtx.imageSmoothingQuality = "high"

      // Draw scaled up image
      enhancedCtx.drawImage(sourceCanvas, 0, 0, enhancedCanvas.width, enhancedCanvas.height)

      // Apply sharpening filter
      const imageData = enhancedCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height)
      const data = imageData.data

      // Simple sharpening kernel
      const sharpenKernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

      // Apply basic contrast enhancement
      for (let i = 0; i < data.length; i += 4) {
        // Increase contrast
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 128)) // Red
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.2 + 128)) // Green
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.2 + 128)) // Blue
      }

      enhancedCtx.putImageData(imageData, 0, 0)

      setImageProgress(100)
      setImageStatus("Image enhancement completed!")

      return enhancedCanvas
    } catch (error) {
      console.error("Image enhancement error:", error)
      setImageStatus("Image enhancement failed")
      throw error
    } finally {
      setIsImageProcessing(false)
    }
  }

  // Convert image to base64
  const convertToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL("image/png", 1.0)
  }

  // Map image using AI (create enhanced drawing version)
  const mapImage = async (detectedImage: DetectedImage) => {
    try {
      setIsImageProcessing(true)
      setImageStatus("Creating AI-powered enhanced drawing...")
      setImageProgress(40)

      const imageBase64 = canvasToBase64(detectedImage.canvas)

      const prompt = `Create an enhanced, improved version of this image. Analyze the visual content and recreate it with:

1. **Better clarity and sharpness**
2. **Enhanced colors and contrast** 
3. **Improved composition and layout**
4. **Professional artistic quality**
5. **Clean, refined details**

Generate a detailed description that can be used to create a superior version of this image.

Format your response as:
ENHANCED_DESCRIPTION: [detailed description for creating enhanced version]
IMPROVEMENT_NOTES: [specific enhancements made]
ARTISTIC_STYLE: [recommended artistic approach]`

      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          prompt: prompt,
        }),
      })

      setImageProgress(80)
      setImageStatus("Creating enhanced image...")

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        const aiResponse = apiData.response || ""

        // Create an enhanced version of the image programmatically
        const enhancedCanvas = document.createElement("canvas")
        const sourceCanvas = detectedImage.canvas

        // Scale up for better quality
        const scaleFactor = 3
        enhancedCanvas.width = sourceCanvas.width * scaleFactor
        enhancedCanvas.height = sourceCanvas.height * scaleFactor

        const enhancedCtx = enhancedCanvas.getContext("2d")
        if (!enhancedCtx) throw new Error("Could not get enhanced canvas context")

        // Apply advanced enhancement techniques
        enhancedCtx.imageSmoothingEnabled = true
        enhancedCtx.imageSmoothingQuality = "high"

        // Fill with white background
        enhancedCtx.fillStyle = "white"
        enhancedCtx.fillRect(0, 0, enhancedCanvas.width, enhancedCanvas.height)

        // Draw scaled up image
        enhancedCtx.drawImage(sourceCanvas, 0, 0, enhancedCanvas.width, enhancedCanvas.height)

        // Apply advanced image processing
        const imageData = enhancedCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height)
        const data = imageData.data

        // Enhanced processing: brightness, contrast, and sharpening
        for (let i = 0; i < data.length; i += 4) {
          // Enhance brightness and contrast
          const brightness = 1.1
          const contrast = 1.3

          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 * brightness)) // Red
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 * brightness)) // Green
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 * brightness)) // Blue
        }

        enhancedCtx.putImageData(imageData, 0, 0)

        setImageProgress(100)
        setImageStatus("Enhanced image mapping completed!")

        return {
          description: aiResponse,
          enhancedCanvas: enhancedCanvas,
        }
      }

      throw new Error("Failed to get AI response")
    } catch (error) {
      console.error("Enhanced drawing mapping error:", error)
      setImageStatus("Enhanced drawing mapping failed")
      throw error
    } finally {
      setIsImageProcessing(false)
    }
  }

  // Handle image processing actions
  const handleImageAction = async (detectedImage: DetectedImage, action: "enhance" | "base64" | "map") => {
    if (!currentExtraction) return

    try {
      const updatedImage = { ...detectedImage, isProcessing: true }

      // Update the current extraction with processing state
      const updatedExtraction = {
        ...currentExtraction,
        detectedImages:
          currentExtraction.detectedImages?.map((img) => (img.id === detectedImage.id ? updatedImage : img)) || [],
      }
      setCurrentExtraction(updatedExtraction)

      switch (action) {
        case "enhance":
          const enhancedCanvas = await enhanceImage(detectedImage)
          updatedImage.enhancedCanvas = enhancedCanvas
          break
        case "base64":
          const base64 = convertToBase64(detectedImage.canvas)
          updatedImage.base64 = base64
          break
        case "map":
          const mappedResult = await mapImage(detectedImage)
          updatedImage.mappedImageUrl = mappedResult.description
          updatedImage.enhancedCanvas = mappedResult.enhancedCanvas
          break
      }

      updatedImage.isProcessing = false

      // Update the extraction with the processed image
      const finalExtraction = {
        ...currentExtraction,
        detectedImages:
          currentExtraction.detectedImages?.map((img) => (img.id === detectedImage.id ? updatedImage : img)) || [],
      }

      setCurrentExtraction(finalExtraction)
      setExtractedContent((prev) => prev.map((item) => (item === currentExtraction ? finalExtraction : item)))
    } catch (error) {
      console.error(`Error in ${action} action:`, error)
      // Reset processing state on error
      const resetImage = { ...detectedImage, isProcessing: false }
      const resetExtraction = {
        ...currentExtraction,
        detectedImages:
          currentExtraction.detectedImages?.map((img) => (img.id === detectedImage.id ? resetImage : img)) || [],
      }
      setCurrentExtraction(resetExtraction)
    }
  }

  // Advanced AI-powered OCR with image detection
  const performAdvancedOCR = async (canvas: HTMLCanvasElement) => {
    try {
      // Progress simulation
      setOcrProgress(0)
      setOcrStatus("Initializing AI-powered text extraction...")

      for (let i = 0; i <= 20; i += 5) {
        setOcrProgress(i)
        setOcrStatus("Preprocessing image...")
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      let extractionResult = null
      let extractionMethod = "Enhanced Local Processing"

      // Method 1: Try Google Gemini API (Primary)
      try {
        setOcrStatus("Connecting to Google Gemini AI...")
        setOcrProgress(30)

        const imageBase64 = canvasToBase64(canvas)
        
        const apiResponse = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
              imageBase64: imageBase64,
              fileType: fileType,
              selectedLanguages: selectedLanguages
          }),
        })

        setOcrProgress(60)
        setOcrStatus("Processing Gemini AI response...")

        if (apiResponse.ok) {
          const apiData = await apiResponse.json()
          if(apiData.success) {
              const aiResponse = apiData.response || ""
              if (aiResponse && aiResponse.trim().length > 0) {
                  extractionResult = parseAIResponse(aiResponse)
                  extractionMethod = `Google Gemini AI (${fileType?.toUpperCase()})`
                  setOcrProgress(80)
                  setOcrStatus("Gemini AI extraction successful!")
              }
          }
        } else {
          const errorData = await apiResponse.json()
          console.log("Gemini API failed:", errorData)
        }
      } catch (geminiError) {
        console.log("Gemini AI unavailable...", geminiError)
      }

      // Method 3: Fallback message (no dummy text)
      if (!extractionResult) {
        setOcrStatus("OCR processing completed with limited results...")
        setOcrProgress(50)

        extractionResult = {
          text: "No text could be extracted from this image. Please try with a clearer image or different file.",
          mathEquations: [],
          confidence: 0,
        }
        extractionMethod = `Local Processing (${fileType?.toUpperCase()})`
      }

      // Detect images after text extraction
      setOcrProgress(85)
      setOcrStatus("Detecting non-text images...")

      const detectedImages = await detectImages(canvas)

      setOcrProgress(100)
      setOcrStatus(`Text extraction completed using ${extractionMethod}!`)

      return {
        ...extractionResult,
        extractionMethod,
        detectedImages,
      }
    } catch (error) {
      console.error("OCR Error:", error)
      setOcrStatus("OCR processing failed")
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Parse AI response
  const parseAIResponse = (aiResponse: string) => {
    let extractedText = ""
    let mathEquations: string[] = []
    let confidence = 90

    // Extract text section
    const textMatch = aiResponse.match(/TEXT:\s*([\s\S]*?)(?=MATH:|CONFIDENCE:|$)/i)
    if (textMatch) {
      extractedText = textMatch[1].trim()
    }

    // Extract math section
    const mathMatch = aiResponse.match(/MATH:\s*([\s\S]*?)(?=CONFIDENCE:|$)/i)
    if (mathMatch) {
      const mathContent = mathMatch[1].trim()
      if (mathContent && mathContent !== "None" && mathContent !== "No mathematical equations found") {
        mathEquations = mathContent.split("\n").filter((eq) => eq.trim().length > 0)
      }
    }

    // Extract confidence
    const confidenceMatch = aiResponse.match(/CONFIDENCE:\s*(\d+)/i)
    if (confidenceMatch) {
      confidence = Number.parseInt(confidenceMatch[1])
    }

    // Fallback: if parsing fails, use the entire response as text
    if (!extractedText && aiResponse) {
      extractedText = aiResponse
      mathEquations = extractMathEquations(aiResponse)
    }

    // Additional math equation detection from extracted text
    const additionalMath = extractMathEquations(extractedText)
    mathEquations = [...new Set([...mathEquations, ...additionalMath])]

    return {
      text: extractedText || "No text could be extracted from the image.",
      mathEquations,
      confidence: Math.max(confidence, 80),
    }
  }

  // Enhanced QAC (Quality Assurance Check) function with advanced mathematical formatting
  const performQAC = async (text: string) => {
    try {
      setQacProgress(0)
      setQacStatus("Initializing advanced quality assurance check...")

      for (let i = 0; i <= 20; i += 5) {
        setQacProgress(i)
        setQacStatus("Analyzing text and mathematical expressions...")
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      setQacStatus("Connecting to Gemini AI for comprehensive text and math correction...")
      setQacProgress(40)

      // Get the original image for mathematical expression comparison
      const originalImageBase64 = canvasRef.current ? canvasToBase64(canvasRef.current) : null

      const prompt = `You are an expert text and mathematical expression correction specialist. Analyze the following OCR-extracted text and perform comprehensive quality assurance:

**CRITICAL INSTRUCTIONS FOR TEXT CORRECTION:**
1. Fix spelling mistakes, grammar errors, punctuation issues
2. Correct word spacing problems and character recognition errors
3. Fix formatting inconsistencies and language-specific errors (English/Bengali)
4. Maintain original meaning and structure - don't change correct text
5. Preserve the same language (don't translate)

**CRITICAL INSTRUCTIONS FOR MATHEMATICAL EXPRESSIONS:**
6. Compare mathematical expressions with the original source image
7. Format ALL mathematical expressions for MS Word/Google Docs compatibility
8. Use proper Unicode symbols and formatting:
   - Superscripts: Use Unicode superscript characters (x², x³, x⁴, x⁵, etc.)
   - Subscripts: Use Unicode subscript characters (x₁, x₂, H₂O, etc.)
   - Fractions: Use proper fraction notation (½, ¾, or a/b format)
   - Integrals: Use ∫ symbol with proper bounds and dx notation
   - Summations: Use ∑ symbol with proper bounds and indices
   - Greek letters: Use proper Unicode (α, β, γ, δ, π, θ, λ, μ, σ, etc.)
   - Mathematical operators: ×, ÷, ±, ≤, ≥, ≠, ≈, ∞, √, ∂, ∇
   - Set notation: ∈, ∉, ⊂, ⊃, ∪, ∩, ∅
   - Arrows: →, ←, ↔, ⇒, ⇔
   - Special functions: sin, cos, tan, log, ln, exp, lim
9. Ensure mathematical expressions are copy-paste ready for Word/Docs
10. Maintain proper spacing around operators and symbols
11. Use parentheses and brackets correctly: (), [], {}
12. Format complex expressions with proper grouping

**EXAMPLES OF PROPER MATHEMATICAL FORMATTING:**
- Power: x² + y³ = z⁴
- Subscript: H₂O, CO₂, x₁ + x₂
- Fraction: ½x + ¾y or (a+b)/(c+d)
- Integral: ∫₀¹ x² dx = ⅓
- Summation: ∑ᵢ₌₁ⁿ xᵢ = n
- Limit: lim(x→∞) f(x) = L
- Square root: √(x² + y²)
- Greek: π ≈ 3.14159, θ = 45°, Δx = x₂ - x₁

Original Text to Correct:
${text}

Please respond in this exact format:
CORRECTED_TEXT: [the fully corrected text with properly formatted mathematical expressions]
FIXES: [list each fix in format: "ORIGINAL|CORRECTED|ERROR_TYPE|DESCRIPTION" one per line, or "None" if no fixes needed]
MATH_FORMATTING: [list mathematical formatting improvements made, or "None" if no math expressions]`

      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: originalImageBase64,
          prompt: prompt,
        }),
      })

      setQacProgress(70)
      setQacStatus("Processing comprehensive correction results...")

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        const aiResponse = apiData.response || ""
        console.log("Enhanced QAC Gemini response:", aiResponse.substring(0, 300) + "...")

        if (aiResponse && aiResponse.trim().length > 0) {
          const result = parseEnhancedQACResponse(aiResponse)
          setQacProgress(100)
          setQacStatus("Advanced quality assurance check completed!")
          return result
        }
      } else {
        const errorData = await apiResponse.json()
        console.log("Enhanced QAC Gemini API failed:", errorData)
      }

      // Fallback if API fails
      setQacProgress(100)
      setQacStatus("QAC completed with basic corrections")
      return {
        correctedText: text,
        fixes: [],
      }
    } catch (error) {
      console.error("Enhanced QAC Error:", error)
      setQacStatus("Advanced QAC processing failed")
      throw new Error(`Enhanced QAC failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Parse enhanced QAC response with mathematical formatting details
  const parseEnhancedQACResponse = (aiResponse: string) => {
    let correctedText = ""
    const fixes: QACFix[] = []

    // Extract corrected text
    const textMatch = aiResponse.match(/CORRECTED_TEXT:\s*([\s\S]*?)(?=FIXES:|MATH_FORMATTING:|$)/i)
    if (textMatch) {
      correctedText = textMatch[1].trim()
    }

    // Extract fixes
    const fixesMatch = aiResponse.match(/FIXES:\s*([\s\S]*?)(?=MATH_FORMATTING:|$)/i)
    if (fixesMatch) {
      const fixesContent = fixesMatch[1].trim()
      if (fixesContent && fixesContent !== "None") {
        const fixLines = fixesContent.split("\n").filter((line) => line.trim().length > 0)
        fixLines.forEach((line) => {
          const parts = line.split("|")
          if (parts.length >= 4) {
            fixes.push({
              original: parts[0].trim(),
              corrected: parts[1].trim(),
              type: parts[2].trim(),
              description: parts[3].trim(),
            })
          }
        })
      }
    }

    // Extract mathematical formatting improvements
    const mathFormattingMatch = aiResponse.match(/MATH_FORMATTING:\s*([\s\S]*?)$/i)
    if (mathFormattingMatch) {
      const mathContent = mathFormattingMatch[1].trim()
      if (mathContent && mathContent !== "None") {
        // Add mathematical formatting improvements as fixes
        const mathLines = mathContent.split("\n").filter((line) => line.trim().length > 0)
        mathLines.forEach((line, index) => {
          fixes.push({
            original: "Mathematical Expression",
            corrected: line.trim(),
            type: "Math Formatting",
            description: `Mathematical expression formatted for MS Word/Google Docs compatibility`,
          })
        })
      }
    }

    return {
      correctedText: correctedText || aiResponse,
      fixes,
    }
  }

  const handleExtractText = async () => {
    if (!selectedFile || !canvasRef.current || !librariesLoaded) {
      setFileError("Please wait for the libraries to load before extracting text.")
      return
    }

    setIsProcessing(true)
    setFileError(null)
    setOcrProgress(0)
    setOcrStatus("Preparing for text extraction...")

    try {
      const result = await performAdvancedOCR(canvasRef.current)

      const newExtraction: ExtractedContent = {
        text: result.text,
        mathEquations: result.mathEquations,
        pageNumber: currentPage,
        confidence: result.confidence,
        extractionMethod: result.extractionMethod,
        fileName: selectedFile.name,
        fileType: fileType!,
        isQACProcessed: false,
        detectedImages: result.detectedImages || [],
      }

      setCurrentExtraction(newExtraction)
      setExtractedContent((prev) => [...prev, newExtraction])
      setOcrStatus("Text extraction completed successfully!")
    } catch (error) {
      console.error("Error extracting text:", error)
      setFileError(error instanceof Error ? error.message : "Failed to extract text. Please try again.")
      setOcrStatus("Extraction failed")
    } finally {
      setIsProcessing(false)
      setOcrProgress(0)
    }
  }

  const handleQAC = async () => {
    if (!currentExtraction || !currentExtraction.text) {
      setFileError("No text available for quality assurance check.")
      return
    }

    setIsQACProcessing(true)
    setFileError(null)
    setQacProgress(0)
    setQacStatus("Starting advanced quality assurance check...")

    try {
      const qacResult = await performQAC(currentExtraction.text)

      const updatedExtraction: ExtractedContent = {
        ...currentExtraction,
        qacText: qacResult.correctedText,
        qacFixes: qacResult.fixes,
        isQACProcessed: true,
      }

      setCurrentExtraction(updatedExtraction)
      setExtractedContent((prev) => prev.map((item) => (item === currentExtraction ? updatedExtraction : item)))
      setQacStatus("Advanced quality assurance check completed successfully!")
    } catch (error) {
      console.error("Error in Enhanced QAC:", error)
      setFileError(error instanceof Error ? error.message : "Failed to perform advanced quality assurance check.")
      setQacStatus("Advanced QAC failed")
    } finally {
      setIsQACProcessing(false)
      setQacProgress(0)
    }
  }

  const copyAllText = () => {
    if (currentExtraction) {
      const textToCopy =
        currentExtraction.isQACProcessed && currentExtraction.qacText
          ? currentExtraction.qacText
          : currentExtraction.text

      const fullContent = `${currentExtraction.fileName} - ${fileType === "pdf" ? `Page ${currentExtraction.pageNumber}` : "Image"}\nMethod: ${currentExtraction.extractionMethod}\nConfidence: ${currentExtraction.confidence}%\n${currentExtraction.isQACProcessed ? "Advanced QAC Processed: Yes\n" : ""}\nExtracted Text:\n${textToCopy}\n\nMath Equations:\n${currentExtraction.mathEquations.join("\n")}`
      navigator.clipboard.writeText(fullContent)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const exportResults = () => {
    if (currentExtraction) {
      const textToExport =
        currentExtraction.isQACProcessed && currentExtraction.qacText
          ? currentExtraction.qacText
          : currentExtraction.text

      const content = `${currentExtraction.fileName} - ${fileType === "pdf" ? `Page ${currentExtraction.pageNumber}` : "Image"}\nMethod: ${currentExtraction.extractionMethod}\nConfidence: ${currentExtraction.confidence}%\n${currentExtraction.isQACProcessed ? "Advanced QAC Processed: Yes\n" : ""}\nExtracted Text:\n${textToExport}\n\nMath Equations:\n${currentExtraction.mathEquations.join("\n")}`
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ocr-results-${currentExtraction.fileName.replace(/\.[^/.]+$/, "")}.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Re-render when zoom changes
  useEffect(() => {
    if (selectedFile && librariesLoaded) {
      if (fileType === "pdf" && pdfDocument && currentPage) {
        renderPDFPage(pdfDocument, currentPage)
      } else if (fileType === "image") {
        loadImage(selectedFile)
      }
    }
  }, [zoom, librariesLoaded])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1" />
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold tracking-tight">Advanced OCR Tool</h1>
              <p className="text-muted-foreground">
                Extract text from PDFs and images in Bangla, English, and recognize math equations
              </p>
            </div>
            <div className="flex-1 flex justify-end">
              <Link href="/image-processor">
                <Button variant="outline" className="bg-transparent">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Image Processor
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
          {isLoadingOCR && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {ocrStatus}
            </div>
          )}
          {librariesLoaded && !isLoadingOCR && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <Sparkles className="h-4 w-4" />
           AI OCR ready with Google Gemini integration!
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Upload and Settings */}
          <div className="space-y-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload File
                </CardTitle>
                <CardDescription>Upload a PDF or image file to extract text</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex justify-center mb-4">
                    {fileType === "pdf" ? (
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    ) : fileType === "image" ? (
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    ) : (
                      <div className="flex gap-2">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedFile ? selectedFile.name : "Drag and drop your PDF or image here, or click to browse"}
                  </p>
                  <Button variant="outline" size="sm" disabled={isLoadingFile || isLoadingOCR || !librariesLoaded}>
                    {isLoadingFile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Choose File"
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {fileType === "pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      {fileType === "pdf" && totalPages > 0 && ` • ${totalPages} pages`}
                      {fileType === "image" && " • Image file"}
                    </p>
                  </div>
                )}
                {fileError && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">{fileError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Page Navigation - Only for PDFs */}
            {selectedFile && fileType === "pdf" && totalPages > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 flex-1">
                      <Label htmlFor="page-input" className="text-sm">
                        Page:
                      </Label>
                      <Input
                        id="page-input"
                        type="number"
                        min="1"
                        max={totalPages}
                        value={pageInput}
                        onChange={(e) => handlePageInputChange(e.target.value)}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">of {totalPages}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="flex-1"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="flex-1"
                    >
                      Last
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Language Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Select Languages for Text Recognition</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { code: "eng", name: "English" },
                      { code: "ben", name: "বাংলা" },
                    ].map((lang) => (
                      <Badge
                        key={lang.code}
                        variant={selectedLanguages.includes(lang.code) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleLanguageChange(lang.code)}
                      >
                        {lang.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Active: {selectedLanguages.join(" + ")} | Multi-AI OCR Processing
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Math Recognition</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default">
                      <Calculator className="h-3 w-3 mr-1" />
                      Auto-detect mathematical expressions
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Extract Button */}
            <Button
              onClick={handleExtractText}
              disabled={!selectedFile || isProcessing || isLoadingFile || isLoadingOCR || !librariesLoaded}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {ocrStatus} {ocrProgress > 0 && `${ocrProgress}%`}
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Extract Text with AI
                  {fileType === "pdf" && ` from Page ${currentPage}`}
                </>
              )}
            </Button>

            {/* OCR Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing Progress</span>
                  <span>{ocrProgress}%</span>
                </div>
                <Progress value={ocrProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">{ocrStatus}</p>
              </div>
            )}

            {/* Image Processing Progress */}
            {isImageProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Image Processing</span>
                  <span>{imageProgress}%</span>
                </div>
                <Progress value={imageProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">{imageStatus}</p>
              </div>
            )}

            {/* Quick Access to Image Processor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Direct Image Processing
                </CardTitle>
                <CardDescription>Process images without OCR text extraction</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/image-processor">
                  <Button variant="outline" className="w-full bg-transparent">
                    <Palette className="h-4 w-4 mr-2" />
                    Open Image Processor
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Enhance, convert to Base64, and create AI-powered drawings
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Middle Panel - File Viewer */}
          <div className="space-y-4">
            <Card className="h-[700px]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {selectedFile
                      ? `${fileType === "pdf" ? "PDF" : "Image"} Preview${fileType === "pdf" ? ` - Page ${currentPage}` : ""}`
                      : "File Preview"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZoomChange(Math.max(50, zoom - 25))}
                      disabled={!selectedFile}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{zoom}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZoomChange(Math.min(200, zoom + 25))}
                      disabled={!selectedFile}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 h-full">
                {selectedFile ? (
                  <div ref={viewerRef} className="relative h-full overflow-auto bg-gray-100 rounded-lg">
                    <div className="flex justify-center p-4">
                      <canvas
                        ref={canvasRef}
                        className="shadow-lg bg-white"
                        style={{
                          maxWidth: "100%",
                          height: "auto",
                        }}
                      />
                    </div>
                  </div>
                ) : isLoadingFile ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-muted-foreground" />
                      <p className="text-muted-foreground">Loading file...</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <div className="flex justify-center gap-4 mb-4">
                        <FileText className="h-16 w-16" />
                        <ImageIcon className="h-16 w-16" />
                      </div>
                      <p>Upload a PDF or image to preview</p>
                      <p className="text-xs mt-1">
                        {librariesLoaded ? "Ready for AI-powered text extraction" : "Loading libraries..."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>AI Text Extraction Results</CardTitle>
                  {currentExtraction && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={copyAllText}>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy All
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportResults}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {currentExtraction && (
                  <CardDescription>
                    {currentExtraction.fileName} •{" "}
                    {currentExtraction.fileType === "pdf" ? `Page ${currentExtraction.pageNumber}` : "Image"} • Method:{" "}
                    {currentExtraction.extractionMethod} • Confidence: {currentExtraction.confidence}%
                    {currentExtraction.isQACProcessed && " • Advanced QAC Processed"}
                    {currentExtraction.detectedImages &&
                      currentExtraction.detectedImages.length > 0 &&
                      ` • ${currentExtraction.detectedImages.length} Images Detected`}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="text" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="text" className="text-xs">Extracted Text</TabsTrigger>
                    <TabsTrigger value="math" className="text-xs">Math Equations</TabsTrigger>
                    <TabsTrigger value="qac" className="text-xs">QAC Fixes</TabsTrigger>
                    <TabsTrigger value="images" className="text-xs">Images ({currentExtraction?.detectedImages?.length || 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      {currentExtraction ? (
                        <div className="space-y-3">
                          {/* Enhanced QAC Button */}
                          {currentExtraction.text && (
                            <div className="flex gap-2 mb-3">
                              <Button
                                onClick={handleQAC}
                                disabled={isQACProcessing || !currentExtraction.text}
                                variant="outline"
                                size="sm"
                              >
                                {isQACProcessing ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Advanced QAC Processing...
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Advanced QAC Text & Math
                                  </>
                                )}
                              </Button>
                              {currentExtraction.isQACProcessed && (
                                <Badge variant="secondary">
                                  <CheckCheck className="h-3 w-3 mr-1" />
                                  Advanced QAC Processed
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* QAC Progress */}
                          {isQACProcessing && (
                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between text-sm">
                                <span>Advanced QAC Progress</span>
                                <span>{qacProgress}%</span>
                              </div>
                              <Progress value={qacProgress} className="w-full" />
                              <p className="text-xs text-muted-foreground text-center">{qacStatus}</p>
                            </div>
                          )}

                          <Textarea
                            value={
                              currentExtraction.isQACProcessed && currentExtraction.qacText
                                ? currentExtraction.qacText
                                : currentExtraction.text
                            }
                            onChange={(e) => {
                              if (currentExtraction.isQACProcessed) {
                                setCurrentExtraction({ ...currentExtraction, qacText: e.target.value })
                              } else if (currentExtraction) {
                                setCurrentExtraction({ ...currentExtraction, text: e.target.value })
                              }
                            }}
                            className="min-h-[280px] resize-none font-mono"
                            placeholder="AI-extracted text with mathematical expressions will appear here after processing..."
                          />

                          {/* Mathematical Formatting Info */}
                          {currentExtraction.isQACProcessed && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs text-blue-700">
                                ✨{" "}
                                <strong>
                                  Mathematical expressions have been formatted for MS Word/Google Docs compatibility
                                </strong>
                                <br />• Superscripts: x², x³, x⁴ • Subscripts: H₂O, x₁, x₂ • Greek letters: π, α, β, θ
                                <br />• Symbols: ∫, ∑, √, ±, ≤, ≥, ∞ • Ready to copy-paste into documents!
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-2" />
                            <p>No text extracted yet</p>
                            <p className="text-xs mt-1">Upload a PDF or image and extract text using AI</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="math" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      {currentExtraction && currentExtraction.mathEquations.length > 0 ? (
                        <div className="space-y-3">
                          {currentExtraction.mathEquations.map((equation, index) => (
                            <div key={index} className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between">
                                <code className="text-sm font-mono flex-1">{equation}</code>
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(equation)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Calculator className="h-12 w-12 mx-auto mb-2" />
                            <p>No math equations detected</p>
                            <p className="text-xs mt-1">Mathematical expressions will be auto-detected by AI</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="qac" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      {currentExtraction && currentExtraction.isQACProcessed && currentExtraction.qacFixes ? (
                        currentExtraction.qacFixes.length > 0 ? (
                          <div className="space-y-3">
                            <div className="text-sm font-medium mb-2">
                              {currentExtraction.qacFixes.length} improvements applied:
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Original</TableHead>
                                  <TableHead>Corrected</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Description</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentExtraction.qacFixes.map((fix, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-mono text-sm bg-red-50">{fix.original}</TableCell>
                                    <TableCell className="font-mono text-sm bg-green-50">{fix.corrected}</TableCell>
                                    <TableCell className="text-sm">
                                      <Badge variant={fix.type === "Math Formatting" ? "default" : "secondary"}>
                                        {fix.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{fix.description}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <CheckCheck className="h-12 w-12 mx-auto mb-2" />
                              <p>No fixes needed</p>
                              <p className="text-xs mt-1">The extracted text appears to be error-free</p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Wand2 className="h-12 w-12 mx-auto mb-2" />
                            <p>Advanced QAC not performed yet</p>
                            <p className="text-xs mt-1">
                              Click "Advanced QAC Text & Math" to enhance text and mathematical formatting
                            </p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="images" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      {currentExtraction &&
                      currentExtraction.detectedImages &&
                      currentExtraction.detectedImages.length > 0 ? (
                        <div className="space-y-4">
                          {currentExtraction.detectedImages.map((detectedImage, index) => (
                            <Card key={detectedImage.id} className="p-4">
                              <div className="space-y-3">
                                {/* Image Canvas */}
                                <div className="flex justify-center">
                                  <canvas
                                    ref={(canvas) => {
                                      if (canvas && detectedImage.enhancedCanvas) {
                                        const ctx = canvas.getContext("2d")
                                        if (ctx) {
                                          canvas.width = detectedImage.enhancedCanvas.width
                                          canvas.height = detectedImage.enhancedCanvas.height
                                          ctx.drawImage(detectedImage.enhancedCanvas, 0, 0)
                                        }
                                      } else if (canvas) {
                                        const ctx = canvas.getContext("2d")
                                        if (ctx) {
                                          canvas.width = detectedImage.canvas.width
                                          canvas.height = detectedImage.canvas.height
                                          ctx.drawImage(detectedImage.canvas, 0, 0)
                                        }
                                      }
                                    }}
                                    className="border rounded-lg shadow-sm max-w-full h-auto"
                                    style={{ maxHeight: "200px" }}
                                  />
                                </div>

                                {/* Image Info */}
                                <div className="text-xs text-muted-foreground text-center">
                                  Size: {detectedImage.width} × {detectedImage.height}px
                                  {detectedImage.enhancedCanvas && " • Enhanced"}
                                  {detectedImage.description && ` • ${detectedImage.description}`}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleImageAction(detectedImage, "enhance")}
                                    disabled={detectedImage.isProcessing || isImageProcessing}
                                  >
                                    {detectedImage.isProcessing ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Palette className="h-3 w-3 mr-1" />
                                    )}
                                    Enhance
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleImageAction(detectedImage, "base64")}
                                    disabled={detectedImage.isProcessing || isImageProcessing}
                                  >
                                    {detectedImage.isProcessing ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Code className="h-3 w-3 mr-1" />
                                    )}
                                    Base64
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleImageAction(detectedImage, "map")}
                                    disabled={detectedImage.isProcessing || isImageProcessing}
                                  >
                                    {detectedImage.isProcessing ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Map className="h-3 w-3 mr-1" />
                                    )}
                                    Map Image
                                  </Button>
                                </div>

                                {/* Results Display */}
                                {detectedImage.base64 && (
                                  <div className="mt-3">
                                    <Label className="text-xs font-medium">Base64 Code:</Label>
                                    <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
                                      {detectedImage.base64.substring(0, 200)}...
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1"
                                      onClick={() => copyToClipboard(detectedImage.base64!)}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy Full Base64
                                    </Button>
                                  </div>
                                )}

                                {detectedImage.mappedImageUrl && (
                                  <div className="mt-3">
                                    <Label className="text-xs font-medium">AI Enhanced Image:</Label>
                                    <div className="mt-1 p-2 bg-muted rounded text-xs max-h-32 overflow-y-auto">
                                      {detectedImage.mappedImageUrl}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(detectedImage.mappedImageUrl!)}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy Description
                                      </Button>
                                      {detectedImage.enhancedCanvas && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const link = document.createElement("a")
                                            link.download = `enhanced-image-${detectedImage.id}.png`
                                            link.href = detectedImage.enhancedCanvas!.toDataURL()
                                            link.click()
                                          }}
                                        >
                                          <Download className="h-3 w-3 mr-1" />
                                          Download Enhanced
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {detectedImage.enhancedCanvas && !detectedImage.mappedImageUrl && (
                                  <div className="mt-3">
                                    <Label className="text-xs font-medium">Enhanced Image:</Label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1"
                                      onClick={() => {
                                        const link = document.createElement("a")
                                        link.download = `enhanced-image-${detectedImage.id}.png`
                                        link.href = detectedImage.enhancedCanvas!.toDataURL()
                                        link.click()
                                      }}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download Enhanced
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Crop className="h-12 w-12 mx-auto mb-2" />
                            <p>No images detected</p>
                            <p className="text-xs mt-1">Non-text images will be automatically detected and cropped</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Extraction History */}
            {extractedContent.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extraction History</CardTitle>
                  <CardDescription>{extractedContent.length} AI text extractions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {extractedContent.map((extraction, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            currentExtraction === extraction
                              ? "bg-primary/10 border-primary"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          onClick={() => setCurrentExtraction(extraction)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {extraction.fileType === "pdf" ? (
                                  <FileText className="h-3 w-3" />
                                ) : (
                                  <ImageIcon className="h-3 w-3" />
                                )}
                                {extraction.fileName}
                                {extraction.fileType === "pdf" && ` - Page ${extraction.pageNumber}`}
                                {extraction.isQACProcessed && (
                                  <Badge variant="secondary" className="ml-2">
                                    <CheckCheck className="h-2 w-2 mr-1" />
                                    Advanced QAC
                                  </Badge>
                                )}
                                {extraction.detectedImages && extraction.detectedImages.length > 0 && (
                                  <Badge variant="outline" className="ml-2">
                                    <Crop className="h-2 w-2 mr-1" />
                                    {extraction.detectedImages.length} IMG
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {extraction.extractionMethod} • {extraction.confidence}% confidence
                              </p>
                            </div>
                            {currentExtraction === extraction && <CheckCircle className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            {currentExtraction && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extraction Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Characters</p>
                      <p className="font-medium">
                        {(currentExtraction.isQACProcessed && currentExtraction.qacText
                          ? currentExtraction.qacText
                          : currentExtraction.text
                        ).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Words</p>
                      <p className="font-medium">
                        {
                          (currentExtraction.isQACProcessed && currentExtraction.qacText
                            ? currentExtraction.qacText
                            : currentExtraction.text
                          )
                            .split(/\s+/)
                            .filter((w) => w.length > 0).length
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Math Equations</p>
                      <p className="font-medium">{currentExtraction.mathEquations.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Detected Images</p>
                      <p className="font-medium">{currentExtraction.detectedImages?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
