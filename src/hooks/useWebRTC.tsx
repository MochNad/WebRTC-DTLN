import { useEffect, useState, useCallback } from "react";
import { firestore } from "@/lib/firebase";

interface WebRTCState {
  pc: RTCPeerConnection | null;
  remoteStream: MediaStream | null;
  isCallActive: boolean;
  localStatus: string;
  remoteStatus: string;
}

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export const useWebRTC = (onLog?: (log: LogEntry) => void) => {
  const [state, setState] = useState<WebRTCState>({
    pc: null,
    remoteStream: null,
    isCallActive: false,
    localStatus: "Terputus",
    remoteStatus: "Terputus",
  });

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

  useEffect(() => {
    addLog("WEBRTC", "Inisialisasi WebRTC PeerConnection...");

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

    addLog("SUCCESS", "WebRTC PeerConnection berhasil dibuat");

    setState((prev) => ({
      ...prev,
      pc: newPc,
      remoteStream: newRemoteStream,
    }));

    newPc.ontrack = (event) => {
      addLog("WEBRTC", "Menerima remote audio track");

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

      addLog("SUCCESS", "Remote audio berhasil terhubung");
    };

    newPc.oniceconnectionstatechange = () => {
      addLog("WEBRTC", `ICE connection state: ${newPc.iceConnectionState}`);
    };

    newPc.onconnectionstatechange = () => {
      addLog("WEBRTC", `Connection state: ${newPc.connectionState}`);
    };
  }, [addLog]);

  const createCall = async (
    callInput: HTMLInputElement | null,
    localStreamToSend: MediaStream | null = null
  ) => {
    if (!state.pc) return null;

    try {
      addLog("WEBRTC", "Membuat panggilan baru...");

      // Create call document first to get ID immediately
      const callDoc = firestore.collection("calls").doc();
      const callId = callDoc.id;

      addLog("WEBRTC", `Call ID dibuat: ${callId}`);

      // Set the call ID in input immediately
      if (callInput) {
        callInput.value = callId;
      }

      // Add local stream tracks to peer connection
      if (localStreamToSend) {
        const tracks = localStreamToSend.getTracks();
        addLog(
          "WEBRTC",
          `Menambahkan ${tracks.length} track ke peer connection`
        );

        tracks.forEach((track) => {
          state.pc?.addTrack(track, localStreamToSend);
        });

        addLog("SUCCESS", "Local stream berhasil ditambahkan");
      }

      const offerCandidates = callDoc.collection("offerCandidates");
      const answerCandidates = callDoc.collection("answerCandidates");

      state.pc.onicecandidate = (event) => {
        if (event.candidate) {
          offerCandidates.add(event.candidate.toJSON());
          addLog("WEBRTC", "ICE candidate ditambahkan");
        }
      };

      addLog("WEBRTC", "Membuat offer...");
      const offerDescription = await state.pc.createOffer();
      await state.pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDoc.set({ offer });
      addLog("SUCCESS", "Offer berhasil dibuat dan disimpan");

      // Update status after call is successfully created
      setState((prev) => ({
        ...prev,
        isCallActive: true,
        localStatus: "Terhubung",
        remoteStatus: "Menunggu...",
      }));

      addLog("WEBRTC", "Menunggu jawaban dari remote peer...");

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
          addLog("SUCCESS", "Answer diterima dan remote peer terhubung");
        }
      });

      answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            state.pc?.addIceCandidate(candidate);
            addLog("WEBRTC", "Answer ICE candidate diterima");
          }
        });
      });

      return callId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog("ERROR", `Gagal membuat panggilan: ${errorMsg}`);
      return null;
    }
  };

  const joinCall = async (
    callId: string,
    localStreamToSend: MediaStream | null = null
  ) => {
    if (!state.pc || !callId) return false;

    // Validate callId format and existence
    if (!callId.trim()) {
      addLog("ERROR", "Call ID tidak valid");
      return false;
    }

    try {
      addLog("WEBRTC", `Bergabung dengan panggilan: ${callId}`);

      const callDoc = firestore.collection("calls").doc(callId);
      const callSnapshot = await callDoc.get();

      // Check if call document exists
      if (!callSnapshot.exists) {
        addLog("ERROR", "Call ID tidak ditemukan");
        return false;
      }

      const callData = callSnapshot.data();

      // Check if call has valid offer
      if (!callData || !callData.offer) {
        addLog("ERROR", "Call tidak memiliki offer yang valid");
        return false;
      }

      addLog("SUCCESS", "Call ditemukan, memulai proses join...");

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
        addLog(
          "WEBRTC",
          `Menambahkan ${tracks.length} track ke peer connection`
        );

        tracks.forEach((track) => {
          state.pc?.addTrack(track, localStreamToSend);
        });

        addLog("SUCCESS", "Local stream berhasil ditambahkan");
      }

      const answerCandidates = callDoc.collection("answerCandidates");
      const offerCandidates = callDoc.collection("offerCandidates");

      state.pc.onicecandidate = (event) => {
        if (event.candidate) {
          answerCandidates.add(event.candidate.toJSON());
          addLog("WEBRTC", "ICE candidate ditambahkan");
        }
      };

      addLog("WEBRTC", "Menerima offer dan membuat answer...");
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
      addLog("SUCCESS", "Answer berhasil dibuat dan dikirim");

      offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            state.pc?.addIceCandidate(candidate);
            addLog("WEBRTC", "Offer ICE candidate diterima");
          }
        });
      });

      addLog("SUCCESS", "Berhasil bergabung dengan panggilan");
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog("ERROR", `Gagal bergabung panggilan: ${errorMsg}`);
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
