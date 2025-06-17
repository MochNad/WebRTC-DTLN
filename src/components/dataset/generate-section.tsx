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

const generateTotal = [
  {
    language: "Inggris",
    clean: "10 Audio",
    noise: "17 Kategori",
    duration: "~5 detik",
    snr: "0 db, 5 db, -5 db, 10 db",
    total: "680 Audio (~56.6 menit)",
  },
  {
    language: "Indonesia",
    clean: "10 Audio",
    noise: "17 Kategori",
    duration: "~5 detik",
    snr: "0 db, 5 db, -5 db, 10 db",
    total: "680 Audio (~56.6 menit)",
  },
];

const GenerateSection: React.FC<FormatSectionProps> = ({ className }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Hasil</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-6">
              Total seluruh audio yang digunakan ada di{" "}
              <a
                href="https://github.com/MochNad/Dataset-DTLN"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Dataset-DTLN
              </a>
              .
            </p>

            <div className="space-y-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Bahasa</TableHead>
                      <TableHead className="font-semibold">Clean</TableHead>
                      <TableHead className="font-semibold">Noise</TableHead>
                      <TableHead className="font-semibold">Durasi</TableHead>
                      <TableHead className="font-semibold">SNR</TableHead>
                      <TableHead className="font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generateTotal.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.language}</TableCell>
                        <TableCell>{item.clean}</TableCell>
                        <TableCell>{item.noise}</TableCell>
                        <TableCell>{item.duration}</TableCell>
                        <TableCell>{item.snr}</TableCell>
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

export default GenerateSection;
