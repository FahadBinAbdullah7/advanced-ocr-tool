"use client";

import { useState } from "react";
import Image from "next/image";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

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

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setFileName(file.name);
      // Reset everything on new file upload
      setExtractedText("");
      setCorrectionResult(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);

      setIsImageEnhanced(false);
      setBase64Image(null);
      setRedrawnImage(null);
    }
  };

  const handleExtractText = async () => {
    if (!file) {
      toast({
        title: "No file uploaded",
        description: "Please upload a document or image first.",
        variant: "destructive",
      });
      return;
    }
    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        try {
          const text = await performOcr(dataUri);
          setExtractedText(text);
          toast({
            title: "Text Extracted",
            description: "Successfully extracted text from the image.",
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
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
       toast({
        title: "File Error",
        description: "Could not read the uploaded file.",
        variant: "destructive",
      });
      setIsExtracting(false);
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

  const handleEnhanceImage = () => {
    if (!imageSrc) {
      toast({
        title: "No image found",
        description: "Please extract an image from a document first.",
        variant: "destructive",
      });
      return;
    }
    setIsImageEnhanced(!isImageEnhanced);
  };

  const handleConvertToBase64 = async () => {
    if (!imageSrc) {
      toast({
        title: "No image found",
        description: "Please extract an image from a document first.",
        variant: "destructive",
      });
      return;
    }
    try {
      const base64 = await convertImageToBase64(redrawnImage || imageSrc);
      setBase64Image(base64);
    } catch (error) {
      toast({
        title: "Conversion Failed",
        description: "Could not convert image to Base64.",
        variant: "destructive",
      });
    }
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
    if (base64Image) {
      navigator.clipboard.writeText(base64Image);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
      {/* Left Column: Upload and Controls */}
      <div className="lg:col-span-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              1. Upload Document
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
            <Button
              onClick={handleExtractText}
              disabled={!fileName || isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ScanText />
              )}
              {isExtracting ? "Extracting..." : "Extract Content"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Results */}
      <div className="lg:col-span-8">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">
              <FileText className="mr-2" /> Extracted Text
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="mr-2" /> Image Analysis
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    2. Review & Correct Text
                  </span>
                  <Button
                    onClick={handleCorrectText}
                    disabled={!extractedText || isLoadingCorrection}
                  >
                    {isLoadingCorrection ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Sparkles />
                    )}
                    Correct with AI
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Extracted text will appear here..."
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  rows={8}
                />

                {isLoadingCorrection && (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="ml-4 text-muted-foreground">
                      AI is correcting your text...
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
          </TabsContent>
          <TabsContent value="image">
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    3. Analyze & Enhance Image
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
                  {imageSrc ? (
                    <Image
                      src={redrawnImage || imageSrc}
                      alt="Cropped image from document"
                      data-ai-hint="abstract design"
                      width={800}
                      height={600}
                      className={`object-contain transition-all duration-300 ${isImageEnhanced ? "filter brightness-110 contrast-110" : ""}`}
                      unoptimized={!!redrawnImage}
                    />
                  ) : (
                    <p className="text-muted-foreground">Image will appear here</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button onClick={handleEnhanceImage} disabled={!imageSrc}>
                    <Sparkles />
                    {isImageEnhanced ? "Remove Enhance" : "Enhance"}
                  </Button>
                  <Button onClick={handleConvertToBase64} disabled={!imageSrc}>
                    <Code />
                    To Base64
                  </Button>
                  <Button
                    onClick={handleRedrawImage}
                    disabled={!imageSrc || isLoadingRedraw}
                  >
                    {isLoadingRedraw ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Bot />
                    )}
                    Redraw with AI
                  </Button>
                </div>
                
                {isLoadingRedraw && (
                    <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="ml-4 text-muted-foreground">
                      AI is redrawing your image...
                    </p>
                  </div>
                )}

                {base64Image && (
                  <div className="space-y-2 pt-4">
                      <div className="flex justify-between items-center">
                      <Label htmlFor="base64-output" className="text-lg font-semibold">
                        Base64 Output
                      </Label>
                      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                        <span className="ml-2">{copied ? "Copied!" : "Copy"}</span>
                      </Button>
                      </div>
                    <pre className="bg-secondary rounded-md p-4 max-h-48 overflow-auto">
                      <code id="base64-output" className="text-sm font-code break-all">
                        {base64Image}
                      </code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
