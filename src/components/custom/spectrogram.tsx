import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

const AudioVisualizer = () => {
    const waveformRef = useRef(null);
    const [waveSurfer, setWaveSurfer] = useState<WaveSurfer | null>(null);

    useEffect(() => {
        // Initialize WaveSurfer instance
        if (waveformRef.current) {
            const ws = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: "#4FBEE6",
                progressColor: "#208EAD",
                cursorColor: "#FF0000",
                barWidth: 2,
                barGap: 1,
                height: 100,
            });

            setWaveSurfer(ws);

            // Cleanup on unmount
            return () => {
                ws.destroy();
            };
            // Cleanup on unmount
            return () => {
                ws.destroy();
            };
            setWaveSurfer(ws);
        }
    }, []);

    const startMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);

            // Connect the media stream to WaveSurfer
            waveSurfer.loadDecodedBuffer(audioContext.createBuffer(1, 4096, audioContext.sampleRate));
            waveSurfer.microphone.init();
            waveSurfer.microphone.connect(source);
        } catch (err) {
            console.error("Microphone access error:", err);
        }
    };

    return (
        <div>
            <h2>Audio Visualizer with WaveSurfer.js</h2>
            <div ref={waveformRef} style={{ width: "100%", height: "100px" }} />
            <button onClick={startMicrophone}>Start Microphone</button>
        </div>
    );
};

export default AudioVisualizer;
