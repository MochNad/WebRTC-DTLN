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
      // Add tracks from the first stream to our remote stream
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          // Remove existing tracks of the same kind to avoid duplicates
          const existingTracks = newRemoteStream
            .getTracks()
            .filter((t) => t.kind === track.kind);
          existingTracks.forEach((existingTrack) => {
            newRemoteStream.removeTrack(existingTrack);
          });

          newRemoteStream.addTrack(track);
        });
      }

      setState((prev) => ({
        ...prev,
        remoteStatus: "Terhubung",
      }));
    };
  }, []);

  const createCall = async (
    callInput: HTMLInputElement | null,
    localStreamToSend: MediaStream | null = null
  ) => {
    if (!state.pc) return null;

    // Create call document first to get ID immediately
    const callDoc = firestore.collection("calls").doc();
    const callId = callDoc.id;

    // Set the call ID in input immediately
    if (callInput) {
      callInput.value = callId;
    }

    // Add local stream tracks to peer connection
    if (localStreamToSend) {
      const tracks = localStreamToSend.getTracks();

      tracks.forEach((track) => {
        state.pc?.addTrack(track, localStreamToSend);
      });
    }

    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

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

    // Update status after call is successfully created
    setState((prev) => ({
      ...prev,
      isCallActive: true,
      localStatus: "Terhubung",
      remoteStatus: "Menunggu...",
    }));

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

    return callId;
  };

  const joinCall = async (
    callId: string,
    localStreamToSend: MediaStream | null = null
  ) => {
    if (!state.pc || !callId) return false;

    // Validate callId format and existence
    if (!callId.trim()) {
      return false;
    }

    try {
      const callDoc = firestore.collection("calls").doc(callId);
      const callSnapshot = await callDoc.get();

      // Check if call document exists
      if (!callSnapshot.exists) {
        return false;
      }

      const callData = callSnapshot.data();

      // Check if call has valid offer
      if (!callData || !callData.offer) {
        return false;
      }

      // Only update status after validation passes
      setState((prev) => ({
        ...prev,
        isCallActive: true,
        localStatus: "Terhubung",
        remoteStatus: "Terhubung",
      }));

      // Add local stream tracks to peer connection
      if (localStreamToSend) {
        const tracks = localStreamToSend.getTracks();

        tracks.forEach((track) => {
          state.pc?.addTrack(track, localStreamToSend);
        });
      }

      const answerCandidates = callDoc.collection("answerCandidates");
      const offerCandidates = callDoc.collection("offerCandidates");

      state.pc.onicecandidate = (event) => {
        if (event.candidate) {
          answerCandidates.add(event.candidate.toJSON());
        }
      };

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
    } catch (error) {
      console.error("Error joining call:", error);
      setState((prev) => ({
        ...prev,
        isCallActive: false,
        localStatus: "Terputus",
        remoteStatus: "Terputus",
      }));
      return false;
    }
  };

  return {
    ...state,
    createCall,
    joinCall,
  };
};
