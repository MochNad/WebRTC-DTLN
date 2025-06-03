"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { MetricCard } from "./metric-card";
import { Chart, ChartDataPoint } from "./chart";

interface FileSpecs {
  format: string;
  channels: number;
  sampleRate: number;
  duration: number;
}

interface ProcessingStats {
  workletProcessingMs: number;
  workerProcessingMs: number;
  model1ProcessingMs: number;
  model2ProcessingMs: number;
  bufferQueue: number;
  bufferDropped: number;
}

interface ProcessingProgress {
  percentage: number;
  processedTime: number;
  totalTime: number;
  remainingTime: number;
}

interface AudioProcessingSectionProps {
  isReady: boolean;
  isProcessing: boolean;
  processingStats: ProcessingStats;
  progress: ProcessingProgress;
  isRealTimeProcessing: boolean;
  processAudioRealTime: (buffer: AudioBuffer) => Promise<void>;
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

export const AudioProcessingSection: React.FC<AudioProcessingSectionProps> = ({
  isReady,
  isProcessing,
  processingStats,
  progress,
  isRealTimeProcessing,
  processAudioRealTime,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSpecs, setFileSpecs] = useState<FileSpecs | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isCollectingData, setIsCollectingData] = useState(false);
  const [lastChartUpdate, setLastChartUpdate] = useState<number>(0);

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
    [isReady, isProcessing, processAudioBuffer]
  );

  useEffect(() => {
    if ((isRealTimeProcessing || isProcessing) && processingStats) {
      const now = Date.now();

      if (now - lastChartUpdate >= 1000) {
        const newDataPoint: ChartDataPoint = {
          time: new Date().toLocaleTimeString(),
          worklet: processingStats.workletProcessingMs,
          worker: processingStats.workerProcessingMs,
          model1: processingStats.model1ProcessingMs,
          model2: processingStats.model2ProcessingMs,
          bufferQueue: processingStats.bufferQueue,
          bufferDropped: processingStats.bufferDropped,
        };

        setChartData((prev) => [...prev, newDataPoint]);
        setLastChartUpdate(now);
      }
    }
  }, [isRealTimeProcessing, isProcessing, processingStats, lastChartUpdate]);

  useEffect(() => {
    if ((isRealTimeProcessing || isProcessing) && !isCollectingData) {
      setIsCollectingData(true);
    } else if (!isRealTimeProcessing && !isProcessing && isCollectingData) {
      setIsCollectingData(false);
    }
  }, [isRealTimeProcessing, isProcessing, isCollectingData]);

  const latestChartData =
    chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const currentMetrics = latestChartData
    ? {
        workletProcessingMs: latestChartData.worklet,
        workerProcessingMs: latestChartData.worker,
        model1ProcessingMs: latestChartData.model1,
        model2ProcessingMs: latestChartData.model2,
        bufferQueue: latestChartData.bufferQueue,
        bufferDropped: latestChartData.bufferDropped,
      }
    : processingStats;

  const bufferChartLines = [
    { dataKey: "bufferQueue", name: "Buffer Queue", color: "#10b981" },
    { dataKey: "bufferDropped", name: "Buffer Dropped", color: "#ef4444" },
  ];

  const workletWorkerChartLines = [
    { dataKey: "worklet", name: "Worklet", color: "#3b82f6" },
    { dataKey: "worker", name: "Worker", color: "#8b5cf6" },
  ];

  const modelChartLines = [
    { dataKey: "model1", name: "Model 1", color: "#f59e0b" },
    { dataKey: "model2", name: "Model 2", color: "#06b6d4" },
  ];

  const timeFormatter = (value: number, name: string) =>
    [`${value.toFixed(3)}ms`, name] as [string, string];

  const bufferFormatter = (value: number, name: string) =>
    [`${value}`, name] as [string, string];

  const modelFormatter = (value: number, name: string) =>
    [`${value.toFixed(3)}ms`, name] as [string, string];

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
              disabled={!isReady || isProcessing}
            />

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
                <span className="text-sm font-medium">Processing</span>
                <span className="text-sm font-semibold">
                  {progress.percentage}%
                </span>
              </div>
              <Progress value={progress.percentage} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Current Time
                </span>
                <p className="text-sm font-semibold">
                  {formatTime(progress.processedTime)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Duration
                </span>
                <p className="text-sm font-semibold">
                  {formatTime(progress.totalTime)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Remaining
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
          <CardTitle>File Information</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Buffer Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Buffer Queue"
              value={currentMetrics.bufferQueue}
            />
            <MetricCard
              label="Buffer Dropped"
              value={currentMetrics.bufferDropped}
            />
          </div>

          <Chart
            data={chartData}
            title=""
            lines={bufferChartLines}
            yAxisLabel="Count"
            formatter={bufferFormatter}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Worklet & Worker Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Worklet"
              value={`${currentMetrics.workletProcessingMs.toFixed(3)}ms`}
            />
            <MetricCard
              label="Worker"
              value={`${currentMetrics.workerProcessingMs.toFixed(3)}ms`}
            />
          </div>

          <Chart
            data={chartData}
            title=""
            lines={workletWorkerChartLines}
            yAxisLabel="Time (ms)"
            formatter={timeFormatter}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DTLN Model Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Model 1"
              value={`${currentMetrics.model1ProcessingMs.toFixed(3)}ms`}
            />
            <MetricCard
              label="Model 2"
              value={`${currentMetrics.model2ProcessingMs.toFixed(3)}ms`}
            />
          </div>

          <Chart
            data={chartData}
            title=""
            lines={modelChartLines}
            yAxisLabel="Time (ms)"
            formatter={modelFormatter}
          />
        </CardContent>
      </Card>
    </section>
  );
};
