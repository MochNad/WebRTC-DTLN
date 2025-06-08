"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface FormatSectionProps {
  className?: string;
}

const formatRequirements = [
  {
    datasetType: "Clean",
    format: "WAV",
    channels: "Mono",
    sampleRate: "16 kHz",
    total: "20 Audio"
  },
  {
    datasetType: "Noise",
    format: "WAV",
    channels: "Mono",
    sampleRate: "16 kHz",
    total: "17 Audio"
  },
];

const FormatSection: React.FC<FormatSectionProps> = ({ className }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Kebutuhan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-6">
              Audio clean dan noise harus memenuhi standar.
            </p>

            <div className="space-y-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">
                        Dataset
                      </TableHead>
                      <TableHead className="font-semibold">Format</TableHead>
                      <TableHead className="font-semibold">Channel</TableHead>
                      <TableHead className="font-semibold">
                        Sample Rate
                      </TableHead>
                      <TableHead className="font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formatRequirements.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.datasetType}</TableCell>
                        <TableCell>{item.format}</TableCell>
                        <TableCell>{item.channels}</TableCell>
                        <TableCell>{item.sampleRate}</TableCell>
                        <TableCell>{item.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormatSection;
