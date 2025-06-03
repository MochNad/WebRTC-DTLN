/**
 * Audio Worker - DTLN Implementation with RingBuffer
 */

importScripts(
  "/libraries/onnxruntime-web-1.22.0/package/dist/ort.min.js",
  "/libraries/fft.js-4.0.4/package/lib/fft.umd.js",
  "/libraries/ringbufferjs-2.0.0/package/index.umd.js"
);

class DTLNConfig {
  static get BLOCK_LEN() {
    return 512;
  }
  static get BLOCK_SHIFT() {
    return 128;
  }
  static get TARGET_SAMPLE_RATE() {
    return 16000;
  }
  static get MODEL_1_PATH() {
    return "/models/dtln_model_1.onnx";
  }
  static get MODEL_2_PATH() {
    return "/models/dtln_model_2.onnx";
  }
  // Add missing buffer capacity constants
  static get INPUT_BUFFER_CAPACITY() {
    return 50;
  }
  static get OUTPUT_BUFFER_CAPACITY() {
    return 50;
  }
  static get PROCESSING_QUEUE_CAPACITY() {
    return 30;
  }
}

class ModelManager {
  constructor() {
    this.model1 = null;
    this.model2 = null;
    this.inputs1 = null;
    this.inputs2 = null;
    this.model1ProcessingTime = 0;
    this.model2ProcessingTime = 0;
  }

  async initialize() {
    try {
      await this.configureONNXRuntime();
      await this.validateModelFiles();
      await this.loadModels();
      await this.prepareModelInputs();
      await this.validateModels();
      return true;
    } catch (error) {
      console.error("Model initialization failed:", error);
      return false;
    }
  }

  async configureONNXRuntime() {
    if (typeof ort === "undefined") {
      throw new Error("ONNX Runtime not loaded");
    }

    const WASM_BASE_PATH = "/libraries/onnxruntime-web-1.22.0/package/dist/";
    ort.env.wasm = {
      wasmPaths: WASM_BASE_PATH,
      simd: true,
      numThreads: 1,
    };
  }

  async validateModelFiles() {
    const [response1, response2] = await Promise.all([
      fetch(DTLNConfig.MODEL_1_PATH),
      fetch(DTLNConfig.MODEL_2_PATH),
    ]);

    if (!response1.ok || !response2.ok) {
      throw new Error("Model files not found");
    }
  }

  async loadModels() {
    const sessionOptions = {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: "sequential",
    };

    [this.model1, this.model2] = await Promise.all([
      ort.InferenceSession.create(DTLNConfig.MODEL_1_PATH, sessionOptions),
      ort.InferenceSession.create(DTLNConfig.MODEL_2_PATH, sessionOptions),
    ]);
  }

  createModelInputs(model, isFrequencyDomain) {
    const inputs = {};
    const inputNames = model.inputNames;

    inputNames.forEach((name, index) => {
      if (index === 0) {
        const inputSize = isFrequencyDomain ? 257 : DTLNConfig.BLOCK_LEN;
        inputs[name] = new ort.Tensor("float32", new Float32Array(inputSize), [
          1,
          1,
          inputSize,
        ]);
      } else {
        inputs[name] = new ort.Tensor(
          "float32",
          new Float32Array(512),
          [1, 2, 128, 2]
        );
      }
    });

    return inputs;
  }

  async prepareModelInputs() {
    this.inputs1 = this.createModelInputs(this.model1, true);
    this.inputs2 = this.createModelInputs(this.model2, false);
  }

  async validateModels() {
    await this.model1.run(this.inputs1);
    await this.model2.run(this.inputs2);
  }

  async runModel1(magnitudeData) {
    const startTime = performance.now();

    const inputName = this.model1.inputNames[0];
    this.inputs1[inputName] = new ort.Tensor("float32", magnitudeData, [
      1,
      1,
      magnitudeData.length,
    ]);

    const outputs = await this.model1.run(this.inputs1);
    this.updateLSTMStates(this.model1, this.inputs1, outputs);

    this.model1ProcessingTime = performance.now() - startTime;
    return outputs[this.model1.outputNames[0]].data;
  }

  async runModel2(timeData) {
    const startTime = performance.now();

    const inputName = this.model2.inputNames[0];
    this.inputs2[inputName] = new ort.Tensor("float32", timeData, [
      1,
      1,
      timeData.length,
    ]);

    const outputs = await this.model2.run(this.inputs2);
    this.updateLSTMStates(this.model2, this.inputs2, outputs);

    this.model2ProcessingTime = performance.now() - startTime;
    return outputs[this.model2.outputNames[0]].data;
  }

  updateLSTMStates(model, inputs, outputs) {
    const outputNames = model.outputNames;
    const inputNames = model.inputNames;

    if (outputNames.length > 1 && inputNames.length > 1) {
      inputs[inputNames[1]] = outputs[outputNames[1]];
    }
  }
}

class AudioProcessor {
  constructor() {
    this.fft = new FFT(DTLNConfig.BLOCK_LEN);
    this.inputBuffer = new Float32Array(DTLNConfig.BLOCK_LEN);
    this.outputBuffer = new Float32Array(DTLNConfig.BLOCK_LEN);
    this.reset();
  }

  reset() {
    this.inputBuffer.fill(0);
    this.outputBuffer.fill(0);
  }

  computeFFT(timeData) {
    const inputComplex = this.fft.toComplexArray(timeData);
    const outputComplex = this.fft.createComplexArray();
    this.fft.transform(outputComplex, inputComplex);
    return outputComplex;
  }

  extractMagnitudeAndPhase(complexData) {
    const numBins = DTLNConfig.BLOCK_LEN / 2 + 1;
    const magnitude = new Float32Array(numBins);
    const phase = new Float32Array(numBins);

    for (let i = 0; i < numBins; i++) {
      const real = complexData[i * 2] || 0;
      const imag = complexData[i * 2 + 1] || 0;
      magnitude[i] = Math.sqrt(real * real + imag * imag);
      phase[i] = Math.atan2(imag, real);
    }

    return { magnitude, phase };
  }

  applyMaskAndReconstruct(magnitude, phase, mask) {
    const complexData = this.fft.createComplexArray();
    const numBins = magnitude.length;

    for (let i = 0; i < numBins; i++) {
      const maskedMag = magnitude[i] * mask[i];
      complexData[i * 2] = maskedMag * Math.cos(phase[i]);
      complexData[i * 2 + 1] = maskedMag * Math.sin(phase[i]);
    }

    this.fft.completeSpectrum(complexData);
    return complexData;
  }

  performIFFT(complexData) {
    const timeComplex = this.fft.createComplexArray();
    this.fft.inverseTransform(timeComplex, complexData);

    const timeData = new Float32Array(DTLNConfig.BLOCK_LEN);
    for (let i = 0; i < DTLNConfig.BLOCK_LEN; i++) {
      timeData[i] = timeComplex[i * 2];
    }

    return timeData;
  }
}

class DTLNProcessor {
  constructor() {
    this.modelManager = new ModelManager();
    this.audioProcessor = new AudioProcessor();
    this.isInitialized = false;
    this.model1ProcessingTime = 0;
    this.model2ProcessingTime = 0;
  }

  async initialize() {
    this.isInitialized = await this.modelManager.initialize();
    return this.isInitialized;
  }

  async processAudioBlock() {
    if (!this.isInitialized) {
      return new Float32Array(this.audioProcessor.inputBuffer);
    }

    try {
      const complexData = this.audioProcessor.computeFFT(
        this.audioProcessor.inputBuffer
      );
      const { magnitude, phase } =
        this.audioProcessor.extractMagnitudeAndPhase(complexData);

      const mask = await this.modelManager.runModel1(magnitude);
      this.model1ProcessingTime = this.modelManager.model1ProcessingTime;

      const reconstructed = this.audioProcessor.applyMaskAndReconstruct(
        magnitude,
        phase,
        mask
      );
      const timeData = this.audioProcessor.performIFFT(reconstructed);

      const output = await this.modelManager.runModel2(timeData);
      this.model2ProcessingTime = this.modelManager.model2ProcessingTime;

      return new Float32Array(output);
    } catch (error) {
      console.error("Error processing audio block:", error);
      return new Float32Array(this.audioProcessor.inputBuffer);
    }
  }

  async processInput(inputData) {
    if (!inputData || inputData.length === 0) return inputData;

    const blockSize = Math.min(DTLNConfig.BLOCK_SHIFT, inputData.length);

    this.shiftInputBuffer();
    this.addToInputBuffer(inputData, blockSize);

    const processedBlock = await this.processAudioBlock();
    this.updateOutputBuffer(processedBlock);

    return this.extractOutput(blockSize, inputData.length);
  }

  shiftInputBuffer() {
    this.audioProcessor.inputBuffer.set(
      this.audioProcessor.inputBuffer.subarray(DTLNConfig.BLOCK_SHIFT),
      0
    );
  }

  addToInputBuffer(inputData, blockSize) {
    if (blockSize > 0) {
      this.audioProcessor.inputBuffer.set(
        inputData.subarray(0, blockSize),
        DTLNConfig.BLOCK_LEN - DTLNConfig.BLOCK_SHIFT
      );
    }

    if (blockSize < DTLNConfig.BLOCK_SHIFT) {
      this.audioProcessor.inputBuffer.fill(
        0,
        DTLNConfig.BLOCK_LEN - DTLNConfig.BLOCK_SHIFT + blockSize
      );
    }
  }

  updateOutputBuffer(processedBlock) {
    this.audioProcessor.outputBuffer.set(
      this.audioProcessor.outputBuffer.subarray(DTLNConfig.BLOCK_SHIFT),
      0
    );
    this.audioProcessor.outputBuffer.fill(
      0,
      DTLNConfig.BLOCK_LEN - DTLNConfig.BLOCK_SHIFT
    );

    for (let i = 0; i < DTLNConfig.BLOCK_LEN; i++) {
      this.audioProcessor.outputBuffer[i] += processedBlock[i];
    }
  }

  extractOutput(blockSize, originalLength) {
    const output = new Float32Array(blockSize);
    output.set(this.audioProcessor.outputBuffer.subarray(0, blockSize));

    if (output.length !== originalLength) {
      const finalOutput = new Float32Array(originalLength);
      const copyLength = Math.min(output.length, originalLength);
      finalOutput.set(output.subarray(0, copyLength));
      return finalOutput;
    }

    return output;
  }
}

class WorkerController {
  constructor() {
    this.processor = new DTLNProcessor();
    this.isStreamEnded = false;
    this.droppedBufferCount = 0;

    this.initializeBuffers();
  }

  initializeBuffers() {
    this.inputBuffer = new RingBuffer(DTLNConfig.INPUT_BUFFER_CAPACITY, () => {
      this.droppedBufferCount++;
    });

    this.outputBuffer = new RingBuffer(
      DTLNConfig.OUTPUT_BUFFER_CAPACITY,
      () => {
        this.droppedBufferCount++;
      }
    );

    this.processingQueue = new RingBuffer(DTLNConfig.PROCESSING_QUEUE_CAPACITY);
  }

  async initialize() {
    const success = await this.processor.initialize();
    this.sendStatusMessage(success);
    return success;
  }

  async processAudio(data) {
    if (data.isEndOfStream) {
      await this.handleEndOfStream();
      return;
    }

    if (this.isStreamEnded) return;

    this.inputBuffer.enq({
      channels: data.channels,
      timestamp: performance.now(),
      debug: data.debug,
    });

    await this.processInputQueue();
  }

  async processInputQueue() {
    const batchSize = Math.min(5, this.inputBuffer.size());

    for (let i = 0; i < batchSize && !this.inputBuffer.isEmpty(); i++) {
      const audioData = this.inputBuffer.deq();
      await this.processAudioData(audioData);
    }

    this.sendAllProcessedAudio();
  }

  async processAudioData(audioData) {
    const startTime = performance.now();

    try {
      const processedChannels = await Promise.all(
        audioData.channels.map((channel) =>
          this.processor.processInput(channel)
        )
      );

      this.outputBuffer.enq({
        channels: processedChannels,
        workerProcessingTime: performance.now() - startTime,
        timestamp: performance.now(),
        originalDebug: audioData.debug,
      });
    } catch (error) {
      console.error("Error processing audio data:", error);
      this.sendFallbackAudio(audioData);
    }
  }

  sendAllProcessedAudio() {
    while (!this.outputBuffer.isEmpty()) {
      this.sendProcessedAudioFromBuffer();
    }
  }

  sendProcessedAudioFromBuffer() {
    const processedData = this.outputBuffer.deq();

    self.postMessage(
      {
        type: "processedAudio",
        channels: processedData.channels,
        debug: {
          dtlnInitialized: this.processor.isInitialized,
          // Send raw processing times without any rounding
          workerProcessingMs: processedData.workerProcessingTime, // Raw value
          model1ProcessingMs: this.processor.model1ProcessingTime || 0, // Raw value
          model2ProcessingMs: this.processor.model2ProcessingTime || 0, // Raw value
          inputBufferSize: this.inputBuffer.size(),
          outputBufferSize: this.outputBuffer.size(),
          droppedBuffers: this.droppedBufferCount,
          bufferHealth: this.getBufferHealth(),
          timestamp: performance.now(),
        },
      },
      processedData.channels.map((ch) => ch.buffer)
    );
  }

  getBufferHealth() {
    return {
      inputUtilization: Math.round(
        (this.inputBuffer.size() / this.inputBuffer.capacity()) * 100
      ),
      outputUtilization: Math.round(
        (this.outputBuffer.size() / this.outputBuffer.capacity()) * 100
      ),
      totalDropped: this.droppedBufferCount,
      status: this.droppedBufferCount > 10 ? "warning" : "good",
    };
  }

  async handleEndOfStream() {
    if (this.isStreamEnded) return;
    this.isStreamEnded = true;

    while (!this.inputBuffer.isEmpty()) {
      const audioData = this.inputBuffer.deq();
      await this.processAudioData(audioData);
    }

    this.sendAllProcessedAudio();

    self.postMessage({
      type: "processedAudio",
      channels: [],
      isEndOfStream: true,
      debug: {
        isEndOfStream: true,
        dtlnInitialized: this.processor.isInitialized,
        finalBufferHealth: this.getBufferHealth(),
      },
    });
  }

  resetMetrics() {
    this.isStreamEnded = false;
    this.droppedBufferCount = 0;

    [this.inputBuffer, this.outputBuffer, this.processingQueue].forEach(
      (buffer) => {
        while (!buffer.isEmpty()) buffer.deq();
      }
    );
  }

  sendFallbackAudio(originalData) {
    const fallbackChannels = originalData.channels.map((ch) => {
      const buffer = new Float32Array(ch.length);
      buffer.set(ch);
      return buffer;
    });

    self.postMessage(
      {
        type: "processedAudio",
        channels: fallbackChannels,
        debug: { isErrorRecovery: true },
      },
      fallbackChannels.map((ch) => ch.buffer)
    );
  }

  sendStatusMessage(initialized) {
    self.postMessage({
      type: "dtlnStatus",
      initialized: initialized,
      sampleRate: DTLNConfig.TARGET_SAMPLE_RATE,
    });
  }
}

const controller = new WorkerController();

self.onmessage = async function (event) {
  const { type, ...data } = event.data;

  switch (type) {
    case "processAudio":
      await controller.processAudio(data);
      break;
    case "init":
      await controller.initialize(data);
      break;
    case "resetMetrics":
      controller.resetMetrics();
      break;
    case "endOfStream":
      await controller.processAudio({ isEndOfStream: true });
      break;
  }
};

controller
  .initialize()
  .then((success) => {
    self.postMessage({
      type: "ready",
      dtlnInitialized: success,
    });
  })
  .catch(() => {
    self.postMessage({
      type: "ready",
      dtlnInitialized: false,
    });
  });
