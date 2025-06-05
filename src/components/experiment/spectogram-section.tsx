"use client";

import { useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpectogramData {
  rawAudio: Float32Array;
  processedAudio: Float32Array;
  timestamp: number;
}

interface SpectogramSectionProps {
  spectogramData: SpectogramData | null;
  isProcessing: boolean;
}

export function SpectogramSection({
  spectogramData,
  isProcessing,
}: SpectogramSectionProps) {
  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectogramHistoryRef = useRef<{
    raw: Float32Array[];
    processed: Float32Array[];
  }>({ raw: [], processed: [] });

  // Store all spectogram data chunks during processing
  const spectogramStorageRef = useRef<{
    raw: Float32Array[];
    processed: Float32Array[];
  }>({ raw: [], processed: [] });

  // Track if we have completed data to show
  const hasCompletedDataRef = useRef<boolean>(false);

  const CANVAS_WIDTH = 512;
  const CANVAS_HEIGHT = 256;
  const MAX_FREQUENCY = 8000;
  const FFT_SIZE = 512;

  // Correct Plasma colormap (purple to yellow)
  const getPlasmaColor = (value: number): [number, number, number] => {
    // Normalize value to 0-1
    const t = Math.max(0, Math.min(1, value));

    // Correct plasma colormap: dark purple -> bright purple -> pink -> orange -> yellow
    let r, g, b;

    if (t < 0.13) {
      // Dark purple to purple
      const localT = t / 0.13;
      r = Math.round(13 + localT * 47); // 13 -> 60
      g = Math.round(8 + localT * 17); // 8 -> 25
      b = Math.round(135 + localT * 85); // 135 -> 220
    } else if (t < 0.25) {
      // Purple to magenta
      const localT = (t - 0.13) / 0.12;
      r = Math.round(60 + localT * 70); // 60 -> 130
      g = Math.round(25 + localT * 15); // 25 -> 40
      b = Math.round(220 + localT * 25); // 220 -> 245
    } else if (t < 0.5) {
      // Magenta to red
      const localT = (t - 0.25) / 0.25;
      r = Math.round(130 + localT * 100); // 130 -> 230
      g = Math.round(40 + localT * 40); // 40 -> 80
      b = Math.round(245 - localT * 180); // 245 -> 65
    } else if (t < 0.75) {
      // Red to orange
      const localT = (t - 0.5) / 0.25;
      r = Math.round(230 + localT * 25); // 230 -> 255
      g = Math.round(80 + localT * 100); // 80 -> 180
      b = Math.round(65 - localT * 40); // 65 -> 25
    } else {
      // Orange to yellow
      const localT = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round(180 + localT * 75); // 180 -> 255
      b = Math.round(25 - localT * 25); // 25 -> 0
    }

    return [r, g, b];
  };

  // Compute FFT for spectogram
  const computeFFT = (audioData: Float32Array): Float32Array => {
    // Simple FFT implementation using built-in functions
    const fftSize = Math.min(FFT_SIZE, audioData.length);
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);

    // Copy audio data and apply window function
    for (let i = 0; i < fftSize; i++) {
      const windowValue =
        0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)); // Hanning window
      real[i] = audioData[i] * windowValue;
      imag[i] = 0;
    }

    // Simple DFT (not optimized, but works for visualization)
    const magnitude = new Float32Array(fftSize / 2);
    for (let k = 0; k < fftSize / 2; k++) {
      let realSum = 0;
      let imagSum = 0;

      for (let n = 0; n < fftSize; n++) {
        const angle = (-2 * Math.PI * k * n) / fftSize;
        realSum += real[n] * Math.cos(angle) - imag[n] * Math.sin(angle);
        imagSum += real[n] * Math.sin(angle) + imag[n] * Math.cos(angle);
      }

      magnitude[k] = Math.sqrt(realSum * realSum + imagSum * imagSum);
    }

    return magnitude;
  };

  // Optimized spectogram drawing with better performance - NO LABELS
  const drawSpectogram = useCallback(
    (canvas: HTMLCanvasElement, history: Float32Array[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx || history.length === 0) return;

      // Get existing image data for shifting
      const existingImageData = ctx.getImageData(
        0,
        0,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
      const existingData = existingImageData.data;

      // Create new image data for the updated spectrogram
      const newImageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
      const newData = newImageData.data;

      // Optimized pixel shifting - shift left by 3 pixels for faster movement
      const shiftPixels = 3;
      for (let y = 0; y < CANVAS_HEIGHT; y++) {
        for (let x = 0; x < CANVAS_WIDTH - shiftPixels; x++) {
          const srcIndex = (y * CANVAS_WIDTH + (x + shiftPixels)) * 4;
          const destIndex = (y * CANVAS_WIDTH + x) * 4;

          // Copy RGBA values
          newData[destIndex] = existingData[srcIndex];
          newData[destIndex + 1] = existingData[srcIndex + 1];
          newData[destIndex + 2] = existingData[srcIndex + 2];
          newData[destIndex + 3] = existingData[srcIndex + 3];
        }
      }

      // Add new spectrum data to the rightmost columns - FULL WIDTH
      if (history.length > 0) {
        const latestSpectrum = history[0];
        const maxBin = latestSpectrum.length;
        const binStep = maxBin / CANVAS_HEIGHT;

        // Fill the new columns on the right (full canvas width)
        for (let xOffset = 0; xOffset < shiftPixels; xOffset++) {
          const x = CANVAS_WIDTH - shiftPixels + xOffset;
          for (let y = 0; y < CANVAS_HEIGHT; y++) {
            // Map y coordinate to frequency bin (inverted for display)
            const binIndex = Math.floor((CANVAS_HEIGHT - 1 - y) * binStep);

            // Ensure we always have a value (fill gaps with interpolation)
            let magnitude = 0;
            if (binIndex < latestSpectrum.length) {
              magnitude = latestSpectrum[binIndex];
            } else if (binIndex > 0 && binIndex - 1 < latestSpectrum.length) {
              // Use previous bin if current is out of bounds
              magnitude = latestSpectrum[binIndex - 1];
            }

            // Normalize magnitude with better dynamic range
            const normalizedMag = Math.log10(1 + magnitude * 999) / 3;
            const [r, g, b] = getPlasmaColor(normalizedMag);

            const pixelIndex = (y * CANVAS_WIDTH + x) * 4;
            newData[pixelIndex] = r;
            newData[pixelIndex + 1] = g;
            newData[pixelIndex + 2] = b;
            newData[pixelIndex + 3] = 255;
          }
        }
      }

      // Single putImageData call for better performance - NO LABELS DRAWN
      ctx.putImageData(newImageData, 0, 0);
    },
    [CANVAS_WIDTH, CANVAS_HEIGHT]
  );

  // Draw complete compacted spectogram from all stored data
  const drawCompactedSpectogram = useCallback(
    (canvas: HTMLCanvasElement, allSpectrumData: Float32Array[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx || allSpectrumData.length === 0) return;

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Create image data for the complete spectrogram
      const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
      const data = imageData.data;

      const totalFrames = allSpectrumData.length;
      const framesPerPixel = Math.max(1, Math.ceil(totalFrames / CANVAS_WIDTH));

      // Process each column of the canvas
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        // Calculate which frames to average for this column
        const startFrame = Math.floor((x * totalFrames) / CANVAS_WIDTH);
        const endFrame = Math.min(startFrame + framesPerPixel, totalFrames);

        // Average spectrum data across frames for this column
        const avgSpectrum = new Float32Array(allSpectrumData[0].length);
        let frameCount = 0;

        for (let frameIdx = startFrame; frameIdx < endFrame; frameIdx++) {
          if (frameIdx < allSpectrumData.length) {
            const spectrum = allSpectrumData[frameIdx];
            for (let bin = 0; bin < spectrum.length; bin++) {
              avgSpectrum[bin] += spectrum[bin];
            }
            frameCount++;
          }
        }

        // Normalize the average
        if (frameCount > 0) {
          for (let bin = 0; bin < avgSpectrum.length; bin++) {
            avgSpectrum[bin] /= frameCount;
          }
        }

        // Draw this column
        const maxBin = avgSpectrum.length;
        const binStep = maxBin / CANVAS_HEIGHT;

        for (let y = 0; y < CANVAS_HEIGHT; y++) {
          // Map y coordinate to frequency bin (inverted for display)
          const binIndex = Math.floor((CANVAS_HEIGHT - 1 - y) * binStep);

          let magnitude = 0;
          if (binIndex < avgSpectrum.length) {
            magnitude = avgSpectrum[binIndex];
          } else if (binIndex > 0 && binIndex - 1 < avgSpectrum.length) {
            magnitude = avgSpectrum[binIndex - 1];
          }

          // Normalize magnitude with better dynamic range
          const normalizedMag = Math.log10(1 + magnitude * 999) / 3;
          const [r, g, b] = getPlasmaColor(normalizedMag);

          const pixelIndex = (y * CANVAS_WIDTH + x) * 4;
          data[pixelIndex] = r;
          data[pixelIndex + 1] = g;
          data[pixelIndex + 2] = b;
          data[pixelIndex + 3] = 255;
        }
      }

      // Draw the complete compacted spectrogram
      ctx.putImageData(imageData, 0, 0);
    },
    [CANVAS_WIDTH, CANVAS_HEIGHT]
  );

  // Modified clear behavior - properly reset for new files
  useEffect(() => {
    if (isProcessing) {
      // Starting new processing - always clear for fresh start
      spectogramHistoryRef.current.raw = [];
      spectogramHistoryRef.current.processed = [];
      spectogramStorageRef.current.raw = [];
      spectogramStorageRef.current.processed = [];
      hasCompletedDataRef.current = false;

      if (rawCanvasRef.current) {
        const ctx = rawCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      if (processedCanvasRef.current) {
        const ctx = processedCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (!isProcessing && spectogramStorageRef.current.raw.length > 0) {
      // Processing finished - draw complete compacted spectogram
      hasCompletedDataRef.current = true;

      if (rawCanvasRef.current) {
        drawCompactedSpectogram(
          rawCanvasRef.current,
          spectogramStorageRef.current.raw
        );
      }
      if (processedCanvasRef.current) {
        drawCompactedSpectogram(
          processedCanvasRef.current,
          spectogramStorageRef.current.processed
        );
      }
    }
  }, [isProcessing, drawCompactedSpectogram]);

  // Clear spectogram data when no data is available
  useEffect(() => {
    if (!spectogramData && !isProcessing && !hasCompletedDataRef.current) {
      // Clear canvases when there's no data and not processing
      if (rawCanvasRef.current) {
        const ctx = rawCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      if (processedCanvasRef.current) {
        const ctx = processedCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Clear history and storage
      spectogramHistoryRef.current.raw = [];
      spectogramHistoryRef.current.processed = [];
      spectogramStorageRef.current.raw = [];
      spectogramStorageRef.current.processed = [];
    }
  }, [spectogramData, isProcessing]);

  // Update spectogram with new data - Store all data during processing
  useEffect(() => {
    if (!spectogramData || !isProcessing) return;

    const { rawAudio, processedAudio } = spectogramData;

    // Compute FFT for both signals
    const rawSpectrum = computeFFT(rawAudio);
    const processedSpectrum = computeFFT(processedAudio);

    // Store all data chunks during processing
    spectogramStorageRef.current.raw.push(rawSpectrum);
    spectogramStorageRef.current.processed.push(processedSpectrum);

    // Keep only the latest spectrum for real-time display during processing
    spectogramHistoryRef.current.raw = [rawSpectrum];
    spectogramHistoryRef.current.processed = [processedSpectrum];

    // Draw spectograms immediately for real-time feedback (scrolling effect during processing)
    if (rawCanvasRef.current && hasCompletedDataRef.current === false) {
      drawSpectogram(rawCanvasRef.current, spectogramHistoryRef.current.raw);
    }
    if (processedCanvasRef.current && hasCompletedDataRef.current === false) {
      drawSpectogram(
        processedCanvasRef.current,
        spectogramHistoryRef.current.processed
      );
    }
  }, [spectogramData, isProcessing, drawSpectogram]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Audio Sebelum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full">
            <canvas
              ref={rawCanvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-auto rounded bg-black block"
              style={{ width: "100%", height: "auto" }}
            />
            {/* Static Frequency Labels Overlay - 1-7 kHz */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
              {[1000, 2000, 3000, 4000, 5000, 6000, 7000].map((freq) => {
                // Calculate position based on frequency ratio
                const frequencyRatio = freq / MAX_FREQUENCY;
                const yPosition = (1 - frequencyRatio) * 100; // Invert for bottom-up frequency
                const text = `${freq / 1000}kHz`;

                return (
                  <div
                    key={freq}
                    className="absolute text-white font-mono select-none"
                    style={{
                      top: `${yPosition}%`,
                      left: "6px",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                      transform: "translateY(-50%)",
                      fontSize: "11px",
                      fontWeight: "500",
                      zIndex: 10,
                    }}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio Sesudah</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full">
            <canvas
              ref={processedCanvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-auto rounded bg-black block"
              style={{ width: "100%", height: "auto" }}
            />
            {/* Static Frequency Labels Overlay - 1-7 kHz */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
              {[1000, 2000, 3000, 4000, 5000, 6000, 7000].map((freq) => {
                // Calculate position based on frequency ratio
                const frequencyRatio = freq / MAX_FREQUENCY;
                const yPosition = (1 - frequencyRatio) * 100; // Invert for bottom-up frequency
                const text = `${freq / 1000}kHz`;

                return (
                  <div
                    key={freq}
                    className="absolute text-white font-mono select-none"
                    style={{
                      top: `${yPosition}%`,
                      left: "6px",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                      transform: "translateY(-50%)",
                      fontSize: "11px",
                      fontWeight: "500",
                      zIndex: 10,
                    }}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
