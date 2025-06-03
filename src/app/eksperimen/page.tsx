"use client";

import { HeaderPage } from "@/components/header-page";
import { useDTLN } from "@/hooks/useDTLN";
import { useWebRTC } from "@/hooks/useWebRTC";
import { SystemVerificationSection } from "@/components/experiment/system-verification-section";
import { UploadFileSection } from "@/components/experiment/upload-file-section";
import { PerformanceChartsSection } from "@/components/experiment/performance-charts-section";
import { WebRTCSection } from "@/components/experiment/webrtc-section";
import { useRef, useEffect } from "react";

const DTLN_CONFIG = {
  workerPath: "/workers/dtln.worker.js",
  processorPath: "/processors/dtln.processor.js",
  sampleRate: 16000,
  model1Path: "/models/dtln_model_1.onnx",
  model2Path: "/models/dtln_model_2.onnx",
} as const;

export default function Experiment() {
  const {
    createCall,
    joinCall,
    localStatus,
    remoteStatus,
    isCallActive,
    remoteStream,
  } = useWebRTC();

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
  } = useDTLN(DTLN_CONFIG);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

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
    const validation = validateDTLNAudioStream();

    if (!validation.valid) {
      alert(validation.message);
      return null;
    }

    return await createCall(callInput, processedOutputMediaStream);
  };

  const handleJoinCallWithDTLNAudio = async (callId: string) => {
    const validation = validateDTLNAudioStream();

    if (!validation.valid) {
      alert(validation.message);
      return false;
    }

    return await joinCall(callId, processedOutputMediaStream);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <HeaderPage
          title="Eksperimen WebRTC & DTLN"
          description="Uji coba sistem komunikasi real-time dengan noise reduction AI"
        />

        {/* Remote Audio Element - Hidden controls */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          style={{ display: "none" }}
        />

        {/* Experiment Steps */}
        <div className="space-y-8">
          {/* Step 1: System Verification */}
          <div className="bg-card rounded-lg shadow-sm p-8 border">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                1
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Verifikasi Sistem
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Pastikan DTLN worker dan audio worklet telah dimuat dengan
                  benar sebelum memulai eksperimen.
                </p>
              </div>
            </div>
            <div className="pl-18">
              <SystemVerificationSection
                workletStatus={workletStatus}
                workerStatus={workerStatus}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center">
            <div className="flex-1 border-t border-border"></div>
            <div className="px-4 text-sm text-muted-foreground">
              Langkah Selanjutnya
            </div>
            <div className="flex-1 border-t border-border"></div>
          </div>

          {/* Step 2: WebRTC Communication */}
          <div className="bg-card rounded-lg shadow-sm p-8 border">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                2
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Komunikasi WebRTC
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Buat atau bergabung ke panggilan video menggunakan audio yang
                  telah diproses DTLN untuk kualitas suara yang lebih jernih.
                </p>
              </div>
            </div>
            <div className="pl-18">
              <WebRTCSection
                createCall={handleCreateCallWithDTLNAudio}
                joinCall={handleJoinCallWithDTLNAudio}
                localStatus={localStatus}
                remoteStatus={remoteStatus}
                isCallActive={isCallActive}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center">
            <div className="flex-1 border-t border-border"></div>
            <div className="px-4 text-sm text-muted-foreground">
              Langkah Selanjutnya
            </div>
            <div className="flex-1 border-t border-border"></div>
          </div>

          {/* Step 3: Audio Processing Setup */}
          <div className="bg-card rounded-lg shadow-sm p-8 border">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                3
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Setup Audio Processing
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Aktifkan pemrosesan audio real-time dengan DTLN untuk
                  mengurangi noise pada input suara Anda.
                </p>
              </div>
            </div>
            <div className="pl-18">
              <UploadFileSection
                isReady={isReady}
                isProcessing={isProcessing}
                progress={progress}
                processAudioRealTime={processAudioRealTime}
                isCallActive={isCallActive}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center">
            <div className="flex-1 border-t border-border"></div>
            <div className="px-4 text-sm text-muted-foreground">
              Langkah Terakhir
            </div>
            <div className="flex-1 border-t border-border"></div>
          </div>

          {/* Step 4: Performance Monitoring */}
          <div className="bg-card rounded-lg shadow-sm p-8 border">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                4
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Monitoring Performa
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Pantau performa sistem secara real-time untuk memastikan
                  pemrosesan audio berjalan optimal.
                </p>
              </div>
            </div>
            <div className="pl-18">
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
