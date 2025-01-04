"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Power, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dataset() {
  const [state, setState] = useState<"power" | "pause" | "play">("power");

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-16">
      <div className="mt-24 space-y-2 text-start">
        <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl">
          Dataset
        </h1>
        <h1 className="text-base text-muted-foreground">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Asperiores,
          pariatur.
        </h1>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Rekam</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-row gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setState(state === "power" ? "pause" : "power")}
            >
              <Power />
            </Button>
            {state === "pause" && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setState("play")}
              >
                <Pause />
              </Button>
            )}
            {state === "play" && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setState("pause")}
              >
                <Play />
              </Button>
            )}
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm text-muted-foreground">Recording..</span>
              </div>
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm text-muted-foreground">Durasi</span>
                <span className="text-sm text-muted-foreground">00:00:10</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Spectrum</CardTitle>
        </CardHeader>
        <CardContent>Berisi spectrum</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Form</CardTitle>
        </CardHeader>
        <CardContent>Berisi form</CardContent>
      </Card>
    </div>
  );
}
