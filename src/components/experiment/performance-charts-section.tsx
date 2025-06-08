"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chart, ChartDataPoint } from "./chart";
import { Button } from "../ui/button";

const CHART_DISPLAY_LIMIT = 30; // Show only last 30 data points for clarity

interface ProcessingStats {
  workletProcessingMs: number;
  workerProcessingMs: number;
  model1ProcessingMs: number;
  model2ProcessingMs: number;
  bufferQueue: number;
  bufferDropped: number;
}

interface PerformanceChartsSectionProps {
  isRealTimeProcessing: boolean;
  isProcessing: boolean;
  processingStats: ProcessingStats;
}

export const PerformanceChartsSection: React.FC<
  PerformanceChartsSectionProps
> = ({ isRealTimeProcessing, isProcessing, processingStats }) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [displayData, setDisplayData] = useState<ChartDataPoint[]>([]);
  const [isCollectingData, setIsCollectingData] = useState(false);
  const [lastChartUpdate, setLastChartUpdate] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [canExport, setCanExport] = useState(false);

  // Add export function
  const exportChartData = useCallback(() => {
    if (chartData.length === 0) return;

    // Create CSV header
    const csvHeaders = [
      "time",
      "worklet_ms",
      "worker_ms",
      "model1_ms",
      "model2_ms",
      "buffer_queue",
      "buffer_dropped",
    ];

    // Create CSV rows
    const csvRows = chartData.map((dataPoint) => [
      dataPoint.time,
      dataPoint.worklet.toFixed(3),
      dataPoint.worker.toFixed(3),
      dataPoint.model1.toFixed(3),
      dataPoint.model2.toFixed(3),
      dataPoint.bufferQueue.toString(),
      dataPoint.bufferDropped.toString(),
    ]);

    // Combine header and rows
    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `performance_chart_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [chartData]);

  // Reset chart data when processing starts
  useEffect(() => {
    if ((isRealTimeProcessing || isProcessing) && !isCollectingData) {
      // Clear previous chart data when starting new processing
      setChartData([]);
      setDisplayData([]);
      setIsCollectingData(true);
      setStartTime(Date.now());
      setLastChartUpdate(Date.now());
      setCanExport(false);
    } else if (!isRealTimeProcessing && !isProcessing && isCollectingData) {
      setIsCollectingData(false);
      // Automatically show full data when processing ends
      setDisplayData(chartData);
      setCanExport(chartData.length > 0);
    }
  }, [isRealTimeProcessing, isProcessing, isCollectingData, chartData]);

  useEffect(() => {
    if ((isRealTimeProcessing || isProcessing) && processingStats) {
      const now = Date.now();

      // Set start time when processing begins
      if (startTime === 0) {
        setStartTime(now);
        setLastChartUpdate(now);
      }

      // Collect data every 1000ms (1 second) for per-second data
      if (now - lastChartUpdate >= 1000) {
        const currentTime = new Date();

        const newDataPoint: ChartDataPoint = {
          time: currentTime.toLocaleTimeString(), // Show actual time (HH:MM:SS)
          worklet: processingStats.workletProcessingMs,
          worker: processingStats.workerProcessingMs,
          model1: processingStats.model1ProcessingMs,
          model2: processingStats.model2ProcessingMs,
          bufferQueue: processingStats.bufferQueue,
          bufferDropped: processingStats.bufferDropped,
        };

        // Always add to full dataset
        setChartData((prev) => {
          const newFullData = [...prev, newDataPoint];

          // During processing, show limited data; after processing, show full data
          if (isRealTimeProcessing || isProcessing) {
            // Keep only the last N points for display during processing
            setDisplayData(newFullData.slice(-CHART_DISPLAY_LIMIT));
          } else {
            // Show all data after processing
            setDisplayData(newFullData);
          }

          return newFullData;
        });

        setLastChartUpdate(now);
      }
    }
  }, [
    isRealTimeProcessing,
    isProcessing,
    processingStats,
    lastChartUpdate,
    startTime,
  ]);

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
      <Button
        variant={"outline"}
        className="mt-2 w-full"
        disabled={!canExport}
        onClick={exportChartData}
      >
        Export (CSV)
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Buffer</CardTitle>
        </CardHeader>
        <CardContent>
          <Chart
            data={displayData}
            title=""
            lines={bufferChartLines}
            yAxisLabel="Count"
            formatter={bufferFormatter}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Worklet & Worker</CardTitle>
        </CardHeader>
        <CardContent>
          <Chart
            data={displayData}
            title=""
            lines={workletWorkerChartLines}
            yAxisLabel="Waktu (ms)"
            formatter={timeFormatter}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
        </CardHeader>
        <CardContent>
          <Chart
            data={displayData}
            title=""
            lines={modelChartLines}
            yAxisLabel="Waktu (ms)"
            formatter={modelFormatter}
          />
        </CardContent>
      </Card>
    </section>
  );
};
