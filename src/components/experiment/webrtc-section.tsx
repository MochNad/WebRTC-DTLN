"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneCall } from "lucide-react";
import { StatusIndicator } from "./status-indicator";

interface WebRTCSectionProps {
  createCall: (inputRef: HTMLInputElement | null) => Promise<string | null>;
  joinCall: (callId: string) => Promise<boolean>;
  localStatus: string;
  remoteStatus: string;
  isCallActive: boolean;
  isSystemReady: boolean;
}

export function WebRTCSection({
  createCall,
  joinCall,
  localStatus,
  remoteStatus,
  isCallActive,
  isSystemReady,
}: WebRTCSectionProps) {
  const [callInputValue, setCallInputValue] = useState<string>("");
  const [generatedCallId, setGeneratedCallId] = useState<string>("");
  const [showCopyFeedback, setShowCopyFeedback] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");
  const callInputRef = useRef<HTMLInputElement>(null);

  const handleWebRTC = useCallback(async () => {
    if (callInputValue.trim() === "") {
      const callId = await createCall(callInputRef.current);
      if (callId) {
        setGeneratedCallId(callId);
        setCallInputValue(callId);
        // Status is updated in createCall hook after successful creation
      }
    } else {
      setValidationError(""); // Clear any previous errors
      const success = await joinCall(callInputValue);
      if (!success) {
        setValidationError("Kode tidak ditemukan");
        setTimeout(() => setValidationError(""), 3000);
      }
    }
  }, [callInputValue, createCall, joinCall]);

  const handleInputClick = useCallback(async () => {
    if (generatedCallId && callInputValue === generatedCallId) {
      try {
        await navigator.clipboard.writeText(generatedCallId);
        setShowCopyFeedback(true);
        setTimeout(() => setShowCopyFeedback(false), 2000);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
      }
    }
  }, [generatedCallId, callInputValue]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow changes if it's not a generated call ID or if call is not active
      if (
        !(generatedCallId && callInputValue === generatedCallId) &&
        !isCallActive
      ) {
        setCallInputValue(e.target.value);
      }
    },
    [generatedCallId, callInputValue, isCallActive]
  );

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WebRTC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 flex-grow relative">
              <Input
                placeholder="Kode"
                className={`w-full ${
                  generatedCallId && callInputValue === generatedCallId
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    : ""
                }`}
                ref={callInputRef}
                value={callInputValue}
                onChange={handleInputChange}
                onClick={handleInputClick}
                disabled={
                  !isSystemReady &&
                  !(generatedCallId && callInputValue === generatedCallId)
                }
                readOnly={
                  (!!generatedCallId && callInputValue === generatedCallId) ||
                  (isCallActive &&
                    !(generatedCallId && callInputValue === generatedCallId))
                }
              />
              {showCopyFeedback && (
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black text-xs px-2 py-1 rounded z-10">
                  Disalin!
                </div>
              )}
              {validationError && (
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 dark:bg-red-700 text-white text-xs px-2 py-1 rounded z-10">
                  {validationError}
                </div>
              )}
            </div>
            <div>
              <Button
                variant="default"
                onClick={handleWebRTC}
                disabled={isCallActive || !isSystemReady}
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
