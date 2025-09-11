import { OcrTool } from "@/components/ocr-tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 bg-background">
      <div className="w-full max-w-screen-xl">
        <header className="flex flex-col items-center text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground font-headline">
            Advanced OCR Tool
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mt-2">
            Extract text from PDFs and images in Bangla, English, and recognize
            math equations
          </p>
          <Badge variant="secondary" className="mt-4 text-green-600 border-green-600/20">
            <Sparkles className="w-4 h-4 mr-2" />
            AI OCR ready with Google Gemini integration!
          </Badge>
        </header>
        <OcrTool />
      </div>
    </main>
  );
}
