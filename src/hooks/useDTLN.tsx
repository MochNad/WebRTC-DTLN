// hooks/useDTLN.ts
import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioData {
  audioBuffer: AudioBuffer;
  channelData: Float32Array;
  context: AudioContext;
}

export function useDTLN(audioUrl: string | null) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const processorNodeRef = useRef<AudioWorkletNode | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/onnx.worker.ts', import.meta.url));
    
    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'MODELS_LOADED') {
        setModelsLoaded(true);
      } else if (event.data.type === 'PROCESSED') {
        processorNodeRef.current?.port.postMessage({
          type: 'PROCESSED_BUFFER',
          buffer: event.data.buffer
        });
      }
    };

    workerRef.current.postMessage({ type: 'INIT' });

    return () => workerRef.current?.terminate();
  }, []);

  const loadAudio = useCallback(async (audioFile: string) => {
    try {
      setError(null);
      const context = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 44100
      });
      
      await context.audioWorklet.addModule('/audioProcessor.js');
      
      const response = await fetch(audioFile);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      
      // Efficient channel mixing
      const channelData = new Float32Array(audioBuffer.length);
      if (audioBuffer.numberOfChannels > 1) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = (left[i] + right[i]) * 0.5;
        }
      } else {
        channelData.set(audioBuffer.getChannelData(0));
      }

      setAudioContext(context);
      setAudioData({ audioBuffer, channelData, context });
    } catch (error) {
      console.error('Error loading audio:', error);
      setError('Failed to load audio file');
    }
  }, []);

  const stopProcessing = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }

    setIsPlaying(false);
    setIsProcessing(false);
  }, []);

  const startProcessing = useCallback(async () => {
    if (!audioContext || !audioData || !modelsLoaded) return;

    try {
      setError(null);
      const audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioData.audioBuffer;

      const processorNode = new AudioWorkletNode(audioContext, 'onnx-audio-processor', {
        processorOptions: {
          blockLen: 512,
          blockShift: 128
        },
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1
      });

      processorNode.port.onmessage = (event) => {
        if (event.data.type === 'AUDIO_BUFFER') {
          workerRef.current?.postMessage(
            { type: 'PROCESS', buffer: event.data.buffer },
            [event.data.buffer.buffer]
          );
        }
      };

      // Optimize audio graph
      audioSource.connect(processorNode);
      processorNode.connect(audioContext.destination);

      audioSource.start();
      setIsPlaying(true);
      setIsProcessing(true);

      audioSourceRef.current = audioSource;
      processorNodeRef.current = processorNode;

      audioSource.onended = () => {
        setIsPlaying(false);
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('Error starting processing:', error);
      setError('Failed to start audio processing');
      stopProcessing();
    }
  }, [audioContext, audioData, modelsLoaded, stopProcessing]);

  useEffect(() => {
    if (audioUrl) {
      loadAudio(audioUrl);
    }
  }, [audioUrl, loadAudio]);

  return {
    isProcessing,
    isPlaying,
    modelsLoaded,
    error,
    audioContext,
    audioData,
    startProcessing,
    stopProcessing
  };
}