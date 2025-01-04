import { useEffect, useState } from "react";
import { firestore } from "@/lib/firebase";

interface WebRTCState {
  pc: RTCPeerConnection | null;
  remoteStream: MediaStream | null;
  isCallActive: boolean;
  localStatus: string;
  remoteStatus: string;
}

export const useWebRTC = () => {
  const [state, setState] = useState<WebRTCState>({
    pc: null,
    remoteStream: null,
    isCallActive: false,
    localStatus: "Terputus",
    remoteStatus: "Terputus",
  });

  useEffect(() => {
    const newPc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    });

    const newRemoteStream = new MediaStream();

    setState((prev) => ({
      ...prev,
      pc: newPc,
      remoteStream: newRemoteStream,
    }));

    newPc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        newRemoteStream.addTrack(track);
      });
      setState((prev) => ({
        ...prev,
        remoteStatus: "Terhubung",
      }));
    };
  }, []);

  const setupAudioStream = async (
    localAudio: HTMLMediaElement | null,
    remoteAudio: HTMLAudioElement | null
  ) => {
    if (!state.pc) return;

    let stream: MediaStream | null = null;

    // Capture the audio stream from the local audio element (HTMLMediaElement)
    if (localAudio) {
      stream = (
        localAudio as HTMLMediaElement & { captureStream?: () => MediaStream }
      ).captureStream
        ? (
            localAudio as HTMLMediaElement & {
              captureStream: () => MediaStream;
            }
          ).captureStream()
        : (
            localAudio as HTMLMediaElement & {
              mozCaptureStream: () => MediaStream;
            }
          ).mozCaptureStream();
    }

    if (stream) {
      const audioContext = new AudioContext();

      // Log the captured stream before processing
      console.log("Captured stream:", stream);

      // Load the noise-suppression processor worklet
      await audioContext.audioWorklet.addModule(
        "/worklets/noise-suppression-processor.js"
      );

      // Create a new MediaStreamAudioSourceNode from the stream
      const source = audioContext.createMediaStreamSource(stream);

      // Log the source node created
      console.log("Created MediaStreamAudioSourceNode:", source);

      // Create an AudioWorkletNode to apply noise suppression processing
      const workletNode = new AudioWorkletNode(
        audioContext,
        "noise-suppression-processor"
      );

      // Connect the source node to the worklet node
      source.connect(workletNode);

      // Create a MediaStreamAudioDestinationNode to capture the output of the worklet node
      const destination = audioContext.createMediaStreamDestination();

      // Connect the worklet node to the destination node
      workletNode.connect(destination);

      // Log the worklet node's connection to the audio context
      console.log("Connected worklet node to destination node.");

      // Add the tracks from the processed stream to the RTCPeerConnection
      destination.stream.getTracks().forEach((track) => {
        console.log("Adding processed track to RTC connection:", track);
        state.pc?.addTrack(track, destination.stream);
      });

      // Handle incoming tracks for remote audio
      state.pc.ontrack = (event) => {
        if (remoteAudio) {
          remoteAudio.srcObject = event.streams[0];
        }
      };
    }
  };

  const createCall = async (callInput: HTMLInputElement | null) => {
    if (!state.pc) return null;

    setState((prev) => ({
      ...prev,
      isCallActive: true,
      localStatus: "Terhubung",
      remoteStatus: "Menunggu...",
    }));

    const callDoc = firestore.collection("calls").doc();
    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

    if (callInput) {
      callInput.value = callDoc.id;
    }

    state.pc.onicecandidate = (event) => {
      if (event.candidate) {
        offerCandidates.add(event.candidate.toJSON());
      }
    };

    const offerDescription = await state.pc.createOffer();
    await state.pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({ offer });

    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !state.pc?.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data.answer);
        state.pc?.setRemoteDescription(answerDescription);
        setState((prev) => ({
          ...prev,
          localStatus: "Terhubung",
          remoteStatus: "Terhubung",
        }));
      }
    });

    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          state.pc?.addIceCandidate(candidate);
        }
      });
    });

    return callDoc.id;
  };

  const joinCall = async (callId: string) => {
    if (!state.pc || !callId) return false;

    setState((prev) => ({
      ...prev,
      isCallActive: true,
      localStatus: "Terhubung",
      remoteStatus: "Terhubung",
    }));

    const callDoc = firestore.collection("calls").doc(callId);
    const answerCandidates = callDoc.collection("answerCandidates");
    const offerCandidates = callDoc.collection("offerCandidates");

    state.pc.onicecandidate = (event) => {
      if (event.candidate) {
        answerCandidates.add(event.candidate.toJSON());
      }
    };

    const callData = (await callDoc.get()).data();
    if (!callData) return false;

    const offerDescription = callData.offer;
    await state.pc.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          state.pc?.addIceCandidate(candidate);
        }
      });
    });

    return true;
  };

  return {
    ...state,
    setupAudioStream,
    createCall,
    joinCall,
  };
};
