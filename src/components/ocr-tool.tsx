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
  Code,
  Bot,
  Clipboard,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  X,
} from "lucide-react";
import type { CorrectAndSummarizeTextOutput } from "@/ai/flows/correct-and-summarize-text";
import {
  performOcrCorrection,
  performImageRedraw,
  performOcr,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setFileName(file.name);
      // Reset everything on new file upload
      setExtractedText("");
      setCorrectionResult(null);
      setNumPages(null);
      setPageNumber(1);
      setSelection(null);
      setCroppedImageSrc(null);

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
      const displayedElement = container.querySelector(
        isPdf ? "canvas" : "img"
      ) as HTMLElement | null;
  
      if (!displayedElement) {
        throw new Error("Could not find the document view element.");
      }
  
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
  
      if (cropX < 0 || cropY < 0 || cropX + cropWidth > naturalWidth || cropY + cropHeight > naturalHeight) {
         toast({
          title: "Crop Warning",
          description: "Selection is partially outside the image boundaries. Adjusting crop.",
          variant: "default",
        });
      }

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
      toast({ title: "No file uploaded", description: "Please upload a document or image first.", variant: "destructive" });
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
      toast({ title: "Text Extracted", description: `Successfully extracted text from the ${croppedImageSrc ? "cropped area" : "full page"}.` });
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Extraction Failed", description: `An error occurred while extracting text: ${errorMessage}`, variant: "destructive" });
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
    setSelection({x, y, width: 0, height: 0});
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

  const handleRedrawImage = async () => {
    const source = croppedImageSrc || imageSrc;
    if (!source) {
      toast({ title: "No image found", description: "Please upload or crop an image first.", variant: "destructive" });
      return;
    }
    setIsLoadingRedraw(true);
    try {
      const result = await performImageRedraw(source);
      setRedrawnImage(result);
      if (croppedImageSrc) {
        setCroppedImageSrc(result);
      } else {
        setImageSrc(result);
      }
    } catch (error) {
      toast({
        title: "Image Redraw Failed",
        description:
          "An error occurred while redrawing the image with AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRedraw(false);
    }
  };
  
  const copyToClipboard = () => {
    const textToCopy = correctionResult?.correctedText || extractedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPdf = file?.type === 'application/pdf';
  const hasSelection = selection && selection.width > 5 && selection.height > 5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
      {/* Left Column: Upload and Controls */}
      <div className="lg:col-span-3 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              1. Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="document">PDF or Image File</Label>
              <Input
                id="document"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium">{fileName}</span>
              </p>
            )}
             {isPdf && numPages && !croppedImageSrc && (
              <div className="flex items-center justify-center gap-2">
                  <Button onClick={goToPrevPage} disabled={pageNumber <= 1} variant="outline" size="icon">
                      <ChevronLeft />
                  </Button>
                  <span>Page {pageNumber} of {numPages}</span>
                  <Button onClick={goToNextPage} disabled={pageNumber >= numPages} variant="outline" size="icon">
                      <ChevronRight />
                  </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
           <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanText className="w-5 h-5" />
              2. Extract
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasSelection && !croppedImageSrc && (
              <Button
                onClick={handleCrop}
                className="w-full"
                variant="outline"
              >
                <Crop />
                Crop Selected Area
              </Button>
            )}
            <Button
              onClick={handleExtractText}
              disabled={!fileName || isExtracting}
              className="w-full"
            >
              {isExtracting ? <Loader2 className="animate-spin" /> : <ScanText />}
              {isExtracting ? "Extracting..." : croppedImageSrc ? "Extract from Cropped" : "Extract Full Page"}
            </Button>
            {croppedImageSrc && (
              <Button
                onClick={() => {setCroppedImageSrc(null); setExtractedText(""); setCorrectionResult(null);}}
                className="w-full"
                variant="ghost"
              >
                <X className="w-4 h-4" />
                Clear Crop
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Column: Document View */}
      <div className="lg:col-span-5">
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Document View
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
            <div 
              ref={imageContainerRef}
              className={`w-full h-full min-h-[60vh] bg-muted rounded-lg flex items-center justify-center overflow-hidden border relative ${!croppedImageSrc ? "cursor-crosshair" : ""}`}
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
                    <Page pageNumber={pageNumber} renderTextLayer={false} />
                    </Document>
                ) : imageSrc ? (
                <Image
                    src={redrawnImage || imageSrc}
                    alt="Uploaded content"
                    data-ai-hint="document image"
                    width={800}
                    height={1100}
                    className="object-contain"
                    unoptimized={!!redrawnImage}
                />
                ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                    <ImageIcon className="w-16 h-16 mb-4" />
                    <h3 className="font-semibold text-lg">Document or image will appear here</h3>
                    <p className="text-sm">Upload a file to get started.</p>
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
            </CardContent>
        </Card>
      </div>

      {/* Right Column: Text Results */}
      <div className="lg:col-span-4">
        <Card>
            <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Extracted Text
                </span>
                <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={copyToClipboard} disabled={!extractedText && !correctionResult}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                    <span className="ml-2">{copied ? "Copied!" : "Copy"}</span>
                </Button>
                </div>
            </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <Textarea
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
                {isLoadingCorrection ? (
                <Loader2 className="animate-spin" />
                ) : (
                <Sparkles />
                )}
                Correct with AI
            </Button>
            {isLoadingCorrection && (
                <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">
                    AI is correcting...
                </p>
                </div>
            )}

            {correctionResult && (
                <div className="space-y-6 pt-4">
                <div>
                    <Label
                    htmlFor="corrected-text"
                    className="text-lg font-semibold"
                    >
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
                    <h3 className="text-lg font-semibold mb-2">
                        Summary of Corrections
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
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
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
