import { Bluetooth, BluetoothOff, Radio, Wifi, WifiOff, Loader2, Shield, Battery, Cpu, Users, CheckCircle2, AlertCircle, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBluetoothContext } from "@/lib/bluetooth-context";

function getScanStatusLabel(status: string): string {
  switch (status) {
    case "advertising": return "Sending advert...";
    case "waiting": return "Waiting for responses...";
    case "querying": return "Querying repeaters...";
    case "submitting": return "Saving results...";
    case "done": return "Scan complete";
    case "error": return "Scan failed";
    default: return "Idle";
  }
}

export function BluetoothPanel() {
  const {
    connected,
    connecting,
    deviceName,
    error,
    supported,
    isScanning,
    scanInterval,
    nextScanCountdown,
    lastScanTime,
    messagesReceived,
    wakeLockActive,
    deviceInfo,
    selfInfo,
    batteryMilliVolts,
    contacts,
    scanStatus,
    lastScanResult,
    lastRadioName,
    showReconnect,
    connect,
    disconnect,
    toggleScan,
    dismissReconnect,
  } = useBluetoothContext();

  const batteryPercent = batteryMilliVolts
    ? Math.min(100, Math.max(0, Math.round(((batteryMilliVolts - 3200) / (4200 - 3200)) * 100)))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Radio Connection</span>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {connected ? (
              <Bluetooth className="h-4 w-4 text-chart-3" />
            ) : (
              <BluetoothOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {connected ? deviceName || "Connected" : "Not Connected"}
            </span>
          </div>
          <Badge variant={connected ? "default" : "secondary"} className="text-xs">
            {connected ? "Online" : "Offline"}
          </Badge>
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {!supported && (
          <p className="text-xs text-muted-foreground">
            Web Bluetooth not available. Use Chrome/Edge on desktop or Android.
          </p>
        )}

        {!connected && showReconnect && lastRadioName && (
          <div className="bg-muted/50 rounded-md p-2 space-y-2" data-no-close>
            <p className="text-xs text-muted-foreground">
              Previously connected to <span className="font-medium text-foreground">{lastRadioName}</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={connect}
                disabled={connecting || !supported}
                className="flex-1"
                data-testid="button-reconnect-bluetooth"
                data-no-close
              >
                {connecting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Bluetooth className="h-3 w-3 mr-1" />
                )}
                {connecting ? "Connecting..." : "Reconnect"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissReconnect}
                data-testid="button-dismiss-reconnect"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!connected ? (
            <Button
              size="sm"
              onClick={connect}
              disabled={connecting || !supported}
              className="flex-1"
              data-testid="button-connect-bluetooth"
            >
              {connecting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Bluetooth className="h-3 w-3 mr-1" />
              )}
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={disconnect}
                className="flex-1"
                data-testid="button-disconnect-bluetooth"
              >
                <BluetoothOff className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
              <Button
                size="sm"
                variant={isScanning ? "destructive" : "default"}
                onClick={toggleScan}
                className="flex-1"
                data-testid="button-toggle-scan"
              >
                {isScanning ? (
                  <WifiOff className="h-3 w-3 mr-1" />
                ) : (
                  <Wifi className="h-3 w-3 mr-1" />
                )}
                {isScanning ? "Stop" : "Scan"}
              </Button>
            </>
          )}
        </div>

        {connected && scanStatus !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {scanStatus === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-chart-3" />
              ) : scanStatus === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <span className="text-xs" data-testid="text-scan-status">
                {getScanStatusLabel(scanStatus)}
              </span>
            </div>

            {lastScanResult && (
              <div className="bg-muted/50 rounded-md p-2 space-y-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span data-testid="text-contacts-found">{lastScanResult.contactsFound} contacts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Radio className="h-3 w-3 text-muted-foreground" />
                    <span data-testid="text-repeaters-found">{lastScanResult.repeatersFound} repeaters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Signal className="h-3 w-3 text-muted-foreground" />
                    <span data-testid="text-stats-received">{lastScanResult.repeatersWithStats} with signal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                    <span data-testid="text-results-submitted">{lastScanResult.scanResultsSubmitted} saved</span>
                  </div>
                </div>
                {lastScanResult.errorMessage && (
                  <p className="text-xs text-destructive" data-testid="text-scan-error">
                    {lastScanResult.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {connected && (
        <>
          {(selfInfo || batteryMilliVolts !== null) && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Device</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {selfInfo && (
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium" data-testid="text-device-name">{selfInfo.name}</p>
                  </div>
                )}
                {selfInfo && (
                  <div>
                    <span className="text-muted-foreground">TX Power</span>
                    <p className="font-medium">{selfInfo.txPower} / {selfInfo.maxTxPower}</p>
                  </div>
                )}
                {deviceInfo && (
                  <div>
                    <span className="text-muted-foreground">Model</span>
                    <p className="font-medium truncate">{deviceInfo.manufacturerModel}</p>
                  </div>
                )}
                {deviceInfo && (
                  <div>
                    <span className="text-muted-foreground">Firmware</span>
                    <p className="font-medium">{deviceInfo.firmwareVersion || deviceInfo.firmwareBuildDate}</p>
                  </div>
                )}
                {batteryPercent !== null && (
                  <div>
                    <span className="text-muted-foreground">Battery</span>
                    <p className="font-medium flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      {batteryPercent}%
                    </p>
                  </div>
                )}
                {selfInfo && selfInfo.radioFreq > 0 && (
                  <div>
                    <span className="text-muted-foreground">Frequency</span>
                    <p className="font-medium">{(selfInfo.radioFreq / 1e6).toFixed(1)} MHz</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Next Scan</span>
                <p className="font-medium" data-testid="text-next-scan-countdown">
                  {nextScanCountdown !== null ? `${nextScanCountdown}s` : `${scanInterval}s`}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Messages</span>
                <p className="font-medium">{messagesReceived}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Scan</span>
                <p className="font-medium">
                  {lastScanTime ? lastScanTime.toLocaleTimeString() : "Never"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Wake Lock</span>
                <p className="font-medium flex items-center gap-1">
                  {wakeLockActive ? (
                    <>
                      <Shield className="h-3 w-3 text-chart-3" />
                      Active
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {"wakeLock" in navigator ? "Inactive" : "Not supported"}
                    </span>
                  )}
                </p>
              </div>
              {contacts.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Contacts</span>
                  <p className="font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {contacts.length}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
