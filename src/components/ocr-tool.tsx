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
  ArrowRight,
  Paintbrush,
  ScanSearch,
  X,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { enhanceAndRedrawImage } from "@/ai/flows/enhance-and-redraw-image"
import { Switch } from "@/components/ui/switch"

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
  enhancedImageUrl?: string
  base64?: string
  isProcessing?: boolean
  description?: string
  colorize?: boolean
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

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OcrTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pageInput, setPageInput] = useState("1")
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["eng"])
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
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
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [startCoords, setStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [originalCanvasData, setOriginalCanvasData] = useState<ImageData | null>(null);

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
  
  const saveOriginalCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        setOriginalCanvasData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    }
  };


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
      saveOriginalCanvas();
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

      const img = new window.Image()
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
            saveOriginalCanvas();
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
      saveOriginalCanvas();
    } catch (error) {
      console.error("Error rendering page:", error)
      setFileError(`Failed to render page ${pageNumber}`)
    }
  }
  
    const redrawCanvasWithSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalCanvasData) return;

    // Restore original image
    ctx.putImageData(originalCanvasData, 0, 0);

    // Draw selection rectangle
    if (cropRect && isSelectingArea) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    }
  }, [originalCanvasData, cropRect, isSelectingArea]);

  useEffect(() => {
    redrawCanvasWithSelection();
  }, [cropRect, isSelectingArea, redrawCanvasWithSelection]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setStartCoords({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
    setIsCropping(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !startCoords || !isSelectingArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    const x = Math.min(startCoords.x, currentX);
    const y = Math.min(startCoords.y, currentY);
    const width = Math.abs(currentX - startCoords.x);
    const height = Math.abs(currentY - startCoords.y);
    
    setCropRect({ x, y, width, height });
  };

  const handleCanvasMouseUp = () => {
    setIsCropping(false);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !cropRect || cropRect.width === 0 || cropRect.height === 0) return;

    const croppedImageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    
    canvas.width = cropRect.width;
    canvas.height = cropRect.height;
    ctx.putImageData(croppedImageData, 0, 0);
    
    setIsSelectingArea(false);
    setCropRect(null);
    saveOriginalCanvas(); // Save the new cropped state as the original
  };

  const cancelSelection = () => {
    setIsSelectingArea(false);
    setCropRect(null);
    if (originalCanvasData) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            canvas.width = originalCanvasData.width;
            canvas.height = originalCanvasData.height;
            ctx.putImageData(originalCanvasData, 0, 0);
        }
    }
  };

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
    return canvas.toDataURL("image/png", 1.0)
  }

  // Detect non-text visual elements in the canvas using AI
  const detectImages = async (canvas: HTMLCanvasElement): Promise<DetectedImage[]> => {
    try {
      setImageStatus("Analyzing for non-text visual elements...")
      setImageProgress(20)

      const imageBase64 = canvasToBase64(canvas).split(",")[1];

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
                    colorize: false,
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

  // Handle image processing actions
  const handleImageAction = async (detectedImage: DetectedImage, action: "enhance" | "base64") => {
    if (!currentExtraction) return;
  
    try {
      const updatedImage = { ...detectedImage, isProcessing: true };
  
      // Update the current extraction with processing state
      const updateDetectedImages = (images: DetectedImage[], updated: DetectedImage) => 
        images.map((img) => (img.id === updated.id ? updated : img));
  
      setCurrentExtraction(prev => ({
        ...prev!,
        detectedImages: updateDetectedImages(prev!.detectedImages!, updatedImage),
      }));
  
      switch (action) {
        case "enhance":
          const dataUri = canvasToBase64(detectedImage.canvas);
          const result = await enhanceAndRedrawImage({ photoDataUri: dataUri, colorize: detectedImage.colorize || false });
          updatedImage.enhancedImageUrl = result.redrawnImage;
          break;
        case "base64":
          const base64 = canvasToBase64(detectedImage.canvas);
          updatedImage.base64 = base64;
          break;
      }
  
      updatedImage.isProcessing = false;
  
      // Update the extraction with the processed image
      setCurrentExtraction(prev => ({
        ...prev!,
        detectedImages: updateDetectedImages(prev!.detectedImages!, updatedImage),
      }));
  
    } catch (error) {
      console.error(`Error in ${action} action:`, error);
      // Reset processing state on error
      const resetImage = { ...detectedImage, isProcessing: false };
      setCurrentExtraction(prev => ({
        ...prev!,
        detectedImages: prev!.detectedImages!.map((img) => (img.id === detectedImage.id ? resetImage : img)),
      }));
    }
  };

  const handleColorizeToggle = (id: string, checked: boolean) => {
    if (!currentExtraction) return;
  
    const updatedImages = currentExtraction.detectedImages?.map(img => 
      img.id === id ? { ...img, colorize: checked } : img
    );
  
    setCurrentExtraction({
      ...currentExtraction,
      detectedImages: updatedImages,
    });
  };

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

        const imageBase64 = canvasToBase64(canvas).split(",")[1];
        
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
    let extractedText =
