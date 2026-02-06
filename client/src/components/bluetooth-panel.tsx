import { useState, useEffect, useCallback } from "react";
import { Bluetooth, BluetoothOff, Radio, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  connectToRadio,
  disconnectRadio,
  isBluetoothSupported,
  onMessage,
  sendNodeDiscover,
  isConnected as checkConnected,
} from "@/lib/bluetooth";

interface BluetoothPanelProps {
  onNodeDiscovered?: (data: string) => void;
  onConnectionChange?: (connected: boolean, deviceName: string | null) => void;
  scanInterval: number;
  isScanning: boolean;
  onScanToggle: () => void;
}

export function BluetoothPanel({
  onNodeDiscovered,
  onConnectionChange,
  scanInterval,
  isScanning,
  onScanToggle,
}: BluetoothPanelProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const supported = isBluetoothSupported();

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      if (data === "__DISCONNECTED__") {
        setConnected(false);
        setDeviceName(null);
        onConnectionChange?.(false, null);
        return;
      }
      setMessagesReceived((prev) => prev + 1);
      onNodeDiscovered?.(data);
    });
    return unsubscribe;
  }, [onNodeDiscovered, onConnectionChange]);

  useEffect(() => {
    if (!connected || !isScanning) return;
    const interval = setInterval(async () => {
      const sent = await sendNodeDiscover();
      if (sent) {
        setLastScanTime(new Date());
      }
    }, scanInterval * 1000);

    sendNodeDiscover().then((sent) => {
      if (sent) setLastScanTime(new Date());
    });

    return () => clearInterval(interval);
  }, [connected, isScanning, scanInterval]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const result = await connectToRadio();
    setConnecting(false);
    if (result.success) {
      setConnected(true);
      setDeviceName(result.deviceName);
      onConnectionChange?.(true, result.deviceName);
    } else {
      setError(result.error || "Connection failed");
    }
  }, [onConnectionChange]);

  const handleDisconnect = useCallback(async () => {
    await disconnectRadio();
    setConnected(false);
    setDeviceName(null);
    onConnectionChange?.(false, null);
  }, [onConnectionChange]);

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
              onClick={handleConnect}
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
                onClick={handleDisconnect}
                className="flex-1"
                data-testid="button-disconnect-bluetooth"
              >
                <BluetoothOff className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
              <Button
                size="sm"
                variant={isScanning ? "destructive" : "default"}
                onClick={onScanToggle}
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
            <div className="col-span-2">
              <span className="text-muted-foreground">Last Scan</span>
              <p className="font-medium">
                {lastScanTime ? lastScanTime.toLocaleTimeString() : "Never"}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
