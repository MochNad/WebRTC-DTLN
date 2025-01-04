"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBigRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function Experiment() {
  const {
    createCall,
    joinCall,
    localStatus,
    remoteStatus,
    isCallActive,
    setupAudioStream,
  } = useWebRTC();
  const [callInputValue, setCallInputValue] = useState<string>("");
  const callInputRef = useRef<HTMLInputElement>(null);
  const [localAudio, setLocalAudio] = useState<HTMLAudioElement | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLocalAudio(document.querySelector("#localAudio") as HTMLAudioElement);
    setRemoteAudio(document.querySelector("#remoteAudio") as HTMLAudioElement);
  }, []);

  const handleWebRTC = async () => {
    if (localAudio && remoteAudio) {
      setupAudioStream(localAudio, remoteAudio);
    }
    if (callInputValue.trim() === "") {
      await createCall(callInputRef.current);
    } else {
      await joinCall(callInputValue);
    }
  };

  return (
    <div className="px-4 py-4 md:px-8 md:py-8 lg:px-16 lg:py-16 space-y-8">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl">
          Eksperimen
        </h1>
        <h1 className="text-base text-muted-foreground">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Asperiores,
          pariatur.
        </h1>
      </div>
      <div className="space-y-4">
        <h1 className="text-md font-semibold leading-tight tracking-tight md:text-lg lg:text-xl">
          WebRTC
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 flex-grow">
                <Input
                  placeholder="Kode"
                  className="w-full"
                  ref={callInputRef}
                  onChange={(e) => setCallInputValue(e.target.value)}
                  disabled={isCallActive}
                />
              </div>
              <div>
                <Button
                  variant="default"
                  onClick={handleWebRTC}
                  disabled={isCallActive}
                  className="w-full"
                >
                  <ArrowBigRight />
                </Button>
              </div>
            </div>
            <audio id="localAudio" controls className="w-full">
              <source src="audio/test.wav" type="audio/wav" />
            </audio>
            <audio id="remoteAudio" autoPlay></audio>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4 md:flex-row">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Local</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm text-muted-foreground">
                  {localStatus}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Remote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm text-muted-foreground">
                  {remoteStatus}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-md font-semibold leading-tight tracking-tight md:text-lg lg:text-xl">
          DTLN
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
          </CardHeader>
          <CardContent></CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <h1 className="text-md font-semibold leading-tight tracking-tight md:text-lg lg:text-xl">
          Spectrogram
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Local</CardTitle>
          </CardHeader>
          <CardContent id="localSpectrogram">
            {/* Visualisasi spektrogram lokal */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Remote</CardTitle>
          </CardHeader>
          <CardContent id="remoteSpectrogram">
            {/* Visualisasi spektrogram remote */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
