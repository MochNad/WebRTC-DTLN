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

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export function useDTLN(config: DTLNConfig, onLog?: (log: LogEntry) => void) {
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
  const expectedDurationRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const processingOffsetRef = useRef<number>(0);

  const progressTrackingRef = useRef<boolean>(false);
  const processingStartTimeRef = useRef<number>(0);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Enhanced WAV encoding with proper duration handling
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

    // Convert float samples to 16-bit PCM
    let offset = 44;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcmSample, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }, []);

  // Add logging helper
  const addLog = useCallback(
    (type: string, message: string) => {
      if (onLog) {
        const timestamp = new Date().toLocaleTimeString("id-ID", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        });
        onLog({ timestamp, type, message });
      }
    },
    [onLog]
  );

  // Initialize RingBuffer loading
  const loadRingBuffer = useCallback(async () => {
    addLog("DTLN", "Memuat RingBuffer library...");

    if (typeof window.RingBuffer !== "undefined") {
      addLog("DTLN", "RingBuffer sudah tersedia");
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "/libraries/ringbufferjs-2.0.0/package/index.umd.js";
      script.onload = () => {
        if (window.RingBuffer) {
          (globalThis as unknown as GlobalThis).RingBufferConstructor =
            window.RingBuffer;
          addLog("SUCCESS", "RingBuffer berhasil dimuat");
          resolve(true);
        } else {
          addLog("ERROR", "RingBuffer gagal dimuat - tidak ditemukan");
          resolve(false);
        }
      };
      script.onerror = () => {
        addLog("ERROR", "RingBuffer gagal dimuat - error loading script");
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }, [addLog]);

  // Initialize Audio Context and Worklet
  const initializeWorklet = useCallback(async () => {
    try {
      addLog("DTLN", "Inisialisasi Audio Context...");

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
        contextOptions.latencyHint = "playback";
        addLog("DTLN", "Menggunakan optimasi mobile");
      }

      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)(contextOptions);

      addLog(
        "SUCCESS",
        `Audio Context dibuat (${audioContextRef.current.sampleRate}Hz)`
      );

      // Add worklet processor
      addLog("DTLN", "Memuat Audio Worklet processor...");
      await audioContextRef.current.audioWorklet.addModule(
        config.processorPath
      );
      addLog("SUCCESS", "Audio Worklet processor berhasil dimuat");

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

      addLog("SUCCESS", "Audio Worklet node berhasil dibuat");

      // Create MediaStreamDestinationNode for capturing processed audio
      mediaStreamDestinationNodeRef.current =
        audioContextRef.current.createMediaStreamDestination();

      // Connect worklet only to media stream destination (for WebRTC capture)
      workletNodeRef.current.connect(mediaStreamDestinationNodeRef.current);

      addLog("SUCCESS", "Media stream destination terhubung");

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
      addLog("SUCCESS", "DTLN Worklet siap digunakan");
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog("ERROR", `Worklet gagal: ${errorMsg}`);
      setWorkletStatus("Error");
      return false;
    }
  }, [config.processorPath, config.sampleRate, loadRingBuffer, addLog]);

  // Initialize Worker
  const initializeWorker = useCallback(async () => {
    try {
      addLog("DTLN", "Inisialisasi DTLN Worker...");

      // Create worker
      workerRef.current = new Worker(config.workerPath);

      // Set up worker message handling
      workerRef.current.onmessage = (event) => {
        const { type, ...data } = event.data;

        switch (type) {
          case "ready":
            const status = data.dtlnInitialized ? "Tersedia" : "Error";
            setWorkerStatus(status);
            if (data.dtlnInitialized) {
              addLog("SUCCESS", "DTLN Worker siap digunakan");
            } else {
              addLog("ERROR", "DTLN Worker gagal inisialisasi");
            }
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
            const dtlnStatus = data.initialized ? "Tersedia" : "Error";
            setWorkerStatus(dtlnStatus);
            if (data.initialized) {
              addLog("SUCCESS", "DTLN model berhasil dimuat");
            } else {
              addLog("ERROR", "DTLN model gagal dimuat");
            }
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
        addLog("ERROR", `Worker error: ${error.message || "Unknown error"}`);
        setWorkerStatus("Error");
      };

      addLog("DTLN", "Memuat model ONNX...");

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
          frameSkipping: AudioConfig.isMobile ? 2 : 1,
          spectogramRate: AudioConfig.isMobile ? 0.3 : 0.8,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog("ERROR", `Worker gagal: ${errorMsg}`);
      setWorkerStatus("Error");
      return false;
    }

    return true;
  }, [
    config.workerPath,
    config.model1Path,
    config.model2Path,
    config.sampleRate,
    addLog,
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

  // Enhanced recording with precise timing compensation
  const startRecording = useCallback(
    async (duration: number, originalBuffer: AudioBuffer) => {
      if (!mediaStreamDestinationNodeRef.current || !audioContextRef.current)
        return;

      try {
        recordedChunksRef.current = [];
        expectedDurationRef.current = duration;
        originalBufferRef.current = originalBuffer;
        recordingStartTimeRef.current = audioContextRef.current.currentTime;
        processingOffsetRef.current = 0;

        // Create MediaRecorder with minimal latency settings
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        mediaRecorderRef.current = new MediaRecorder(
          mediaStreamDestinationNodeRef.current.stream,
          {
            mimeType,
            audioBitsPerSecond: 128000,
          }
        );

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          try {
            if (
              recordedChunksRef.current.length === 0 ||
              !originalBufferRef.current
            ) {
              // Fallback: use original buffer as processed
              setProcessedAudioBuffer(originalBufferRef.current);
              return;
            }

            const recordedBlob = new Blob(recordedChunksRef.current, {
              type: mimeType,
            });
            const arrayBuffer = await recordedBlob.arrayBuffer();
            const tempAudioContext = new AudioContext({
              sampleRate: config.sampleRate,
            });

            const decodedBuffer = await tempAudioContext.decodeAudioData(
              arrayBuffer
            );

            // Get original buffer specs for exact matching
            const originalSamples = originalBufferRef.current.length;
            const recordedSamples = decodedBuffer.length;

            // Create buffer with EXACT original dimensions
            const finalBuffer = tempAudioContext.createBuffer(
              1,
              originalSamples, // Use exact original sample count
              config.sampleRate
            );

            const finalChannel = finalBuffer.getChannelData(0);
            const recordedChannel = decodedBuffer.getChannelData(0);

            // Strategy 1: If recorded is longer, find the best alignment
            if (recordedSamples >= originalSamples) {
              // Look for the best starting point to minimize silence
              let bestOffset = 0;
              let maxAmplitude = 0;

              // Check first 1000 samples to find where audio actually starts
              const searchRange = Math.min(
                1000,
                recordedSamples - originalSamples
              );
              for (let offset = 0; offset <= searchRange; offset++) {
                let sumAmplitude = 0;
                for (let i = 0; i < Math.min(1000, originalSamples); i++) {
                  sumAmplitude += Math.abs(recordedChannel[offset + i] || 0);
                }
                if (sumAmplitude > maxAmplitude) {
                  maxAmplitude = sumAmplitude;
                  bestOffset = offset;
                }
              }

              // Copy from best offset
              for (let i = 0; i < originalSamples; i++) {
                finalChannel[i] = recordedChannel[bestOffset + i] || 0;
              }
            } else {
              // Strategy 2: If recorded is shorter, copy what we have and pad
              for (let i = 0; i < recordedSamples; i++) {
                finalChannel[i] = recordedChannel[i];
              }
              // Remaining samples are already zero (silence padding)
            }

            setProcessedAudioBuffer(finalBuffer);
            tempAudioContext.close();
          } catch {
            // Fallback: use original buffer
            setProcessedAudioBuffer(originalBufferRef.current);
          }
        };

        // Start recording with high precision
        mediaRecorderRef.current.start(25); // 25ms chunks for high precision
      } catch {
        // Fallback: use original buffer
        setProcessedAudioBuffer(originalBuffer);
      }
    },
    [config.sampleRate]
  );

  // Enhanced stop recording with precise timing
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      // Add small delay to capture any remaining audio
      setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
        }
      }, 50); // 50ms delay to capture trailing audio
    }
  }, []);

  // Export processed audio as WAV
  const exportWAV = useCallback(() => {
    if (!processedAudioBuffer) {
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
    } catch {
      // Silently handle export errors
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
      } catch {
        // Silently handle cleanup errors
      }
    }

    // Reset processing stats
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

    // Clear references
    originalBufferRef.current = null;
    processingOffsetRef.current = 0;
  }, [stopRecording]);

  // Enhanced processing completion handler
  const handleProcessingComplete = useCallback(() => {
    progressTrackingRef.current = false;
    setIsRealTimeProcessing(false);

    // Stop recording with proper timing
    stopRecording();

    // Send end of stream messages
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "endOfStream" });
    }

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

    // Set processing complete
    setTimeout(() => {
      setIsProcessing(false);
    }, 100);
  }, [stopRecording]);

  // Enhanced real-time processing with precise timing
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
        addLog("DTLN", "Memulai pemrosesan audio realtime...");

        // Reset state
        resetProcessingState();

        setIsRealTimeProcessing(true);
        setIsProcessing(true);
        progressTrackingRef.current = true;

        addLog(
          "DTLN",
          `Memproses audio: ${buffer.duration.toFixed(2)}s, ${
            buffer.sampleRate
          }Hz`
        );

        // Resume context first to ensure stable timing
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
          addLog("DTLN", "Audio context resumed");
        }

        // Wait for stable context
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Set processing start time after context is stable
        processingStartTimeRef.current = audioContextRef.current.currentTime;

        // Start recording with original buffer reference
        await startRecording(buffer.duration, buffer);
        addLog("DTLN", "Perekaman output dimulai");

        // Reset progress
        setProgress({
          percentage: 0,
          processedTime: 0,
          totalTime: buffer.duration,
          remainingTime: buffer.duration,
        });

        // Stop any existing playback
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
          } catch {
            // Silently handle cleanup errors
          }
        }

        // Create source and connect to processing chain
        audioSourceRef.current = audioContextRef.current.createBufferSource();
        audioSourceRef.current.buffer = buffer;

        // Ensure clean connections
        try {
          workletNodeRef.current.disconnect();
        } catch {
          // Silently handle disconnect errors
        }

        // Reconnect worklet to media stream destination
        if (mediaStreamDestinationNodeRef.current) {
          workletNodeRef.current.connect(mediaStreamDestinationNodeRef.current);
        }

        // Connect source to worklet
        audioSourceRef.current.connect(workletNodeRef.current);

        // Set up completion handler
        audioSourceRef.current.onended = () => {
          addLog("SUCCESS", "Pemrosesan audio selesai");
          handleProcessingComplete();
        };

        // Start processing immediately after setup
        audioSourceRef.current.start(0);
        addLog("DTLN", "Pemrosesan audio dimulai");

        // Start progress tracking
        startProgressTracking(buffer.duration);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        addLog("ERROR", `Pemrosesan gagal: ${errorMsg}`);
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
      addLog,
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
    } catch {
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
      } catch {
        // Silently handle cleanup errors
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
