import { useState } from "react";
import { Play, Pause, Radio, Signal, Clock, AlertTriangle, Zap, Cpu, ChevronDown, ChevronUp, Mountain } from "lucide-react";
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
    case "advertising": return "Discovering";
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
    deviceInfo,
    isScanning,
    scanStatus,
    nextScanCountdown,
    lastScanResult,
    toggleScan,
    forceScan,
    batteryMilliVolts,
    smartScanEnabled,
    altitudeMeters,
    unitSystem,
  } = useBluetoothContext();

  const [expanded, setExpanded] = useState(true);

  const radioName = selfInfo?.name || deviceName || "Unknown";
  const batteryV = batteryMilliVolts ? (batteryMilliVolts / 1000).toFixed(2) : null;
  const isActive = scanStatus !== "idle" && scanStatus !== "done" && scanStatus !== "error";
  const wasSmartSkipped = lastScanResult?.errorMessage?.includes("skipped");

  const altitudeDisplay = altitudeMeters !== null
    ? unitSystem === "imperial"
      ? `${Math.round(altitudeMeters * 3.28084).toLocaleString()} ft`
      : `${Math.round(altitudeMeters).toLocaleString()} m`
    : null;

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="backdrop-blur-md bg-background/85 dark:bg-card/85 rounded-md border border-border px-2.5 py-1.5 flex items-center gap-2 text-xs cursor-pointer hover-elevate"
        data-testid="button-hud-expand"
      >
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-400" : "bg-muted-foreground"}`}
          data-testid="indicator-connection-status"
        />
        {connected && isScanning && (
          <>
            {isActive ? (
              <span className={`${scanStatusColor(scanStatus)} font-medium text-xs`} data-testid="text-collapsed-status">
                {scanStatusLabel(scanStatus)}
              </span>
            ) : (
              <span className="text-muted-foreground font-medium text-xs" data-testid="text-collapsed-countdown">
                {formatCountdown(nextScanCountdown)}
              </span>
            )}
          </>
        )}
        {connected && !isScanning && (
          <span className="text-muted-foreground text-xs">Paused</span>
        )}
        {!connected && (
          <span className="text-muted-foreground text-xs">Off</span>
        )}
        {wasSmartSkipped && (
          <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" data-testid="indicator-smart-skip" />
        )}
        {smartScanEnabled && !wasSmartSkipped && (
          <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" data-testid="indicator-smart-enabled" />
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>
    );
  }

  return (
    <div
      className="bg-background/85 dark:bg-card/85 backdrop-blur-md rounded-md border border-border text-xs"
      data-testid="map-hud"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {connected ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" data-testid="indicator-connection-status" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" data-testid="indicator-connection-status" />
          )}
          <span className="font-semibold truncate" data-testid="text-radio-name">
            {connected ? radioName : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {connected && batteryV && (
            <Badge variant="secondary" className="text-[10px]" data-testid="text-battery">
              {batteryV}V
            </Badge>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(false)}
            data-testid="button-hud-collapse"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {connected && deviceInfo && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground">
          <Cpu className="h-3 w-3 shrink-0" />
          <span className="truncate" data-testid="text-device-model">{deviceInfo.manufacturerModel}</span>
          {deviceInfo.firmwareVersion && (
            <span className="ml-auto shrink-0" data-testid="text-firmware-version">{deviceInfo.firmwareVersion}</span>
          )}
        </div>
      )}

      {altitudeDisplay && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground">
          <Mountain className="h-3 w-3 shrink-0" />
          <span data-testid="text-altitude">{altitudeDisplay} ASL</span>
        </div>
      )}

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
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={forceScan}
                disabled={isActive || !connected}
                title="Force scan now"
                data-testid="button-force-scan"
              >
                <Zap className="h-3.5 w-3.5" />
              </Button>
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
                <div className={`flex items-center gap-1 ${lastScanResult.errorMessage.includes("skipped") ? "text-yellow-400" : "text-red-400"}`}>
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
