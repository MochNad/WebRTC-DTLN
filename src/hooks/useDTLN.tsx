"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Define RingBuffer interface
interface RingBufferInterface<T = unknown> {
  capacity(): number;
  isEmpty(): boolean;
  isFull(): boolean;
  size(): number;
  enq(element: T): number;
  deq(): T;
  peek(): T;
}

// Add WebKit AudioContext type declaration
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    RingBuffer: new <T>(
      capacity: number,
      evictedCb?: (evicted: T) => void
    ) => RingBufferInterface<T>;
  }

  // Add proper globalThis typing for RingBuffer using interface
  interface GlobalThis {
    RingBufferConstructor: new <T>(
      capacity: number,
      evictedCb?: (evicted: T) => void
    ) => RingBufferInterface<T>;
    RingBuffer: new <T>(
      capacity: number,
      evictedCb?: (evicted: T) => void
    ) => RingBufferInterface<T>;
  }
}

// Add AudioConfig class for consistent buffer management
class AudioConfig {
  static get SAMPLE_RATE() {
    return 16000;
  }
  static get BUFFER_SIZE() {
    return 128;
  }
  static get LATENCY_HINT(): AudioContextLatencyCategory {
    return "interactive";
  }

  // Mobile-adaptive configuration
  static get isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  static get RING_BUFFER_CAPACITY() {
    return this.isMobile ? 20 : 50; // Reduced for mobile
  }
  static get WORKLET_BUFFER_CAPACITY() {
    return this.isMobile ? 10 : 20; // Reduced for mobile
  }
  static get INPUT_BUFFER_CAPACITY() {
    return this.isMobile ? 20 : 50; // Reduced for mobile
  }
  static get OUTPUT_BUFFER_CAPACITY() {
    return this.isMobile ? 20 : 50; // Reduced for mobile
  }
  static get PROCESSING_QUEUE_CAPACITY() {
    return this.isMobile ? 15 : 30; // Reduced for mobile
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

interface SpectogramData {
  rawAudio: Float32Array;
  processedAudio: Float32Array;
  timestamp: number;
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
  const [spectogramData, setSpectogramData] = useState<SpectogramData | null>(
    null
  );
  const [processedAudioBuffer, setProcessedAudioBuffer] =
    useState<AudioBuffer | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamDestinationNodeRef =
    useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingDurationRef = useRef<number>(0);

  const progressTrackingRef = useRef<boolean>(false);
  const processingStartTimeRef = useRef<number>(0);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // WAV encoding utility functions
  const encodeWAV = useCallback((audioBuffer: AudioBuffer): Blob => {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const channels = 1; // Force mono output
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, channels, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Convert float samples to 16-bit PCM - mono only
    let offset = 44;
    const channelData = audioBuffer.getChannelData(0); // Only use first channel for mono
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcmSample, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }, []);

  // Initialize RingBuffer loading
  const loadRingBuffer = useCallback(async () => {
    if (typeof window.RingBuffer !== "undefined") {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "/libraries/ringbufferjs-2.0.0/package/index.umd.js";
      script.onload = () => {
        if (window.RingBuffer) {
          (globalThis as unknown as GlobalThis).RingBufferConstructor =
            window.RingBuffer;
          resolve(true);
        } else {
          resolve(false);
        }
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }, []);

  // Initialize Audio Context and Worklet
  const initializeWorklet = useCallback(async () => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error("Web Audio API tidak didukung");
      }

      // Load RingBuffer first
      await loadRingBuffer();

      // Create audio context with mobile-optimized settings
      const contextOptions: AudioContextOptions = {
        sampleRate: config.sampleRate,
        latencyHint: AudioConfig.LATENCY_HINT,
      };

      // Add mobile-specific optimizations
      if (AudioConfig.isMobile) {
        contextOptions.latencyHint = "playback"; // Less aggressive latency for mobile
      }

      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)(contextOptions);

      // Add worklet processor
      await audioContextRef.current.audioWorklet.addModule(
        config.processorPath
      );

      // Create worklet node with mobile-adaptive configuration
      workletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "dtln-audio-processor",
        {
          outputChannelCount: [1],
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
          processorOptions: {
            bufferCapacity: AudioConfig.WORKLET_BUFFER_CAPACITY,
            sampleRate: audioContextRef.current.sampleRate,
            bufferSize: AudioConfig.BUFFER_SIZE,
            isMobile: AudioConfig.isMobile,
            performanceMode: AudioConfig.isMobile ? "efficiency" : "quality",
          },
        }
      );

      // Create MediaStreamDestinationNode for capturing processed audio
      mediaStreamDestinationNodeRef.current =
        audioContextRef.current.createMediaStreamDestination();

      // Connect worklet only to media stream destination (for WebRTC capture)
      workletNodeRef.current.connect(mediaStreamDestinationNodeRef.current);

      // Set up worklet message handling
      workletNodeRef.current.port.onmessage = (event) => {
        const { type, ...data } = event.data;

        switch (type) {
          case "stats":
            // Update all stats in one atomic operation - preserve raw values
            setProcessingStats((prev) => ({
              ...prev,
              workletProcessingMs:
                data.workletProcessingMs ?? prev.workletProcessingMs,
              bufferQueue: data.bufferQueue ?? prev.bufferQueue,
              bufferDropped: data.bufferDropped ?? prev.bufferDropped,
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
  }, [config.processorPath, config.sampleRate, loadRingBuffer]);

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
                workerProcessingMs:
                  data.debug.workerProcessingMs ?? prev.workerProcessingMs,
                model1ProcessingMs:
                  data.debug.model1ProcessingMs ?? prev.model1ProcessingMs,
                model2ProcessingMs:
                  data.debug.model2ProcessingMs ?? prev.model2ProcessingMs,
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
          case "spectogramData":
            setSpectogramData({
              rawAudio: new Float32Array(data.rawAudio),
              processedAudio: new Float32Array(data.processedAudio),
              timestamp: data.timestamp,
            });
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        setWorkerStatus("Error");
      };

      // Initialize worker with mobile-adaptive configuration
      workerRef.current.postMessage({
        type: "init",
        model1Path: config.model1Path,
        model2Path: config.model2Path,
        sampleRate: config.sampleRate,
        bufferConfig: {
          inputCapacity: AudioConfig.INPUT_BUFFER_CAPACITY,
          outputCapacity: AudioConfig.OUTPUT_BUFFER_CAPACITY,
          processingCapacity: AudioConfig.PROCESSING_QUEUE_CAPACITY,
        },
        performanceConfig: {
          isMobile: AudioConfig.isMobile,
          processingMode: AudioConfig.isMobile ? "lightweight" : "full",
          frameSkipping: AudioConfig.isMobile ? 2 : 1, // Skip every 2nd frame on mobile
          spectogramRate: AudioConfig.isMobile ? 0.3 : 0.8, // Reduce spectogram frequency
        },
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

  // Start recording processed audio
  const startRecording = useCallback(
    async (duration: number) => {
      if (!mediaStreamDestinationNodeRef.current) return;

      try {
        recordedChunksRef.current = [];
        recordingDurationRef.current = duration;

        // Create MediaRecorder from the processed audio stream
        mediaRecorderRef.current = new MediaRecorder(
          mediaStreamDestinationNodeRef.current.stream,
          {
            mimeType: "audio/webm;codecs=opus",
          }
        );

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          try {
            const recordedBlob = new Blob(recordedChunksRef.current, {
              type: "audio/webm;codecs=opus",
            });

            // Convert recorded blob to AudioBuffer
            const arrayBuffer = await recordedBlob.arrayBuffer();
            const tempAudioContext = new AudioContext({
              sampleRate: config.sampleRate,
            });
            const decodedBuffer = await tempAudioContext.decodeAudioData(
              arrayBuffer
            );

            setProcessedAudioBuffer(decodedBuffer);
            tempAudioContext.close();
          } catch (error) {
            console.warn("Error processing recorded audio:", error);
          }
        };

        mediaRecorderRef.current.start(100); // Record in 100ms chunks
      } catch (error) {
        console.error("Error starting recording:", error);
      }
    },
    [config.sampleRate]
  );

  // Stop recording
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Export processed audio as WAV
  const exportWAV = useCallback(() => {
    if (!processedAudioBuffer) {
      console.warn("No processed audio buffer available for export");
      return;
    }

    try {
      const wavBlob = encodeWAV(processedAudioBuffer);
      const url = URL.createObjectURL(wavBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `processed_audio_${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting WAV:", error);
    }
  }, [processedAudioBuffer, encodeWAV]);

  // Enhanced cleanup function
  const resetProcessingState = useCallback(() => {
    progressTrackingRef.current = false;
    setIsRealTimeProcessing(false);
    setIsProcessing(false);

    // Reset progress
    setProgress({
      percentage: 0,
      processedTime: 0,
      totalTime: 0,
      remainingTime: 0,
    });

    // Clear spectogram data
    setSpectogramData(null);

    // Stop any existing audio processing
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      } catch (error) {
        console.warn("Error stopping audio source:", error);
      }
    }

    // Reset processing stats - this will trigger chart reset
    setProcessingStats({
      workletProcessingMs: 0,
      workerProcessingMs: 0,
      model1ProcessingMs: 0,
      model2ProcessingMs: 0,
      bufferQueue: 0,
      bufferDropped: 0,
    });

    // Send reset messages
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "resetMetrics" });
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: "resetMetrics" });
    }

    // Stop recording if active
    stopRecording();
    setProcessedAudioBuffer(null);
  }, [stopRecording]);

  // Handle processing completion with delay for spectogram replay
  const handleProcessingComplete = useCallback(() => {
    progressTrackingRef.current = false;
    setIsRealTimeProcessing(false);

    // Stop recording
    stopRecording();

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

    // Delay setting isProcessing to false to allow spectogram to complete replay
    setTimeout(() => {
      setIsProcessing(false);
    }, 100); // Small delay to ensure spectogram component processes the completion
  }, [stopRecording]);

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
        // Reset state before starting new processing
        resetProcessingState();

        setIsRealTimeProcessing(true);
        setIsProcessing(true);
        progressTrackingRef.current = true;
        processingStartTimeRef.current = audioContextRef.current.currentTime;

        // Start recording the processed audio
        await startRecording(buffer.duration);

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
        resetProcessingState();
        throw error;
      }
    },
    [
      workletStatus,
      workerStatus,
      handleProcessingComplete,
      startProgressTracking,
      resetProcessingState,
      startRecording,
    ]
  );

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

  // Stop processing
  const stopProcessing = useCallback(() => {
    resetProcessingState();
  }, [resetProcessingState]);

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
    resetProcessingState,
    playProcessedAudio,
    stopAudio,
    isReady: workletStatus === "Tersedia" && workerStatus === "Tersedia",
    processedOutputMediaStream:
      mediaStreamDestinationNodeRef.current?.stream || null,
    spectogramData,
    processedAudioBuffer,
    exportWAV,
  };
}
