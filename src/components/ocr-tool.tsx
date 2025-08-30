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
} from "lucide-react";
import type { CorrectAndSummarizeTextOutput } from "@/ai/flows/correct-and-summarize-text";
import {
  performOcrCorrection,
  performImageRedraw,
  convertImageToBase64,
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
  const [isImageEnhanced, setIsImageEnhanced] = useState(false);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [redrawnImage, setRedrawnImage] = useState<string | null>(null);
  const [isLoadingRedraw, setIsLoadingRedraw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImageSrc("");
      }


      setIsImageEnhanced(false);
      setBase64Image(null);
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

  const handleExtractText = async (area: 'full' | 'selected') => {
    if (!file) {
      toast({
        title: "No file uploaded",
        description: "Please upload a document or image first.",
        variant: "destructive",
      });
      return;
    }
     if (area === 'selected' && !selection) {
      toast({
        title: "No area selected",
        description: "Please select an area on the document to extract text from.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    
    let dataUri: string;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
       toast({
        title: "Extraction Failed",
        description: "Could not initialize canvas for extraction.",
        variant: "destructive",
      });
      setIsExtracting(false);
      return;
    }

    if (file.type === 'application/pdf') {
      const pdf = await pdfjs.getDocument(URL.createObjectURL(file)).promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 }); // Use a higher scale for better quality
      
      tempCanvas.height = viewport.height;
      tempCanvas.width = viewport.width;

      const renderContext = {
        canvasContext: tempCtx,
        viewport: viewport,
      };
      await page.render(renderContext).promise;
      dataUri = tempCanvas.toDataURL();
    } else {
      const img = new window.Image();
      const imgPromise = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });
      await imgPromise;
      
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      tempCtx.drawImage(img, 0, 0);
      dataUri = tempCanvas.toDataURL();
    }

    if (area === 'selected' && selection) {
        const imageElement = imageContainerRef.current?.querySelector(isPdf ? 'canvas' : 'img');
        if (imageElement) {
          const sourceImage = new window.Image();
          const sourceImagePromise = new Promise<void>((resolve) => {
            sourceImage.onload = () => resolve();
            sourceImage.src = dataUri;
          });
          await sourceImagePromise;

          const { width: clientWidth, height: clientHeight } = imageElement.getBoundingClientRect();
          const { naturalWidth, naturalHeight } = sourceImage;
          
          const scaleX = naturalWidth / clientWidth;
          const scaleY = naturalHeight / clientHeight;

          const cropX = selection.x * scaleX;
          const cropY = selection.y * scaleY;
          const cropWidth = selection.width * scaleX;
          const cropHeight = selection.height * scaleY;

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;
          const croppedCtx = croppedCanvas.getContext('2d');
          
          if (croppedCtx) {
            croppedCtx.drawImage(sourceImage, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            dataUri = croppedCanvas.toDataURL();
          }
        }
    }


    try {
      const text = await performOcr(dataUri);
      setExtractedText(text);
      toast({
        title: "Text Extracted",
        description: `Successfully extracted text from the ${area === 'selected' ? 'selected area' : 'full page'}.`,
      });
    } catch (error) {
      toast({
        title: "Extraction Failed",
        description:
          "An error occurred while extracting text. Please try again.",
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
    if (!imageContainerRef.current) return;
    setIsSelecting(true);
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    // Reset selection immediately on new mousedown
    setSelection({x, y, width: 0, height: 0});
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint || !imageContainerRef.current) return;
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
    if (!imageSrc) {
      toast({
        title: "No image found",
        description: "Please extract an image from a document first.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingRedraw(true);
    try {
      const result = await performImageRedraw(imageSrc);
      setRedrawnImage(result);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
       <canvas ref={canvasRef} style={{ display: 'none' }} />
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
             {isPdf && numPages && (
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
             <Button
              onClick={() => handleExtractText('full')}
              disabled={!fileName || isExtracting}
              className="w-full"
            >
              {isExtracting && !selection ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ScanText />
              )}
              {isExtracting && !selection ? "Extracting..." : "Extract Full Page"}
            </Button>
            <Button
              onClick={() => handleExtractText('selected')}
              disabled={!fileName || isExtracting || !selection || selection.width === 0 || selection.height === 0}
              className="w-full"
              variant="outline"
            >
              {isExtracting && selection ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ScanText />
              )}
              {isExtracting && selection ? "Extracting..." : "Extract Selected Area"}
            </Button>
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
              className="w-full h-full min-h-[60vh] bg-muted rounded-lg flex items-center justify-center overflow-auto border relative cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
                {isPdf && file ? (
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
                <p className="text-muted-foreground">Document or image will appear here</p>
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

    