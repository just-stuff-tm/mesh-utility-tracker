import { Bluetooth, BluetoothOff, Play, Pause, Radio, Signal, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBluetoothContext, type ScanStatus } from "@/lib/bluetooth-context";

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function scanStatusLabel(status: ScanStatus): string {
  switch (status) {
    case "advertising": return "Advertising";
    case "waiting": return "Listening";
    case "querying": return "Querying";
    case "submitting": return "Saving";
    case "done": return "Complete";
    case "error": return "Error";
    default: return "Idle";
  }
}

function scanStatusColor(status: ScanStatus): string {
  switch (status) {
    case "advertising":
    case "waiting":
    case "querying":
    case "submitting":
      return "text-blue-400";
    case "done":
      return "text-emerald-400";
    case "error":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

export function MapHud() {
  const {
    connected,
    deviceName,
    selfInfo,
    isScanning,
    scanStatus,
    nextScanCountdown,
    lastScanResult,
    toggleScan,
    batteryMilliVolts,
  } = useBluetoothContext();

  const radioName = selfInfo?.name || deviceName || "Unknown";
  const batteryV = batteryMilliVolts ? (batteryMilliVolts / 1000).toFixed(2) : null;
  const isActive = scanStatus !== "idle" && scanStatus !== "done" && scanStatus !== "error";

  return (
    <div
      className="bg-background/85 dark:bg-card/85 backdrop-blur-md rounded-md border border-border text-xs"
      data-testid="map-hud"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        {connected ? (
          <Bluetooth className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        ) : (
          <BluetoothOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="font-semibold truncate" data-testid="text-radio-name">
          {connected ? radioName : "Disconnected"}
        </span>
        {connected && batteryV && (
          <Badge variant="secondary" className="ml-auto text-[10px] shrink-0" data-testid="text-battery">
            {batteryV}V
          </Badge>
        )}
      </div>

      {connected && (
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {isScanning ? (
                isActive ? (
                  <span className={scanStatusColor(scanStatus)} data-testid="text-scan-status">
                    {scanStatusLabel(scanStatus)}...
                  </span>
                ) : (
                  <span className="text-muted-foreground" data-testid="text-scan-countdown">
                    Next: {formatCountdown(nextScanCountdown)}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">Scanning paused</span>
              )}
            </div>
            <Button
              size="icon"
              variant={isScanning ? "default" : "secondary"}
              className="h-7 w-7"
              onClick={toggleScan}
              data-testid="button-toggle-scan"
            >
              {isScanning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {lastScanResult && (
            <div className="border-t border-border pt-2 space-y-1" data-testid="section-last-scan">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Last Scan
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <Radio className="h-3 w-3 text-muted-foreground" />
                  <span data-testid="text-repeaters-found">{lastScanResult.repeatersFound} found</span>
                </div>
                <div className="flex items-center gap-1">
                  <Signal className="h-3 w-3 text-muted-foreground" />
                  <span data-testid="text-stats-submitted">{lastScanResult.repeatersWithStats} with stats</span>
                </div>
              </div>
              {lastScanResult.errorMessage && (
                <div className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="truncate">{lastScanResult.errorMessage}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {lastScanResult.timestamp.toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
