"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneCall } from "lucide-react";

interface WebRTCSectionProps {
  createCall: (inputRef: HTMLInputElement | null) => Promise<string | null>;
  joinCall: (callId: string) => Promise<boolean>;
  localStatus: string;
  remoteStatus: string;
  isCallActive: boolean;
}

const StatusIndicator = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "terhubung":
        return "bg-green-500"; // Green for connected
      case "menunggu...":
        return "bg-yellow-500"; // Yellow for waiting
      case "terputus":
        return "bg-red-500"; // Red for disconnected
      case "tersedia":
        return "bg-green-500"; // Green for available
      case "memuat...":
        return "bg-blue-500"; // Blue for loading
      case "error":
        return "bg-red-500"; // Red for error
      default:
        return "bg-gray-500"; // Gray for unknown status
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="text-sm font-medium">{status}</span>
    </div>
  );
};

export function WebRTCSection({
  createCall,
  joinCall,
  localStatus,
  remoteStatus,
  isCallActive,
}: WebRTCSectionProps) {
  const [callInputValue, setCallInputValue] = useState<string>("");
  const callInputRef = useRef<HTMLInputElement>(null);

  const handleWebRTC = useCallback(async () => {
    if (callInputValue.trim() === "") {
      await createCall(callInputRef.current);
    } else {
      await joinCall(callInputValue);
    }
  }, [callInputValue, createCall, joinCall]);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Panggilan WebRTC</CardTitle>
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
                <PhoneCall />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Local</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusIndicator status={localStatus} />
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Remote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusIndicator status={remoteStatus} />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
