"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "./status-indicator";

interface SystemVerificationSectionProps {
  workletStatus: string;
  workerStatus: string;
}

export const SystemVerificationSection: React.FC<
  SystemVerificationSectionProps
> = ({ workletStatus, workerStatus }) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Worklet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusIndicator status={workletStatus} />
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Worker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-row items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusIndicator status={workerStatus} />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
