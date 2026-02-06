import { Bluetooth, BluetoothOff, Radio, Wifi, WifiOff, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBluetoothContext } from "@/lib/bluetooth-context";

export function BluetoothPanel() {
  const {
    connected,
    connecting,
    deviceName,
    error,
    supported,
    isScanning,
    scanInterval,
    lastScanTime,
    messagesReceived,
    wakeLockActive,
    connect,
    disconnect,
    toggleScan,
  } = useBluetoothContext();

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
      </Card>

      {connected && (
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Scan Interval</span>
              <p className="font-medium">{scanInterval}s</p>
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
                  "Inactive"
                )}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
