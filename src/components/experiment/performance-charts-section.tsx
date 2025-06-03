"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./metric-card";
import { Chart, ChartDataPoint } from "./chart";

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
  const [isCollectingData, setIsCollectingData] = useState(false);
  const [lastChartUpdate, setLastChartUpdate] = useState<number>(0);

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
          <CardTitle>Manajemen Buffer</CardTitle>
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
          <CardTitle>Performa Worklet dan Worker</CardTitle>
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
          <CardTitle>Performa Model DTLN</CardTitle>
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
