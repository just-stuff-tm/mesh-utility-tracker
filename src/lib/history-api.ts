import type { RawScan } from "./scan-aggregator";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

/**
 * Stream history scans for a specific day.
 * Calls the onScan callback for each scan as they're parsed.
 */
export async function streamHistoryDay(
  day: string,
  onScan: (scan: RawScan) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${WORKER_URL}/history/${day}`, { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch history for ${day}: ${response.status}`);
    }

    const scans: RawScan[] = await response.json();
    
    for (const scan of scans) {
      if (signal?.aborted) {
        break;
      }
      onScan(scan);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Silently handle aborts
      return;
    }
    throw error;
  }
}

/**
 * Fetch the list of available history days.
 */
export async function listHistoryDays(): Promise<string[]> {
  const response = await fetch(`${WORKER_URL}/history`);

  if (!response.ok) {
    throw new Error(`Failed to list history days: ${response.status}`);
  }

  return response.json();
}
