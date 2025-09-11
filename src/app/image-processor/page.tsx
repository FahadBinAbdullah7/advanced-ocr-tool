import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import Link from "next/link";

export default function ImageProcessorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            Image Processor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <p>This page is under construction.</p>
            <Link href="/" className="text-primary hover:underline mt-4 inline-block">
              &larr; Back to OCR Tool
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
