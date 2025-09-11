"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  Download,
  Copy,
  Loader2,
  AlertCircle,
  ImageIcon,
  Palette,
  Code,
  Map,
  ArrowLeft,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { performImageRedraw } from "@/app/actions"
import Image from "next/image"

interface ProcessedImage {
  id: string
  originalCanvas: HTMLCanvasElement
  enhancedImageUrl?: string
  base64?: string
  mappedImageUrl?: string
  isProcessing?: boolean
  fileName: string
}

export default function ImageProcessor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
            const maxHeight = 600
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

            // Create processed image object
            const newProcessedImage: ProcessedImage = {
              id: `img_${Date.now()}`,
              originalCanvas: canvas,
              fileName: file.name,
            }

            setProcessedImage(newProcessedImage)
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

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setFileError("Please upload an image file (JPG, PNG, GIF, etc.)")
      return
    }

    setSelectedFile(file)
    setProcessedImage(null)

    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      loadImage(file)
    }, 100)
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setFileError("Please upload an image file (JPG, PNG, GIF, etc.)")
      return
    }

    setSelectedFile(file)
    setProcessedImage(null)

    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      loadImage(file)
    }, 100)
  }, [])

  // Convert canvas to base64 for API calls
  const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL("image/png", 1.0)
  }

  // Enhance image quality
  const enhanceImage = async () => {
    if (!processedImage) return

    try {
      setIsProcessing(true)
      setProcessingStatus("Submitting to AI for enhancement...")
      setProcessingProgress(30)
      
      const imageUrl = canvasToBase64(processedImage.originalCanvas)
      const redrawnImage = await performImageRedraw(imageUrl)

      setProcessingProgress(100)
      setProcessingStatus("Image enhancement completed!")

      // Update processed image
      setProcessedImage({
        ...processedImage,
        enhancedImageUrl: redrawnImage,
      })
    } catch (error) {
      console.error("Image enhancement error:", error)
      setProcessingStatus("Image enhancement failed")
      setFileError("Failed to enhance image with AI. Please try again.")
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  // Convert image to base64
  const convertToBase64 = async () => {
    if (!processedImage) return

    try {
      setIsProcessing(true)
      setProcessingStatus("Converting to Base64...")
      setProcessingProgress(50)

      const canvas = processedImage.originalCanvas
      const base64 = canvas.toDataURL("image/png", 1.0)

      setProcessingProgress(100)
      setProcessingStatus("Base64 conversion completed!")

      // Update processed image
      setProcessedImage({
        ...processedImage,
        base64: base64,
      })
    } catch (error) {
      console.error("Base64 conversion error:", error)
      setProcessingStatus("Base64 conversion failed")
      setFileError("Failed to convert to Base64. Please try again.")
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  // Map image using AI (create enhanced drawing version)
  const mapImage = async () => {
    if (!processedImage) return

    try {
      setIsProcessing(true)
      setProcessingStatus("Creating AI-powered enhanced drawing...")
      setProcessingProgress(40)

      const canvas = processedImage.originalCanvas
      const imageBase64 = canvas.toDataURL("image/png", 1.0).split(",")[1]

      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          prompt: `Create an enhanced, improved version of this image. Analyze the visual content and recreate it with:

1. **Better clarity and sharpness**
2. **Enhanced colors and contrast** 
3. **Improved composition and layout**
4. **Professional artistic quality**
5. **Clean, refined details**

Generate a detailed description that can be used to create a superior version of this image.

Format your response as:
ENHANCED_DESCRIPTION: [detailed description for creating enhanced version]
IMPROVEMENT_NOTES: [specific enhancements made]
ARTISTIC_STYLE: [recommended artistic approach]`,
        }),
      })

      setProcessingProgress(80)
      setProcessingStatus("Processing AI drawing...")

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        const aiResponse = apiData.response || ""

        setProcessingProgress(100)
        setProcessingStatus("Enhanced image mapping completed!")

        // Update processed image
        setProcessedImage({
          ...processedImage,
          mappedImageUrl: aiResponse,
        })
      } else {
        throw new Error("Failed to get AI response")
      }
    } catch (error) {
      console.error("Enhanced drawing mapping error:", error)
      setProcessingStatus("Enhanced drawing mapping failed")
      setFileError("Failed to create AI-enhanced drawing. Please try again.")
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <Link href="/">
                <Button variant="outline" className="bg-transparent">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to OCR Tool
                </Button>
              </Link>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold tracking-tight">Image Processor</h1>
              <p className="text-muted-foreground">Enhance images, convert to Base64, and create AI-powered drawings</p>
            </div>
            <div className="flex-1" />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-green-600">
            <Sparkles className="h-4 w-4" />
            Direct image processing with AI enhancement capabilities!
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Upload and Preview */}
          <div className="space-y-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Image
                </CardTitle>
                <CardDescription>Upload an image file for processing</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex justify-center mb-4">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedFile ? selectedFile.name : "Drag and drop your image here, or click to browse"}
                  </p>
                  <Button variant="outline" size="sm" disabled={isLoadingFile}>
                    {isLoadingFile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Choose Image"
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Image file
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

            {/* Image Preview */}
            <Card className="h-[500px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Image Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-full">
                {selectedFile ? (
                  <div className="relative h-full overflow-auto bg-gray-100 rounded-lg">
                    <div className="flex justify-center p-4">
                      <canvas
                        ref={canvasRef}
                        className="shadow-lg bg-white max-w-full h-auto"
                        style={{
                          maxHeight: "400px",
                        }}
                      />
                    </div>
                  </div>
                ) : isLoadingFile ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-muted-foreground" />
                      <p className="text-muted-foreground">Loading image...</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                      <p>Upload an image to preview</p>
                      <p className="text-xs mt-1">Ready for AI-powered image processing</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Actions */}
            {processedImage && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Image Processing Actions
                  </CardTitle>
                  <CardDescription>Choose an action to process your image</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      onClick={enhanceImage}
                      disabled={isProcessing}
                      variant="outline"
                      className="justify-start bg-transparent"
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Enhance Image Quality
                    </Button>
                    <Button
                      onClick={convertToBase64}
                      disabled={isProcessing}
                      variant="outline"
                      className="justify-start bg-transparent"
                    >
                      <Code className="h-4 w-4 mr-2" />
                      Convert to Base64
                    </Button>
                    <Button
                      onClick={mapImage}
                      disabled={isProcessing}
                      variant="outline"
                      className="justify-start bg-transparent"
                    >
                      <Map className="h-4 w-4 mr-2" />
                      Create AI Enhanced Drawing
                    </Button>
                  </div>

                  {/* Processing Progress */}
                  {isProcessing && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-sm">
                        <span>Processing Progress</span>
                        <span>{processingProgress}%</span>
                      </div>
                      <Progress value={processingProgress} className="w-full" />
                      <p className="text-xs text-muted-foreground text-center">{processingStatus}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Results</CardTitle>
                {processedImage && <CardDescription>{processedImage.fileName} • Ready for processing</CardDescription>}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="enhanced" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="enhanced">Enhanced Image</TabsTrigger>
                    <TabsTrigger value="base64">Base64 Code</TabsTrigger>
                    <TabsTrigger value="mapped">AI Drawing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="enhanced" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      {processedImage && processedImage.enhancedImageUrl ? (
                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <Image
                              src={processedImage.enhancedImageUrl}
                              alt="Enhanced Image"
                              width={500}
                              height={500}
                              className="border rounded-lg shadow-sm max-w-full h-auto"
                              style={{ maxHeight: "300px" }}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Button
                              onClick={() => {
                                const link = document.createElement("a")
                                link.download = `enhanced-${processedImage.fileName}`
                                link.href = processedImage.enhancedImageUrl!
                                link.click()
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Enhanced Image
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Palette className="h-12 w-12 mx-auto mb-2" />
                            <p>No enhanced image yet</p>
                            <p className="text-xs mt-1">Click "Enhance Image Quality" to process your image</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="base64" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      {processedImage && processedImage.base64 ? (
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">Base64 Encoded Image:</Label>
                          <Textarea
                            value={processedImage.base64}
                            readOnly
                            className="min-h-[300px] font-mono text-xs"
                            placeholder="Base64 code will appear here..."
                          />
                          <div className="flex gap-2">
                            <Button onClick={() => copyToClipboard(processedImage.base64!)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Base64
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const blob = new Blob([processedImage.base64!], { type: "text/plain" })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = `${processedImage.fileName.replace(/\.[^/.]+$/, "")}-base64.txt`
                                a.click()
                                URL.revokeObjectURL(url)
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download as File
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Code className="h-12 w-12 mx-auto mb-2" />
                            <p>No Base64 code yet</p>
                            <p className="text-xs mt-1">Click "Convert to Base64" to generate the code</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="mapped" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      {processedImage && processedImage.mappedImageUrl ? (
                        <div className="space-y-4">
                           <Label className="text-sm font-medium">AI Enhanced Drawing Description:</Label>
                          <Textarea
                            value={processedImage.mappedImageUrl}
                            readOnly
                            className="min-h-[200px] text-sm"
                            placeholder="AI drawing description will appear here..."
                          />
                          <div className="flex gap-2">
                            <Button onClick={() => copyToClipboard(processedImage.mappedImageUrl!)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Description
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Map className="h-12 w-12 mx-auto mb-2" />
                            <p>No AI drawing yet</p>
                            <p className="text-xs mt-1">Click "Create AI Enhanced Drawing" to generate description</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Processing Statistics */}
            {processedImage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">File Name</p>
                      <p className="font-medium">{processedImage.fileName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Original Size</p>
                      <p className="font-medium">
                        {processedImage.originalCanvas.width} × {processedImage.originalCanvas.height}px
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Enhanced</p>
                      <p className="font-medium">{processedImage.enhancedImageUrl ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Base64 Generated</p>
                      <p className="font-medium">{processedImage.base64 ? "Yes" : "No"}</p>
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
