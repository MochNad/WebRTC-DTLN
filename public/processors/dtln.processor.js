/**
 * Audio Worklet Processor with RingBuffer management
 */

class DTLNAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.initializeRingBuffer(options);
    this.initializeBuffers(options);
    this.initializeMetrics();
    this.setupMessageHandling();
    this.sendInitializationMessage();
  }

  initializeRingBuffer() {
    if (typeof globalThis.RingBufferConstructor !== "undefined") {
      this.RingBuffer = globalThis.RingBufferConstructor;
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
    const capacity = options?.processorOptions?.bufferCapacity || 20;

    this.audioBuffer = new this.RingBuffer(capacity, () => {
      this.metrics.bufferDropped++;
    });

    this.isProcessingComplete = false;
    this.inputEnded = false;
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
      this.audioBuffer.enq({
        channels: data.channels,
        timestamp: currentTime,
      });

      this.updateWorkerMetrics(data.debug);
      this.metrics.bufferQueue = this.audioBuffer.size();
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

    while (!this.audioBuffer.isEmpty()) {
      this.audioBuffer.deq();
    }

    this.sendStatistics();
  }

  finalizeProcessing() {
    if (this.isProcessingComplete) return;
    this.isProcessingComplete = true;
    this.sendStatistics();
  }

  process(inputs, outputs) {
    const frameStartTime = this.getHighResTime();

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

    this.metrics.processingTimes.push(processingTime);
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift();
    }

    this.metrics.workletProcessingMs = processingTime;
    this.metrics.maxProcessingTime = Math.max(
      this.metrics.maxProcessingTime,
      processingTime
    );

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
    const interval = 1.0;
    if (currentTime - this.metrics.lastLogTime >= interval) {
      this.sendStatistics();
      this.metrics.lastLogTime = currentTime;
    }
  }

  sendStatistics() {
    const avgProcessingTime =
      this.metrics.processingTimes.length > 0
        ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) /
          this.metrics.processingTimes.length
        : 0;

    this.port.postMessage({
      type: "stats",
      bufferQueue: this.metrics.bufferQueue,
      bufferDropped: this.metrics.bufferDropped,
      workletProcessingMs: avgProcessingTime,
      workerProcessingMs: this.metrics.workerProcessingMs,
      model1ProcessingMs: this.metrics.model1ProcessingMs,
      model2ProcessingMs: this.metrics.model2ProcessingMs,
      maxWorkletProcessingMs: this.metrics.maxProcessingTime,
      timestamp: currentTime,
    });
  }
}

registerProcessor("dtln-audio-processor", DTLNAudioProcessor);
