import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

interface FileNode {
  name: string;
  type: 'file';
  url?: string;
}

interface FolderNode {
  name: string;
  type: 'folder';
  children: (FileNode | FolderNode)[];
}

function buildFolderStructure(dir: string, basePath: string = ''): FolderNode {
  const name = path.basename(dir);
  const children: (FileNode | FolderNode)[] = [];
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      children.push(buildFolderStructure(fullPath, path.join(basePath, item)));
    } else {
      const ext = path.extname(item).toLowerCase();
      if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        children.push({
          name: item,
          type: 'file',
          url: `/audios/${path.join(basePath, item)}`.replace(/\\/g, '/'),
        });
      }
    }
  });
  
  return {
    name,
    type: 'folder',
    children: children
  };
}

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public/audios");
    
    const structure = buildFolderStructure(audioDir);
    
    return NextResponse.json({
      success: true,
      data: structure.children
    });
    
  } catch (error) {
    console.error('Error reading directory:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to read directory structure'
    }, { status: 500 });
  }
}