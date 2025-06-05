"use client";

import { HeaderPage } from "@/components/header-page";

export default function Dataset() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <HeaderPage
          title="Dataset Rekaman Audio"
          description="Kumpulan dataset rekaman audio yang digunakan dalam penelitian ini."
        />
      </div>
    </div>
  );
}
