"use client";

import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface NoiseDatasetItem {
  file: string;
  size: string;
  downloadUrl: string;
}

interface NoiseDatasetTableProps {
  title: string;
  data: NoiseDatasetItem[];
}

export const NoiseDatasetTable: React.FC<NoiseDatasetTableProps> = ({
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
              <TableHead className="font-semibold">File</TableHead>
              <TableHead className="font-semibold w-32 text-center">
                Ukuran
              </TableHead>
              <TableHead className="font-semibold w-32 text-center">
                Download
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.file}</TableCell>
                <TableCell className="text-center">{item.size}</TableCell>
                <TableCell className="text-center">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
