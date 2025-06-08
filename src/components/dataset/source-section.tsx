"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CleanDatasetTable } from "./clean-dataset-table";
import { NoiseDatasetTable } from "./noise-dataset-table";

const cleanDatasets = {
  english: [
    {
      version: "Common Voice Delta Segment 21.0",
      date: "19/3/2025",
      size: "781,24 MB",
      recordedHours: 39,
      validatedHours: 21,
      license: "CC-0",
      voiceCount: 993,
      audioFormat: "MP3",
    },
  ],
  indonesian: [
    {
      version: "Common Voice Delta Segment 21.0",
      date: "19/3/2025",
      size: "6,39 MB",
      recordedHours: 1,
      validatedHours: 1,
      license: "CC-0",
      voiceCount: 22,
      audioFormat: "MP3",
    },
  ],
};

const noiseDatasets = {
  rumah: [
    {
      file: "DKITCHEN_16k.zip",
      size: "110.5 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/DKITCHEN_16k.zip?download=1",
    },
    {
      file: "DLIVING_16k.zip",
      size: "80.2 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/DLIVING_16k.zip?download=1",
    },
    {
      file: "DWASHING_16k.zip",
      size: "102.3 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/DWASHING_16k.zip?download=1",
    },
  ],
  alam: [
    {
      file: "NFIELD_16k.zip",
      size: "86.5 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/NFIELD_16k.zip?download=1",
    },
    {
      file: "NPARK_16k.zip",
      size: "86.0 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/NPARK_16k.zip?download=1",
    },
    {
      file: "NRIVER_16k.zip",
      size: "98.7 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/NRIVER_16k.zip?download=1",
    },
  ],
  kantor: [
    {
      file: "OHALLWAY_16k.zip",
      size: "77.9 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/OHALLWAY_16k.zip?download=1",
    },
    {
      file: "OMEETING_16k.zip",
      size: "82.7 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/OMEETING_16k.zip?download=1",
    },
    {
      file: "OOFFICE_16k.zip",
      size: "89.0 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/OOFFICE_16k.zip?download=1",
    },
  ],
  publik: [
    {
      file: "PCAFETER_16k.zip",
      size: "107.4 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/PCAFETER_16k.zip?download=1",
    },
    {
      file: "PRESTO_16k.zip",
      size: "111.3 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/PRESTO_16k.zip?download=1",
    },
    {
      file: "PSTATION_16k.zip",
      size: "119.4 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/PSTATION_16k.zip?download=1",
    },
  ],
  jalan: [
    {
      file: "SPSQUARE_16k.zip",
      size: "110.9 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/SPSQUARE_16k.zip?download=1",
    },
    {
      file: "STRAFFIC_16k.zip",
      size: "118.6 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/STRAFFIC_16k.zip?download=1",
    },
  ],
  transportasi: [
    {
      file: "TBUS_16k.zip",
      size: "128.9 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/TBUS_16k.zip?download=1",
    },
    {
      file: "TCAR_16k.zip",
      size: "130.0 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/TCAR_16k.zip?download=1",
    },
    {
      file: "TMETRO_16k.zip",
      size: "126.6 MB",
      downloadUrl:
        "https://zenodo.org/records/1227121/files/TMETRO_16k.zip?download=1",
    },
  ],
};

export const SourceSection: React.FC = () => {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Clean</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-6">
                Dataset clean berasal dari{" "}
                <a
                  href="https://commonvoice.mozilla.org/id/datasets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Mozilla Common Voice
                </a>
              </p>

              <div className="space-y-6">
                <CleanDatasetTable
                  title="Bahasa Inggris"
                  data={cleanDatasets.english}
                />
                <CleanDatasetTable
                  title="Bahasa Indonesia"
                  data={cleanDatasets.indonesian}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Noise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-6">
                Dataset noise berasal dari{" "}
                <a
                  href="https://zenodo.org/records/1227121#.XRKKxYhKiUk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  DEMAND
                </a>
              </p>

              <div className="space-y-6">
                <NoiseDatasetTable
                  title="Domestic"
                  data={noiseDatasets.rumah}
                />
                <NoiseDatasetTable title="Nature" data={noiseDatasets.alam} />
                <NoiseDatasetTable title="Office" data={noiseDatasets.kantor} />
                <NoiseDatasetTable title="Public" data={noiseDatasets.publik} />
                <NoiseDatasetTable title="Street" data={noiseDatasets.jalan} />
                <NoiseDatasetTable
                  title="Transportation"
                  data={noiseDatasets.transportasi}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
