/**
 * Audio Worklet Processor with Enhanced RingBuffer Management
 */

class DTLNAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.initializeRingBuffer(options);
    this.initializeBuffers(options);
    this.initializeMetrics();
    this.setupMessageHandling();
    this.sendInitializationMessage();

    // Flag to track if we've attempted ring buffer upgrade
    this.upgradeAttempted = false;

    // Mobile optimization settings
    this.isMobile = options?.processorOptions?.isMobile || false;
    this.performanceMode =
      options?.processorOptions?.performanceMode || "quality";
    this.processFrameCount = 0;
    this.frameSkipInterval = this.isMobile ? 2 : 1;
  }

  initializeRingBuffer() {
    if (typeof globalThis.RingBufferConstructor !== "undefined") {
      this.RingBuffer = globalThis.RingBufferConstructor;
    } else if (typeof globalThis.RingBuffer !== "undefined") {
      this.RingBuffer = globalThis.RingBuffer;
    } else {
      this.RingBuffer = this.createFallbackRingBuffer();
    }
  }

  createFallbackRingBuffer() {
    return function DTLNBuffer(capacity, evictedCb) {
      this._elements = [];
      this._capacity = capacity || 50;
      this._evictedCb = evictedCb;

      this.capacity = () => this._capacity;
      this.isEmpty = () => this._elements.length === 0;
      this.isFull = () => this._elements.length >= this._capacity;
      this.size = () => this._elements.length;

      this.enq = (element) => {
        if (this.isFull()) {
          const evicted = this._elements.shift();
          this._evictedCb?.(evicted);
        }
        this._elements.push(element);
        return this.size();
      };

      this.deq = () => {
        if (this.isEmpty()) throw new Error("Buffer is empty");
        return this._elements.shift();
      };

      this.peek = () => {
        if (this.isEmpty()) throw new Error("Buffer is empty");
        return this._elements[0];
      };
    };
  }

  initializeBuffers(options) {
    // Mobile-adaptive buffer capacity
    const baseCapacity = options?.processorOptions?.bufferCapacity || 20;
    const capacity = this.isMobile ? Math.min(baseCapacity, 15) : baseCapacity;

    this.audioBuffer = new this.RingBuffer(capacity, (evicted) => {
      this.metrics.bufferDropped++;
      if (!this.isMobile) {
        // Reduce console spam on mobile
        console.warn("Audio buffer overflow, dropped:", evicted);
      }
    });

    this.isProcessingComplete = false;
    this.inputEnded = false;
    this.ringBufferUpgraded = false;
  }

  scheduleRingBufferUpgrade() {
    // Remove setTimeout - will upgrade during first process call instead
    this.upgradeAttempted = false;
  }

  upgradeToNativeRingBuffer() {
    if (this.ringBufferUpgraded) return;

    if (typeof globalThis.RingBufferConstructor !== "undefined") {
      const NativeRingBuffer = globalThis.RingBufferConstructor;
      const oldBuffer = this.audioBuffer;

      // Create new native ring buffer
      this.audioBuffer = new NativeRingBuffer(
        oldBuffer.capacity(),
        (evicted) => {
          this.metrics.bufferDropped++;
          console.warn("Audio buffer upgrade overflow, dropped:", evicted);
        }
      );

      // Transfer existing data
      const existingData = [];
      while (!oldBuffer.isEmpty()) {
        try {
          existingData.push(oldBuffer.deq());
        } catch {
          break;
        }
      }

      // Re-enqueue data to new buffer
      existingData.forEach((data) => {
        if (!this.audioBuffer.isFull()) {
          this.audioBuffer.enq(data);
        }
      });

      this.ringBufferUpgraded = true;
      console.log("Ring buffer upgraded to native implementation");
    }
  }

  initializeMetrics() {
    this.metrics = {
      lastLogTime: currentTime,
      bufferQueue: 0,
      bufferDropped: 0,
      workletProcessingMs: 0,
      workerProcessingMs: 0,
      model1ProcessingMs: 0,
      model2ProcessingMs: 0,
      processingTimes: [],
      maxProcessingTime: 0,
    };

    this.getHighResTime = () => {
      if (typeof performance !== "undefined" && performance.now) {
        return performance.now();
      }
      return Date.now();
    };
  }

  sendInitializationMessage() {
    this.port.postMessage({
      type: "init",
      sampleRate: sampleRate,
      bufferCapacity: this.audioBuffer.capacity(),
    });
  }

  setupMessageHandling() {
    this.port.onmessage = (event) => {
      const { type } = event.data;
      const handlers = {
        processedAudio: () => this.handleProcessedAudio(event.data),
        resetMetrics: () => this.resetMetrics(),
        endOfStream: () => this.handleEndOfStream(),
      };

      handlers[type]?.();
    };
  }

  handleProcessedAudio(data) {
    if (data.isEndOfStream) {
      this.finalizeProcessing();
      return;
    }

    if (this.isValidChannelData(data.channels)) {
      try {
        this.audioBuffer.enq({
          channels: data.channels,
          timestamp: currentTime,
        });
        this.updateWorkerMetrics(data.debug);
        this.metrics.bufferQueue = this.audioBuffer.size();
      } catch (error) {
        console.warn("Failed to enqueue processed audio:", error);
        this.metrics.bufferDropped++;
      }
    }
  }

  isValidChannelData(channels) {
    return (
      channels?.length > 0 &&
      channels[0] instanceof Float32Array &&
      channels[0].length > 0
    );
  }

  updateWorkerMetrics(debug) {
    if (!debug) return;

    this.metrics.workerProcessingMs =
      debug.workerProcessingMs || this.metrics.workerProcessingMs;
    this.metrics.model1ProcessingMs =
      debug.model1ProcessingMs || this.metrics.model1ProcessingMs;
    this.metrics.model2ProcessingMs =
      debug.model2ProcessingMs || this.metrics.model2ProcessingMs;
  }

  handleEndOfStream() {
    this.inputEnded = true;
    this.port.postMessage({
      type: "audioInput",
      channels: [],
      isEndOfStream: true,
      debug: { timestamp: currentTime, hasAudio: false, audioLevel: 0 },
    });
  }

  resetMetrics() {
    this.isProcessingComplete = false;
    this.inputEnded = false;

    Object.assign(this.metrics, {
      lastLogTime: currentTime,
      bufferQueue: 0,
      bufferDropped: 0,
      workletProcessingMs: 0,
      workerProcessingMs: 0,
      model1ProcessingMs: 0,
      model2ProcessingMs: 0,
    });

    // Clear buffer safely
    this.clearAudioBuffer();
    this.sendStatistics();
  }

  clearAudioBuffer() {
    while (!this.audioBuffer.isEmpty()) {
      try {
        this.audioBuffer.deq();
      } catch {
        break;
      }
    }
  }

  finalizeProcessing() {
    if (this.isProcessingComplete) return;
    this.isProcessingComplete = true;
    this.sendStatistics();
  }

  process(inputs, outputs) {
    const frameStartTime = this.getHighResTime();

    // Attempt ring buffer upgrade on first process call
    if (!this.upgradeAttempted) {
      this.upgradeToNativeRingBuffer();
      this.upgradeAttempted = true;
    }

    // Mobile frame skipping optimization
    if (this.isMobile) {
      this.processFrameCount++;
      if (this.processFrameCount % this.frameSkipInterval !== 0) {
        // For skipped frames, just pass through or use silence
        this.usePassthroughAudio(inputs[0], outputs[0]);
        return true;
      }
    }

    if (this.isProcessingComplete) {
      this.outputSilence(outputs);
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];

    if (!input?.length || !output?.length) return true;

    if (!this.inputEnded) {
      this.processAudioInput(input);
    }

    this.processAudioOutput(input, output);

    const processingTime = this.getHighResTime() - frameStartTime;

    // Simplified processing time tracking for mobile
    if (this.isMobile) {
      this.metrics.workletProcessingMs = processingTime;
      // Only track max processing time to reduce overhead
      this.metrics.maxProcessingTime = Math.max(
        this.metrics.maxProcessingTime,
        processingTime
      );
    } else {
      // Full processing time tracking for desktop
      this.metrics.processingTimes.push(processingTime);
      if (this.metrics.processingTimes.length > 200) {
        this.metrics.processingTimes.shift();
      }
      this.metrics.workletProcessingMs = processingTime;
      this.metrics.maxProcessingTime = Math.max(
        this.metrics.maxProcessingTime,
        processingTime
      );
    }

    // Adaptive performance monitoring
    if (this.isMobile && processingTime > 10) {
      // 10ms threshold for mobile
      this.frameSkipInterval = Math.min(this.frameSkipInterval + 1, 4);
    } else if (
      this.isMobile &&
      processingTime < 5 &&
      this.frameSkipInterval > 1
    ) {
      this.frameSkipInterval = Math.max(this.frameSkipInterval - 1, 1);
    }

    this.maybeLogStatistics();

    return true;
  }

  processAudioInput(input) {
    if (!input[0]?.length) return;

    const audioDetection = this.detectAudioActivity(input);
    this.sendAudioToWorker(input, audioDetection);
  }

  detectAudioActivity(input) {
    let hasAudio = false;
    let audioLevel = 0;
    const threshold = 0.00001;

    for (const channel of input) {
      for (const sample of channel) {
        const amplitude = Math.abs(sample);
        audioLevel = Math.max(audioLevel, amplitude);
        if (amplitude > threshold) hasAudio = true;
      }
    }

    return { hasAudio, audioLevel };
  }

  sendAudioToWorker(input, audioDetection) {
    const channels = input.map((channel) => {
      const buffer = new Float32Array(channel.length);
      buffer.set(channel);
      return buffer;
    });

    this.port.postMessage(
      {
        type: "audioInput",
        channels: channels,
        debug: {
          timestamp: currentTime,
          hasAudio: audioDetection.hasAudio,
          audioLevel: audioDetection.audioLevel,
          bufferHealth: {
            size: this.audioBuffer.size(),
            capacity: this.audioBuffer.capacity(),
            utilization: Math.round(
              (this.audioBuffer.size() / this.audioBuffer.capacity()) * 100
            ),
          },
        },
      },
      channels.map((ch) => ch.buffer)
    );
  }

  processAudioOutput(input, output) {
    if (!this.audioBuffer.isEmpty()) {
      this.useProcessedAudio(output);
    } else if (!this.inputEnded) {
      this.usePassthroughAudio(input, output);
    } else {
      this.outputSilence(output);
    }
  }

  useProcessedAudio(output) {
    try {
      const processedData = this.audioBuffer.deq();
      this.metrics.bufferQueue = this.audioBuffer.size();

      for (let i = 0; i < output.length; i++) {
        const sourceChannel = processedData.channels[i];
        const targetChannel = output[i];

        if (sourceChannel && targetChannel) {
          this.copyChannelData(sourceChannel, targetChannel);
        } else {
          targetChannel?.fill(0);
        }
      }
    } catch (error) {
      console.warn("Failed to dequeue processed audio:", error);
      this.outputSilence(output);
    }
  }

  copyChannelData(sourceChannel, targetChannel) {
    const copyLength = Math.min(sourceChannel.length, targetChannel.length);
    targetChannel.set(sourceChannel.subarray(0, copyLength));

    if (copyLength < targetChannel.length) {
      targetChannel.fill(0, copyLength);
    }
  }

  usePassthroughAudio(input, output) {
    for (let i = 0; i < output.length; i++) {
      if (input[i] && output[i]) {
        output[i].set(input[i]);
      } else {
        output[i]?.fill(0);
      }
    }
  }

  outputSilence(outputs) {
    const output = Array.isArray(outputs) ? outputs[0] : outputs;
    if (output) {
      for (let i = 0; i < output.length; i++) {
        output[i]?.fill(0);
      }
    }
  }

  maybeLogStatistics() {
    // Reduce statistics frequency for mobile
    const interval = this.isMobile ? 2.0 : 1.0; // 2 seconds for mobile, 1 for desktop
    if (currentTime - this.metrics.lastLogTime >= interval) {
      this.sendStatistics();
      this.metrics.lastLogTime = currentTime;
    }
  }

  sendStatistics() {
    // Mobile-optimized statistics calculation
    let avgProcessingTime = this.metrics.workletProcessingMs;

    if (!this.isMobile && this.metrics.processingTimes.length > 0) {
      avgProcessingTime =
        this.metrics.processingTimes.reduce((a, b) => a + b, 0) /
        this.metrics.processingTimes.length;
    }

    const stats = {
      type: "stats",
      bufferQueue: this.audioBuffer.size(),
      bufferDropped: this.metrics.bufferDropped,
      workletProcessingMs: avgProcessingTime,
      workerProcessingMs: this.metrics.workerProcessingMs,
      model1ProcessingMs: this.metrics.model1ProcessingMs,
      model2ProcessingMs: this.metrics.model2ProcessingMs,
      maxWorkletProcessingMs: this.metrics.maxProcessingTime,
      timestamp: currentTime,
      bufferHealth: {
        capacity: this.audioBuffer.capacity(),
        utilization: Math.round(
          (this.audioBuffer.size() / this.audioBuffer.capacity()) * 100
        ),
        upgraded: this.ringBufferUpgraded,
      },
    };

    // Add mobile-specific metrics
    if (this.isMobile) {
      stats.mobileMetrics = {
        frameSkipInterval: this.frameSkipInterval,
        performanceMode: this.performanceMode,
        processedFrames: this.processFrameCount,
      };
    }

    this.port.postMessage(stats);
  }
}

registerProcessor("dtln-audio-processor", DTLNAudioProcessor);
