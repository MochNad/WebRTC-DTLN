import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

interface FileNode {
  name: string;
  type: "file";
  url?: string;
  file_name: string;
  file_size: number;
  file_format: string;
  file_channel?: number;
  file_sample_rate?: number;
  file_duration?: number;
}

interface FolderNode {
  name: string;
  type: "folder";
  children: (FileNode | FolderNode)[];
}

function parseWavHeader(buffer: Buffer) {
  try {
    // WAV header parsing
    if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
    if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;

    const channels = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const byteRate = buffer.readUInt32LE(28);
    const fileSize = buffer.readUInt32LE(4) + 8;
    const duration = fileSize / byteRate;

    return { channels, sampleRate, duration };
  } catch {
    return null;
  }
}

function parseMp3Header(buffer: Buffer) {
  try {
    // Basic MP3 frame header parsing
    for (let i = 0; i < buffer.length - 4; i++) {
      if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
        const header = buffer.readUInt32BE(i);
        const version = (header >> 19) & 3;
        const sampleRate = (header >> 10) & 3;
        const channelMode = (header >> 6) & 3;

        const sampleRates =
          version === 3 ? [44100, 48000, 32000] : [22050, 24000, 16000];
        const channels = channelMode === 3 ? 1 : 2;

        return {
          channels,
          sampleRate: sampleRates[sampleRate] || 44100,
          duration: null, // Duration calculation is complex for MP3
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getBasicAudioInfo(filePath: string, stat: fs.Stats) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.parse(filePath).name;

  let channels: number | undefined;
  let sampleRate: number | undefined;
  let duration: number | undefined;

  try {
    // Read first 1KB of file for header analysis
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(1024);
    fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    if (ext === ".wav") {
      const wavInfo = parseWavHeader(buffer);
      if (wavInfo) {
        channels = wavInfo.channels;
        sampleRate = wavInfo.sampleRate;
        duration = wavInfo.duration;
      }
    } else if (ext === ".mp3") {
      const mp3Info = parseMp3Header(buffer);
      if (mp3Info) {
        channels = mp3Info.channels;
        sampleRate = mp3Info.sampleRate;
        duration = mp3Info.duration || undefined;
      }
    }
    // For .ogg and .m4a, we'll set default values as parsing is more complex
    else if (ext === ".ogg" || ext === ".m4a") {
      channels = 2; // Default stereo
      sampleRate = 44100; // Default sample rate
    }
  } catch (error) {
    console.warn(`Could not parse audio metadata for ${filePath}:`, error);
  }

  return {
    file_name: fileName,
    file_size: stat.size,
    file_format: ext.substring(1),
    file_channel: channels,
    file_sample_rate: sampleRate,
    file_duration: duration,
  };
}

function buildFolderStructure(dir: string, basePath: string = ""): FolderNode {
  const name = path.basename(dir);
  const children: (FileNode | FolderNode)[] = [];

  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      children.push(buildFolderStructure(fullPath, path.join(basePath, item)));
    } else {
      const ext = path.extname(item).toLowerCase();
      if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
        const audioInfo = getBasicAudioInfo(fullPath, stat);

        children.push({
          name: item,
          type: "file",
          url: `/audios/${path.join(basePath, item)}`.replace(/\\/g, "/"),
          ...audioInfo,
        });
      }
    }
  });

  return {
    name,
    type: "folder",
    children: children,
  };
}

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public/audios");

    const structure = buildFolderStructure(audioDir);

    return NextResponse.json({
      success: true,
      data: structure.children,
    });
  } catch (error) {
    console.error("Error reading directory:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read directory structure",
      },
      { status: 500 }
    );
  }
}
