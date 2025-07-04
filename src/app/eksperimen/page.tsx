"use client";

import { HeaderPage } from "@/components/header-page";
import { useDTLN } from "@/hooks/useDTLN";
import { useWebRTC } from "@/hooks/useWebRTC";
import { SystemVerificationSection } from "@/components/experiment/system-verification-section";
import { UploadFileSection } from "@/components/experiment/upload-file-section";
import { PerformanceChartsSection } from "@/components/experiment/performance-charts-section";
import { WebRTCSection } from "@/components/experiment/webrtc-section";
import { SpectogramSection } from "@/components/experiment/spectogram-section";
import { useRef, useEffect, useState, useCallback } from "react";

const DTLN_CONFIG = {
  workerPath: "/workers/dtln.worker.js",
  processorPath: "/processors/dtln.processor.js",
  sampleRate: 16000,
  model1Path: "/models/dtln_model_1.onnx",
  model2Path: "/models/dtln_model_2.onnx",
} as const;

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export default function Experiment() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Log handler
  const handleLog = useCallback((log: LogEntry) => {
    setLogs((prev) => {
      const newLogs = [...prev, log];
      // Keep only last 100 logs to prevent memory issues
      return newLogs.slice(-100);
    });
  }, []);

  const {
    createCall,
    joinCall,
    localStatus,
    remoteStatus,
    isCallActive,
    remoteStream,
  } = useWebRTC(handleLog);

  const {
    workletStatus,
    workerStatus,
    isProcessing,
    processingStats,
    progress,
    isRealTimeProcessing,
    processAudioRealTime,
    isReady,
    processedOutputMediaStream,
    spectogramData,
    processedAudioBuffer,
    exportWAV,
  } = useDTLN(DTLN_CONFIG, handleLog);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Check if system is ready for WebRTC calls - be more flexible with status checking
  const isSystemReady =
    (workletStatus === "loaded" ||
      workletStatus === "Ready" ||
      workletStatus === "Tersedia") &&
    (workerStatus === "loaded" ||
      workerStatus === "Ready" ||
      workerStatus === "Tersedia");

  // Setup remote audio element
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;

      // Ensure audio will play
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;

      // Try to play (might be blocked by autoplay policy)
      remoteAudioRef.current.play().catch(() => {
        // Silently handle autoplay blocking
      });
    }
  }, [remoteStream]);

  // Enhanced validation for DTLN audio stream
  const validateDTLNAudioStream = () => {
    if (!processedOutputMediaStream) {
      return {
        valid: false,
        message:
          "Stream DTLN belum tersedia. Pastikan sistem audio telah diinisialisasi.",
      };
    }

    const audioTracks = processedOutputMediaStream.getAudioTracks();

    if (audioTracks.length === 0) {
      return {
        valid: false,
        message:
          "Tidak ada trek audio dalam stream DTLN. Pastikan audio sedang diproses.",
      };
    }

    // Check track states
    const trackStates = audioTracks.map((track, index) => {
      return {
        index,
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
        id: track.id,
      };
    });

    // Check if at least one track is live and not muted
    const activeTracks = trackStates.filter(
      (track) => track.readyState === "live" && !track.muted && track.enabled
    );

    if (activeTracks.length === 0) {
      // Allow proceeding but warn user
      return {
        valid: true,
        warning: `Trek audio ditemukan (${
          audioTracks.length
        }) tetapi mungkin belum aktif. Status: ${trackStates
          .map((t) => `${t.readyState}${t.muted ? "(muted)" : ""}`)
          .join(", ")}`,
      };
    }

    return { valid: true };
  };

  // Wrapper functions to use DTLN processed audio with WebRTC
  const handleCreateCallWithDTLNAudio = async (
    callInput: HTMLInputElement | null
  ) => {
    // Check system readiness first
    if (!isSystemReady) {
      return null;
    }

    const validation = validateDTLNAudioStream();

    if (!validation.valid) {
      return null;
    }

    return await createCall(callInput, processedOutputMediaStream);
  };

  const handleJoinCallWithDTLNAudio = async (callId: string) => {
    // Check system readiness first
    if (!isSystemReady) {
      return false;
    }

    const validation = validateDTLNAudioStream();

    if (!validation.valid) {
      return false;
    }

    return await joinCall(callId, processedOutputMediaStream);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <HeaderPage title="Eksperimen" description="Uji coba WebRTC & DTLN" />

        {/* Remote Audio Element - Hidden controls */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          style={{ display: "none" }}
        />

        {/* Experiment Steps - Always Open */}
        <div className="w-full space-y-4">
          {/* Step 1: System Verification */}
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  1
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Inisialisasi
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pastikan status Worklet dan Worker tersedia.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <SystemVerificationSection
                workletStatus={workletStatus}
                workerStatus={workerStatus}
              />
            </div>
          </div>

          {/* Step 2: WebRTC Communication */}
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  2
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Panggilan
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Buat atau gabung dengan kode, lalu pastikan status lokal dan
                    remote terhubung.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <WebRTCSection
                createCall={handleCreateCallWithDTLNAudio}
                joinCall={handleJoinCallWithDTLNAudio}
                localStatus={localStatus}
                remoteStatus={remoteStatus}
                isCallActive={isCallActive}
                isSystemReady={isSystemReady}
              />
            </div>
          </div>

          {/* Step 3: Audio Processing Setup */}
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  3
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">Unggah</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pilih audio lalu akan diproses secara realtime.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <UploadFileSection
                isReady={isReady}
                isProcessing={isProcessing}
                progress={progress}
                processAudioRealTime={processAudioRealTime}
                isCallActive={isCallActive}
                localStatus={localStatus}
                remoteStatus={remoteStatus}
                processedAudioBuffer={processedAudioBuffer}
                onExportWAV={exportWAV}
                logs={logs}
              />
            </div>
          </div>

          {/* Step 4: Spectogram Visualization */}
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  4
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Spectrogram
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visualisasi antara audio sebelum dan sesudah diproses.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <SpectogramSection
                spectogramData={spectogramData}
                isProcessing={isRealTimeProcessing}
              />
            </div>
          </div>

          {/* Step 5: Performance Monitoring */}
          <div className="border rounded-lg">
            <div className="px-8 py-6">
              <div className="flex items-start gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  5
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Performa
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pantau buffer, worklet, worker dan model berjalan.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-8 pb-8">
              <PerformanceChartsSection
                isRealTimeProcessing={isRealTimeProcessing}
                isProcessing={isProcessing}
                processingStats={processingStats}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
