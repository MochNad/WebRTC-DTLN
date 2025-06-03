"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Add WebKit AudioContext type declaration
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface DTLNConfig {
  workerPath: string;
  processorPath: string;
  sampleRate: number;
  model1Path: string;
  model2Path: string;
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

export function useDTLN(config: DTLNConfig) {
  const [workletStatus, setWorkletStatus] = useState<string>("Memuat...");
  const [workerStatus, setWorkerStatus] = useState<string>("Memuat...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    workletProcessingMs: 0,
    workerProcessingMs: 0,
    model1ProcessingMs: 0,
    model2ProcessingMs: 0,
    bufferQueue: 0,
    bufferDropped: 0,
  });
  const [progress, setProgress] = useState<ProcessingProgress>({
    percentage: 0,
    processedTime: 0,
    totalTime: 0,
    remainingTime: 0,
  });
  const [isRealTimeProcessing, setIsRealTimeProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamDestinationNodeRef =
    useRef<MediaStreamAudioDestinationNode | null>(null);

  const progressTrackingRef = useRef<boolean>(false);
  const processingStartTimeRef = useRef<number>(0);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio Context and Worklet
  const initializeWorklet = useCallback(async () => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error("Web Audio API tidak didukung");
      }

      // Create audio context
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: config.sampleRate,
      });

      // Add worklet processor
      await audioContextRef.current.audioWorklet.addModule(
        config.processorPath
      );

      // Create worklet node
      workletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "dtln-audio-processor"
      );

      // Create MediaStreamDestinationNode for capturing processed audio
      mediaStreamDestinationNodeRef.current =
        audioContextRef.current.createMediaStreamDestination();

      // Connect worklet only to media stream destination (for WebRTC capture)
      // Remove local playback to keep processed audio silent on sender side
      workletNodeRef.current.connect(mediaStreamDestinationNodeRef.current);

      // Set up worklet message handling
      workletNodeRef.current.port.onmessage = (event) => {
        const { type, ...data } = event.data;

        switch (type) {
          case "stats":
            // Update all stats in one atomic operation - preserve raw values
            setProcessingStats((prev) => ({
              ...prev,
              // Raw values from worklet - no transformation
              workletProcessingMs:
                data.workletProcessingMs ?? prev.workletProcessingMs,
              bufferQueue: data.bufferQueue ?? prev.bufferQueue,
              bufferDropped: data.bufferDropped ?? prev.bufferDropped,
              // Raw values from worker - no transformation
              workerProcessingMs:
                data.workerProcessingMs ?? prev.workerProcessingMs,
              model1ProcessingMs:
                data.model1ProcessingMs ?? prev.model1ProcessingMs,
              model2ProcessingMs:
                data.model2ProcessingMs ?? prev.model2ProcessingMs,
            }));
            break;
          case "audioInput":
            // Forward to worker
            if (workerRef.current) {
              workerRef.current.postMessage({
                type: "processAudio",
                ...data,
              });
            }
            break;
        }
      };

      setWorkletStatus("Tersedia");
      return true;
    } catch (error: unknown) {
      console.error("Failed to initialize worklet:", error);
      setWorkletStatus("Error");
      return false;
    }
  }, [config.processorPath, config.sampleRate]);

  // Initialize Worker
  const initializeWorker = useCallback(async () => {
    try {
      // Create worker
      workerRef.current = new Worker(config.workerPath);

      // Set up worker message handling
      workerRef.current.onmessage = (event) => {
        const { type, ...data } = event.data;

        switch (type) {
          case "ready":
            setWorkerStatus(data.dtlnInitialized ? "Tersedia" : "Error");
            break;
          case "processedAudio":
            // Update processing stats from worker debug data - preserve raw values
            if (data.debug) {
              setProcessingStats((prev) => ({
                ...prev,
                // Raw worker values - no transformation
                workerProcessingMs:
                  data.debug.workerProcessingMs ?? prev.workerProcessingMs,
                model1ProcessingMs:
                  data.debug.model1ProcessingMs ?? prev.model1ProcessingMs,
                model2ProcessingMs:
                  data.debug.model2ProcessingMs ?? prev.model2ProcessingMs,
                // Keep existing worklet values
                workletProcessingMs: prev.workletProcessingMs,
                bufferQueue: prev.bufferQueue,
                bufferDropped: prev.bufferDropped,
              }));
            }

            // Forward processed audio back to worklet
            if (workletNodeRef.current) {
              workletNodeRef.current.port.postMessage({
                type: "processedAudio",
                ...data,
              });
            }
            break;
          case "dtlnStatus":
            setWorkerStatus(data.initialized ? "Tersedia" : "Error");
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        setWorkerStatus("Error");
      };

      // Initialize worker
      workerRef.current.postMessage({
        type: "init",
        model1Path: config.model1Path,
        model2Path: config.model2Path,
        sampleRate: config.sampleRate,
      });
    } catch (error: unknown) {
      console.error("Failed to initialize worker:", error);
      setWorkerStatus("Error");
      return false;
    }

    return true;
  }, [
    config.workerPath,
    config.model1Path,
    config.model2Path,
    config.sampleRate,
  ]);

  // Progress tracking
  const startProgressTracking = useCallback((duration: number) => {
    if (!audioContextRef.current) return;

    const updateProgress = () => {
      if (!progressTrackingRef.current || !audioContextRef.current) return;

      const currentTime = audioContextRef.current.currentTime;
      const elapsed = Math.max(0, currentTime - processingStartTimeRef.current);
      const progressRatio = Math.min(elapsed / duration, 1);
      const remaining = Math.max(0, duration - elapsed);

      setProgress({
        percentage: Math.round(progressRatio * 100),
        processedTime: elapsed,
        totalTime: duration,
        remainingTime: remaining,
      });

      if (progressRatio < 1 && progressTrackingRef.current) {
        requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
  }, []);

  // Handle processing completion
  const handleProcessingComplete = useCallback(() => {
    progressTrackingRef.current = false;
    setIsRealTimeProcessing(false);
    setIsProcessing(false);

    // Send end of stream to worker
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "endOfStream" });
    }

    // Send reset to worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: "endOfStream" });
    }

    // Final progress update
    setProgress((prev) => ({
      ...prev,
      percentage: 100,
      processedTime: prev.totalTime,
      remainingTime: 0,
    }));
  }, []);

  // Real-time audio processing
  const processAudioRealTime = useCallback(
    async (buffer: AudioBuffer): Promise<void> => {
      if (
        !audioContextRef.current ||
        !workletNodeRef.current ||
        !workerRef.current
      ) {
        throw new Error("DTLN belum diinisialisasi");
      }

      if (workletStatus !== "Tersedia" || workerStatus !== "Tersedia") {
        throw new Error("Worklet atau Worker belum siap");
      }

      try {
        setIsRealTimeProcessing(true);
        setIsProcessing(true);
        progressTrackingRef.current = true;
        processingStartTimeRef.current = audioContextRef.current.currentTime;

        // Reset progress
        setProgress({
          percentage: 0,
          processedTime: 0,
          totalTime: buffer.duration,
          remainingTime: buffer.duration,
        });

        // Resume context if suspended
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        // Stop any existing playback
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
          } catch (error) {
            console.warn("Error stopping previous audio source:", error);
          }
        }

        // Create source and connect to processing chain
        audioSourceRef.current = audioContextRef.current.createBufferSource();
        audioSourceRef.current.buffer = buffer;

        // Ensure proper connections are maintained
        // Disconnect and reconnect to ensure fresh connections
        try {
          workletNodeRef.current.disconnect();
        } catch (e) {
          console.warn("Error disconnecting worklet node:", e);
        }

        // Reconnect worklet only to media stream destination (no local playback)
        if (mediaStreamDestinationNodeRef.current) {
          workletNodeRef.current.connect(mediaStreamDestinationNodeRef.current);
        }

        // Connect source to worklet
        audioSourceRef.current.connect(workletNodeRef.current);

        // Set up completion handler
        audioSourceRef.current.onended = () => {
          handleProcessingComplete();
        };

        // Start processing
        audioSourceRef.current.start(0);

        // Start progress tracking
        startProgressTracking(buffer.duration);
      } catch (error) {
        setIsRealTimeProcessing(false);
        setIsProcessing(false);
        progressTrackingRef.current = false;
        throw error;
      }
    },
    [
      workletStatus,
      workerStatus,
      handleProcessingComplete,
      startProgressTracking,
    ]
  );

  // Stop processing
  const stopProcessing = useCallback(() => {
    progressTrackingRef.current = false;
    setIsRealTimeProcessing(false);
    setIsProcessing(false);

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      } catch (error) {
        console.warn("Error stopping audio source:", error);
      }
    }

    // Reset progress
    setProgress({
      percentage: 0,
      processedTime: 0,
      totalTime: 0,
      remainingTime: 0,
    });

    // Send reset messages
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "resetMetrics" });
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: "resetMetrics" });
    }
  }, []);

  // Enhanced file processing with validation
  const processAudioFile = useCallback(
    async (
      file: File
    ): Promise<{
      originalBuffer: AudioBuffer;
      processedBuffer: AudioBuffer;
      fileSpecs: {
        format: string;
        channels: number;
        sampleRate: number;
        duration: number;
      };
    }> => {
      // Validate file type
      const allowedExtensions = ["wav"];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (!allowedExtensions.includes(fileExtension || "")) {
        throw new Error("Hanya file WAV yang diperbolehkan");
      }

      if (!file.type.includes("wav") && !file.type.includes("audio/wav")) {
        throw new Error("Format file harus WAV");
      }

      if (
        !audioContextRef.current ||
        !workletNodeRef.current ||
        !workerRef.current
      ) {
        throw new Error("DTLN belum diinisialisasi");
      }

      if (workletStatus !== "Tersedia" || workerStatus !== "Tersedia") {
        throw new Error("Worklet atau Worker belum siap");
      }

      try {
        setIsProcessing(true);

        // Read and decode file
        const arrayBuffer = await file.arrayBuffer();
        const originalBuffer = await audioContextRef.current.decodeAudioData(
          arrayBuffer
        );

        // Validate audio format
        if (originalBuffer.sampleRate !== 16000) {
          throw new Error(
            `Sample rate harus 16000 Hz. File ini: ${originalBuffer.sampleRate} Hz`
          );
        }

        if (originalBuffer.numberOfChannels !== 1) {
          throw new Error(
            `File harus mono (1 channel). File ini: ${originalBuffer.numberOfChannels} channels`
          );
        }

        // Get file specifications
        const fileSpecs = {
          format: file.type.split("/")[1] || "wav",
          channels: originalBuffer.numberOfChannels,
          sampleRate: originalBuffer.sampleRate,
          duration: originalBuffer.duration,
        };

        // Process with real-time processing
        await processAudioRealTime(originalBuffer);

        // For now, return the same buffer as processed
        // In a real implementation, you'd capture the processed output
        return {
          originalBuffer,
          processedBuffer: originalBuffer, // This would be the actual processed buffer
          fileSpecs,
        };
      } catch (error) {
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [workletStatus, workerStatus, processAudioRealTime]
  );

  // Play processed audio
  const playProcessedAudio = useCallback(async (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;

    try {
      // Resume context if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Stop current playback
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }

      // Create new source
      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = buffer;

      // Create gain node for volume control
      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      // Connect and play
      sourceRef.current.connect(gainNodeRef.current);
      sourceRef.current.start(0);
    } catch (error) {
      console.error("Error playing processed audio:", error);
      // Silently handle errors
    }
  }, []);

  // Stop audio playback
  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      } catch (error) {
        console.warn("Error stopping audio playback:", error);
      }
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      await initializeWorklet();
      await initializeWorker();
    };

    initialize();

    // Cleanup on unmount
    return () => {
      stopAudio();

      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      if (mediaStreamDestinationNodeRef.current) {
        mediaStreamDestinationNodeRef.current.disconnect();
        mediaStreamDestinationNodeRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [initializeWorklet, initializeWorker, stopAudio]);

  return {
    workletStatus,
    workerStatus,
    isProcessing,
    processingStats,
    progress,
    isRealTimeProcessing,
    processAudioFile,
    processAudioRealTime,
    stopProcessing,
    playProcessedAudio,
    stopAudio,
    isReady: workletStatus === "Tersedia" && workerStatus === "Tersedia",
    processedOutputMediaStream:
      mediaStreamDestinationNodeRef.current?.stream || null,
  };
}
