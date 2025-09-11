"use client";

import { useState, useRef, MouseEvent } from "react";
import Image from "next/image";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import {
  Upload,
  FileText,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  ScanText,
  Languages,
  ArrowRight,
  Calculator,
  Eye,
  FileUp,
  Clipboard,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { CorrectAndSummarizeTextOutput } from "@/ai/flows/correct-and-summarize-text";
import {
  performOcrCorrection,
  performImageRedraw,
  performOcr,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OcrTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);
  const [correctionResult, setCorrectionResult] =
    useState<CorrectAndSummarizeTextOutput | null>(null);

  const [imageSrc, setImageSrc] = useState<string>("");
  const [croppedImageSrc, setCroppedImageSrc] = useState<string | null>(null);
  const [redrawnImage, setRedrawnImage] = useState<string | null>(null);
  const [isLoadingRedraw, setIsLoadingRedraw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setFileName(file.name);
      setExtractedText("");
      setCorrectionResult(null);
      setNumPages(null);
      setPageNumber(1);
      setSelection(null);
      setCroppedImageSrc(null);
      setZoom(1);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImageSrc("");
      }
      setRedrawnImage(null);
    }
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileChange({ target: { files: [file] } } as any);
    }
  };


  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const goToPrevPage = () =>
    setPageNumber(pageNumber - 1 <= 1 ? 1 : pageNumber - 1);

  const goToNextPage = () =>
    setPageNumber(
      pageNumber + 1 >= (numPages || 0) ? numPages || 1 : pageNumber + 1
    );

  const getSourceCanvas = async (): Promise<HTMLCanvasElement> => {
    const fullCanvas = document.createElement("canvas");
    const fullCtx = fullCanvas.getContext("2d");
    if (!fullCtx) throw new Error("Canvas context is not available.");

    if (isPdf && file) {
      const pdfDoc = await pdfjs.getDocument(URL.createObjectURL(file)).promise;
      const pdfPage = await pdfDoc.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 2.0 }); // Render at high quality for better OCR
      fullCanvas.width = viewport.width;
      fullCanvas.height = viewport.height;
      await pdfPage.render({ canvasContext: fullCtx, viewport }).promise;
    } else {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageSrc;
      });
      fullCanvas.width = img.naturalWidth;
      fullCanvas.height = img.naturalHeight;
      fullCtx.drawImage(img, 0, 0);
    }
    return fullCanvas;
  };

  const handleCrop = async () => {
    if (!selection || !imageContainerRef.current) return;

    try {
      const container = imageContainerRef.current;
      const fullCanvas = await getSourceCanvas();
      const naturalWidth = fullCanvas.width;
      const naturalHeight = fullCanvas.height;

      const containerRect = container.getBoundingClientRect();
      const naturalAspectRatio = naturalWidth / naturalHeight;
      const containerAspectRatio = containerRect.width / containerRect.height;

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (naturalAspectRatio > containerAspectRatio) {
        renderedWidth = containerRect.width;
        renderedHeight = renderedWidth / naturalAspectRatio;
        offsetX = 0;
        offsetY = (containerRect.height - renderedHeight) / 2;
      } else {
        renderedHeight = containerRect.height;
        renderedWidth = renderedHeight * naturalAspectRatio;
        offsetY = 0;
        offsetX = (containerRect.width - renderedWidth) / 2;
      }

      const scale = naturalWidth / renderedWidth;

      const cropX = (selection.x - offsetX) * scale;
      const cropY = (selection.y - offsetY) * scale;
      const cropWidth = selection.width * scale;
      const cropHeight = selection.height * scale;

      const finalCropX = Math.max(0, cropX);
      const finalCropY = Math.max(0, cropY);
      const finalCropWidth = Math.min(naturalWidth - finalCropX, cropWidth);
      const finalCropHeight = Math.min(naturalHeight - finalCropY, cropHeight);

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = finalCropWidth;
      croppedCanvas.height = finalCropHeight;
      const croppedCtx = croppedCanvas.getContext("2d");

      if (!croppedCtx) {
        throw new Error("Could not create cropped canvas context.");
      }

      croppedCtx.drawImage(
        fullCanvas,
        finalCropX,
        finalCropY,
        finalCropWidth,
        finalCropHeight,
        0,
        0,
        finalCropWidth,
        finalCropHeight
      );

      setCroppedImageSrc(croppedCanvas.toDataURL());
      setSelection(null);
      toast({
        title: "Area Cropped",
        description: "You can now extract text from the cropped area.",
      });
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Crop Failed",
        description: `An error occurred while cropping: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const handleExtractText = async () => {
    if (!file && !croppedImageSrc) {
      toast({
        title: "No file uploaded",
        description: "Please upload a document or image first.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      let dataUri: string | undefined;

      if (croppedImageSrc) {
        dataUri = croppedImageSrc;
      } else {
        const canvas = await getSourceCanvas();
        dataUri = canvas.toDataURL();
      }

      if (!dataUri) throw new Error("Could not generate image data for OCR.");

      const text = await performOcr(dataUri);
      setExtractedText(text);
      toast({
        title: "Text Extracted",
        description: `Successfully extracted text from the ${
          croppedImageSrc ? "cropped area" : "full page"
        }.`,
      });
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Extraction Failed",
        description: `An error occurred while extracting text: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      setSelection(null);
    }
  };

  const handleCorrectText = async () => {
    if (!extractedText) {
      toast({
        title: "No text to correct",
        description: "Please extract text from a document first.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingCorrection(true);
    setCorrectionResult(null);
    try {
      const result = await performOcrCorrection(extractedText);
      setCorrectionResult(result);
    } catch (error) {
      toast({
        title: "Correction Failed",
        description:
          "An error occurred while communicating with the AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCorrection(false);
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current || croppedImageSrc) return;
    setIsSelecting(true);
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint || !imageContainerRef.current || croppedImageSrc) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const width = Math.abs(startPoint.x - currentX);
    const height = Math.abs(startPoint.y - currentY);

    setSelection({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
  };
  
  const copyToClipboard = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPdf = file?.type === "application/pdf";
  const hasSelection = selection && selection.width > 5 && selection.height > 5;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
      {/* Left Column: Upload and Controls */}
      <div className="lg:col-span-3 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileUp className="w-5 h-5" />
              Upload File
            </CardTitle>
            <CardDescription>
              Upload a PDF or image file to extract text
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2 text-sm">
                Drag and drop your PDF or image here, or click to browse
              </p>
              <Button variant="outline" className="mt-4">Choose File</Button>
            </div>
            <Input
              id="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
             {fileName && (
              <p className="text-sm text-muted-foreground mt-4">
                Selected: <span className="font-medium">{fileName}</span>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="w-5 h-5" />
              Language Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
                <Label>Select Languages for Text Recognition</Label>
                <div className="flex gap-2 mt-2">
                    <Badge variant="default" className="cursor-pointer">English</Badge>
                    <Badge variant="outline" className="cursor-pointer">বাংলা</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active: eng | Multi-AI OCR Processing</p>
            </div>
             <div>
                <Label>Math Recognition</Label>
                 <Badge variant="secondary" className="w-full justify-start mt-2">
                    <Calculator className="w-4 h-4 mr-2" />
                    Auto-detect mathematical expressions
                </Badge>
            </div>
          </CardContent>
        </Card>
         <Button
              onClick={handleExtractText}
              disabled={!file || isExtracting}
              className="w-full text-lg py-6"
              size="lg"
            >
              {isExtracting ? <Loader2 className="animate-spin" /> : <Eye />}
              {isExtracting ? "Extracting..." : "Extract Text with AI"}
        </Button>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5" />
                Direct Image Processing
                </CardTitle>
                <CardDescription>Process images without OCR text extraction</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" className="w-full">
                    Open Image Processor <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">Enhance, convert to Base64, and create AI-powered drawings</p>
            </CardContent>
        </Card>
      </div>

      {/* Middle Column: Document View */}
      <div className="lg:col-span-5">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                File Preview
              </span>
              <div className="flex items-center gap-1">
                 {isPdf && numPages && !croppedImageSrc && (
                  <>
                    <Button onClick={goToPrevPage} disabled={pageNumber <= 1} variant="outline" size="icon">
                        <ChevronLeft />
                    </Button>
                    <span>Page {pageNumber} of {numPages}</span>
                    <Button onClick={goToNextPage} disabled={pageNumber >= numPages} variant="outline" size="icon">
                        <ChevronRight />
                    </Button>
                  </>
                )}
                <Button onClick={() => setZoom(z => z * 1.2)} variant="outline" size="icon"><ZoomIn /></Button>
                <Button onClick={() => setZoom(z => z / 1.2)} variant="outline" size="icon"><ZoomOut /></Button>
                 <Badge variant="outline">{Math.round(zoom*100)}%</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={imageContainerRef}
              className={`w-full h-full min-h-[70vh] bg-muted/30 rounded-lg flex items-center justify-center overflow-auto border relative ${
                !croppedImageSrc ? "cursor-crosshair" : ""
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {croppedImageSrc ? (
                <Image
                  src={redrawnImage || croppedImageSrc}
                  alt="Cropped content"
                  data-ai-hint="document image"
                  layout="fill"
                  objectFit="contain"
                  unoptimized={!!redrawnImage}
                />
              ) : isPdf && file ? (
                <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                  <Page pageNumber={pageNumber} renderTextLayer={false} scale={zoom} />
                </Document>
              ) : imageSrc ? (
                <div className="w-full h-full" style={{transform: `scale(${zoom})`}}>
                    <Image
                        src={redrawnImage || imageSrc}
                        alt="Uploaded content"
                        data-ai-hint="document image"
                        layout="fill"
                        objectFit="contain"
                        unoptimized={!!redrawnImage}
                    />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                  <ImageIcon className="w-16 h-16 mb-4" />
                  <h3 className="font-semibold text-lg">
                    Upload a PDF or image to preview
                  </h3>
                  <p className="text-sm">Ready for AI-powered text extraction</p>
                </div>
              )}
              {selection && (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                  style={{
                    left: `${selection.x}px`,
                    top: `${selection.y}px`,
                    width: `${selection.width}px`,
                    height: `${selection.height}px`,
                  }}
                />
              )}
            </div>
             {hasSelection && (
              <Button onClick={handleCrop} className="w-full mt-4">
                <Crop className="mr-2" /> Crop Selected Area
              </Button>
            )}
             {croppedImageSrc && (
              <Button onClick={() => setCroppedImageSrc(null)} variant="outline" className="w-full mt-2">
                <X className="mr-2" /> Clear Crop
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Text Results */}
      <div className="lg:col-span-4">
        <Card className="min-h-[85vh]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Text Extraction Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="extracted">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="extracted">Extracted Text</TabsTrigger>
                    <TabsTrigger value="math">Math Equations</TabsTrigger>
                    <TabsTrigger value="qac">QAC Fixes</TabsTrigger>
                    <TabsTrigger value="images">Images (0)</TabsTrigger>
                </TabsList>
                <TabsContent value="extracted" className="mt-4">
                     {!extractedText && !isLoadingCorrection && (
                        <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-8 min-h-[40vh]">
                            <FileText className="w-16 h-16 mb-4" />
                            <h3 className="font-semibold text-lg">No text extracted yet</h3>
                            <p className="text-sm">Upload a PDF or image and extract text using AI</p>
                        </div>
                    )}

                    {extractedText && (
                        <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="extracted-text">Extracted Text</Label>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(extractedText)}>
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                                <span className="ml-2">{copied ? "Copied!" : "Copy"}</span>
                            </Button>
                        </div>
                        <Textarea
                            id="extracted-text"
                            placeholder="Extracted text will appear here..."
                            value={extractedText}
                            onChange={(e) => setExtractedText(e.target.value)}
                            rows={8}
                        />
                        <Button
                            onClick={handleCorrectText}
                            disabled={!extractedText || isLoadingCorrection}
                            className="w-full"
                        >
                            {isLoadingCorrection ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            Correct with AI
                        </Button>
                        </div>
                    )}

                    {isLoadingCorrection && (
                        <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="ml-4 text-muted-foreground">AI is correcting...</p>
                        </div>
                    )}

                    {correctionResult && (
                        <div className="space-y-6 pt-4">
                        <div>
                            <Label htmlFor="corrected-text" className="text-lg font-semibold">
                            AI Corrected Text
                            </Label>
                            <Textarea
                            id="corrected-text"
                            value={correctionResult.correctedText}
                            readOnly
                            rows={8}
                            className="mt-2 bg-secondary"
                            />
                        </div>

                        {correctionResult.correctionsSummary.length > 0 && (
                            <div>
                            <h3 className="text-lg font-semibold mb-2">Summary of Corrections</h3>
                            <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Original</TableHead>
                                    <TableHead>Corrected</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {correctionResult.correctionsSummary.map(
                                    (correction, index) => (
                                        <TableRow key={index}>
                                        <TableCell className="text-destructive/80">
                                            {correction.original}
                                        </TableCell>
                                        <TableCell className="text-green-600">
                                            {correction.corrected}
                                        </TableCell>
                                        </TableRow>
                                    )
                                    )}
                                </TableBody>
                                </Table>
                            </div>
                            </div>
                        )}
                        {correctionResult.correctionsSummary.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                            AI found no errors to correct. Great job!
                            </p>
                        )}
                        </div>
                    )}
                </TabsContent>
                 <TabsContent value="math" className="min-h-[40vh] flex items-center justify-center">
                    <div className="text-muted-foreground text-center">Math equation extraction is coming soon.</div>
                </TabsContent>
                 <TabsContent value="qac" className="min-h-[40vh] flex items-center justify-center">
                    <div className="text-muted-foreground text-center">QAC fixes will appear here.</div>
                </TabsContent>
                 <TabsContent value="images" className="min-h-[40vh] flex items-center justify-center">
                    <div className="text-muted-foreground text-center">Extracted images will appear here.</div>
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
