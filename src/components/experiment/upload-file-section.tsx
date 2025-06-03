"use client";

import { useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

interface FileSpecs {
  format: string;
  channels: number;
  sampleRate: number;
  duration: number;
}

interface ProcessingProgress {
  percentage: number;
  processedTime: number;
  totalTime: number;
  remainingTime: number;
}

interface UploadFileSectionProps {
  isReady: boolean;
  isProcessing: boolean;
  progress: ProcessingProgress;
  processAudioRealTime: (buffer: AudioBuffer) => Promise<void>;
  isCallActive: boolean;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 100);

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
};

const validateAudioFile = (file: File): string | null => {
  const allowedExtensions = ["wav"];
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (!allowedExtensions.includes(fileExtension || "")) {
    return "Hanya file WAV yang diperbolehkan";
  }

  if (!file.type.includes("wav") && !file.type.includes("audio/wav")) {
    return "Format file harus WAV";
  }

  return null;
};

export const UploadFileSection: React.FC<UploadFileSectionProps> = ({
  isReady,
  isProcessing,
  progress,
  processAudioRealTime,
  isCallActive,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSpecs, setFileSpecs] = useState<FileSpecs | null>(null);
  const [validationError, setValidationError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAudioBuffer = useCallback(
    async (file: File, audioBuffer: AudioBuffer) => {
      if (audioBuffer.sampleRate !== 16000) {
        throw new Error(
          `Sample rate harus 16000 Hz. File ini: ${audioBuffer.sampleRate} Hz`
        );
      }

      if (audioBuffer.numberOfChannels !== 1) {
        throw new Error(
          `File harus mono (1 channel). File ini: ${audioBuffer.numberOfChannels} channels`
        );
      }

      const specs: FileSpecs = {
        format: file.type.split("/")[1] || "wav",
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      };

      setFileSpecs(specs);
      await processAudioRealTime(audioBuffer);
    },
    [processAudioRealTime]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setValidationError("");
      setSelectedFile(file);
      setFileSpecs(null);

      const validationError = validateAudioFile(file);
      if (validationError) {
        setValidationError(validationError);
        return;
      }

      if (!isCallActive) {
        setValidationError(
          "Harap buat atau bergabung ke panggilan WebRTC terlebih dahulu"
        );
        return;
      }

      if (isReady && !isProcessing) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          await processAudioBuffer(file, audioBuffer);
        } catch (error) {
          console.error("Processing failed:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Processing failed";
          setValidationError(errorMessage);
        }
      }
    },
    [isReady, isProcessing, processAudioBuffer, isCallActive]
  );

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload & Proses Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".wav,audio/wav"
              onChange={handleFileUpload}
              className="w-full"
              disabled={!isReady || isProcessing || !isCallActive}
            />

            {!isCallActive && (
              <div className="flex items-center p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="mr-2">⚠️</span>
                Harap buat atau bergabung ke panggilan WebRTC pada langkah 2
                terlebih dahulu sebelum memproses audio.
              </div>
            )}

            {validationError && (
              <div className="flex items-center p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
                <span className="mr-2">❌</span>
                {validationError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Proses</span>
                <span className="text-sm font-semibold">
                  {progress.percentage}%
                </span>
              </div>
              <Progress value={progress.percentage} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Waktu Diproses
                </span>
                <p className="text-sm font-semibold">
                  {formatTime(progress.processedTime)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Waktu
                </span>
                <p className="text-sm font-semibold">
                  {formatTime(progress.totalTime)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Waktu Tersisa
                </span>
                <p className="text-sm font-semibold">
                  {formatTime(progress.remainingTime)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spesifikasi File Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Nama File
              </span>
              <p className="text-sm font-semibold break-all">
                {selectedFile?.name || "-"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Ukuran File
              </span>
              <p className="text-sm font-semibold">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                  : "-"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Format
              </span>
              <p className="text-sm font-semibold">
                {fileSpecs?.format.toUpperCase() || "-"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Channel
              </span>
              <p className="text-sm font-semibold">
                {fileSpecs?.channels === 1
                  ? "Mono"
                  : fileSpecs?.channels
                  ? `${fileSpecs.channels} Channels`
                  : "-"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Sample Rate
              </span>
              <p className="text-sm font-semibold">
                {fileSpecs
                  ? `${fileSpecs.sampleRate.toLocaleString()} Hz`
                  : "-"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Durasi
              </span>
              <p className="text-sm font-semibold">
                {fileSpecs ? formatTime(fileSpecs.duration) : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
