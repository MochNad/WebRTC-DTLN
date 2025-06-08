"use client";

import FormatSection from "@/components/dataset/format-section";
import GenerateSection from "@/components/dataset/generate-section";
import { SourceSection } from "@/components/dataset/source-section";
import { HeaderPage } from "@/components/header-page";

export default function Dataset() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <HeaderPage
          title="Dataset"
          description="Berisi audio clean dan noise."
        />

        <div className="w-full space-y-4">
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  1
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Sumber
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pengambilan audio clean dan noise.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <SourceSection />
            </div>
          </div>
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  2
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Format
                  </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Standarisasi audio clean dan noise.
                    </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <FormatSection />
            </div>
          </div>
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  3
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Generate
                  </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gabungan antara audio clean dengan berbagai noise yang tersedia.
                    </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <GenerateSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
