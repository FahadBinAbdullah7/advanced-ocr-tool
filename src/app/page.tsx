import { OcrTool } from "@/components/ocr-tool";
import { Bot } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 bg-background">
      <div className="w-full max-w-7xl">
        <header className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-10 h-10 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-headline">
              VisionCraft AI
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Upload your documents, extract text and images, and let our AI enhance and perfect your content. Supports English, Bangla, and even complex math equations.
          </p>
        </header>
        <OcrTool />
      </div>
    </main>
  );
}
