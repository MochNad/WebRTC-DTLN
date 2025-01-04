import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record";
import SpectrogramPlugin from "wavesurfer.js/dist/plugins/spectrogram";

export const useSpectrogramAndRecording = (
  audioElement: HTMLAudioElement | null,
  spectrogramContainer: HTMLElement | null
) => {
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (audioElement && spectrogramContainer) {
      // Inisialisasi WaveSurfer dengan plugin Spectrogram dan Record
      wavesurferRef.current = WaveSurfer.create({
        container: spectrogramContainer,
        backend: "MediaElement",
        media: audioElement,
        plugins: [
          SpectrogramPlugin.create({
            container: spectrogramContainer, // Kontainer untuk spektrogram
            labels: true, // Menambahkan label pada spektrum
          }),
          RecordPlugin.create({
            bufferSize: 4096, // Ukuran buffer untuk perekaman
            // Set plugin options sesuai kebutuhan Anda
          }),
        ],
      });

      // Mulai pemutaran audio saat audio di-play
      audioElement.onplay = () => {
        wavesurferRef.current?.play();
        wavesurferRef.current?.record(); // Mulai merekam
      };

      // Stop perekaman ketika audio berhenti
      audioElement.onpause = () => {
        wavesurferRef.current?.stop(); // Stop merekam saat audio di-pause
      };

      // Memastikan bahwa proses akan terus memperbarui tampilan spektrogram secara terus-menerus
      audioElement.ontimeupdate = () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.drawer.update();
        }
      };

      // Cleanup: Hapus instance WaveSurfer saat komponen di-unmount
      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
        }
      };
    }
  }, [audioElement, spectrogramContainer]);

  return wavesurferRef.current;
};