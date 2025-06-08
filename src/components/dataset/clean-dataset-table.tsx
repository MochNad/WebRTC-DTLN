"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface CleanDatasetItem {
  version: string;
  date: string;
  size: string;
  recordedHours: number;
  validatedHours: number;
  license: string;
  voiceCount: number;
  audioFormat: string;
}

interface CleanDatasetTableProps {
  title: string;
  data: CleanDatasetItem[];
}

export const CleanDatasetTable: React.FC<CleanDatasetTableProps> = ({
  title,
  data,
}) => {
  return (
    <div>
      <h4 className="text-lg font-semibold mb-3">{title}</h4>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Versi</TableHead>
              <TableHead className="font-semibold">Tanggal</TableHead>
              <TableHead className="font-semibold">Ukuran</TableHead>
              <TableHead className="font-semibold">Jam Terekam</TableHead>
              <TableHead className="font-semibold">Jam Tervalidasi</TableHead>
              <TableHead className="font-semibold">Lisensi</TableHead>
              <TableHead className="font-semibold">Jumlah Suara</TableHead>
              <TableHead className="font-semibold">Format Audio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.version}</TableCell>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.size}</TableCell>
                <TableCell>{item.recordedHours}</TableCell>
                <TableCell>{item.validatedHours}</TableCell>
                <TableCell>{item.license}</TableCell>
                <TableCell>{item.voiceCount}</TableCell>
                <TableCell>{item.audioFormat}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
