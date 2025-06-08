"use client";

import { useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";

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
  localStatus: string;
  remoteStatus: string;
  processedAudioBuffer: AudioBuffer | null;
  onExportWAV: () => void;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00:00.00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
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
  localStatus,
  remoteStatus,
  processedAudioBuffer,
  onExportWAV,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSpecs, setFileSpecs] = useState<FileSpecs | null>(null);
  const [validationError, setValidationError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset file input when processing completes
  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedFile(null);
    setFileSpecs(null);
    setValidationError("");
  }, []);

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

  // Check if both local and remote are connected
  const isWebRTCConnected =
    localStatus === "Terhubung" && remoteStatus === "Terhubung";

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset previous state when new file is selected
      setValidationError("");
      setFileSpecs(null);
      setSelectedFile(null);

      const validationError = validateAudioFile(file);
      if (validationError) {
        setValidationError(validationError);
        // Reset file input on validation error
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setTimeout(() => setValidationError(""), 3000);
        return;
      }

      // Set selected file after validation passes
      setSelectedFile(file);

      if (isWebRTCConnected && isReady && !isProcessing) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          await processAudioBuffer(file, audioBuffer);

          // Don't close audio context immediately, let it be handled by cleanup
          audioContext.close().catch(() => {
            // Ignore close errors
          });
        } catch (error) {
          console.error("Processing failed:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Processing failed";
          setValidationError(errorMessage);

          // Reset file input on processing error
          resetFileInput();
          setTimeout(() => setValidationError(""), 3000);
        }
      }
    },
    [
      isReady,
      isProcessing,
      processAudioBuffer,
      isWebRTCConnected,
      resetFileInput,
    ]
  );

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload & Proses Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".wav,audio/wav"
                onChange={handleFileUpload}
                className="w-full"
                disabled={!isReady || isProcessing || !isWebRTCConnected}
              />

              {validationError && (
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 dark:bg-red-700 text-white text-xs px-2 py-1 rounded z-10">
                  {validationError}
                </div>
              )}
            </div>
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

            <Button
              variant={"outline"}
              className="mt-2 w-full"
              disabled={!processedAudioBuffer || isProcessing}
              onClick={onExportWAV}
            >
              Export (WAV)
            </Button>
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
