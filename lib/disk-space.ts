import { statfs } from "node:fs/promises";
import path from "node:path";

import { getUploadsRoot } from "./uploads.ts";

export const diskSpaceWarningThresholds = [20, 10, 5] as const;

export type DiskSpaceSummary = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercent: number;
  usedPercent: number;
};

function getDiskCheckPath() {
  return path.dirname(getUploadsRoot());
}

export async function getDiskSpaceSummary(): Promise<DiskSpaceSummary | null> {
  try {
    const stats = await statfs(getDiskCheckPath());
    const totalBytes = Number(stats.bsize) * Number(stats.blocks);
    const freeBytes = Number(stats.bsize) * Number(stats.bavail);
    const usedBytes = Math.max(totalBytes - freeBytes, 0);
    const freePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      freePercent,
      usedPercent,
    };
  } catch {
    return null;
  }
}
