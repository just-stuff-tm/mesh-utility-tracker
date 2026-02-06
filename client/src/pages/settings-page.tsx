import { Settings, Timer, MapPin, AlertTriangle, Info, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import type { CoverageZone } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const {
    scanInterval,
    setScanInterval,
    autoCenter,
    setAutoCenter,
    smartScanEnabled,
    setSmartScanEnabled,
    smartScanDays,
    setSmartScanDays,
  } = useBluetoothContext();

  const { data: deadZones = [] } = useQuery<CoverageZone[]>({
    queryKey: ["/api/coverage-zones", "dead"],
  });

  const removeDeadZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/coverage-zones/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      toast({ title: "Dead zone removed" });
    },
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure scanning behavior and preferences
        </p>
      </div>

      <Card className="p-4 space-y-5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Scanning</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm">Scan Interval</Label>
            <Badge variant="secondary">{scanInterval}s</Badge>
          </div>
          <Slider
            value={[scanInterval]}
            onValueChange={([v]) => setScanInterval(v)}
            min={40}
            max={300}
            step={10}
            data-testid="slider-settings-scan-interval"
          />
          <p className="text-xs text-muted-foreground">
            How often node_discover is sent over the mesh. Lower values increase network traffic but improve coverage data freshness.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-sm">Smart Scanning</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Skip scanning in areas that have been covered recently
              </p>
            </div>
            <Switch
              checked={smartScanEnabled}
              onCheckedChange={setSmartScanEnabled}
              data-testid="switch-settings-smart-scan"
            />
          </div>

          {smartScanEnabled && (
            <div className="space-y-2 pl-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-xs text-muted-foreground">
                  Coverage freshness threshold
                </Label>
                <Badge variant="secondary" className="text-xs">{smartScanDays} days</Badge>
              </div>
              <Slider
                value={[smartScanDays]}
                onValueChange={([v]) => setSmartScanDays(v)}
                min={1}
                max={14}
                step={1}
                data-testid="slider-settings-smart-days"
              />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Map</h3>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-sm">Auto-center on observer</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep the map centered on your current position
            </p>
          </div>
          <Switch
            checked={autoCenter}
            onCheckedChange={setAutoCenter}
            data-testid="switch-settings-auto-center"
          />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Dead Zones</h3>
          </div>
          <Badge variant="secondary">{deadZones.length}</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Dead zones always scan at the configured interval, regardless of smart scanning settings.
        </p>

        {deadZones.length === 0 ? (
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No dead zones marked
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mark dead zones from the coverage map
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {deadZones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                data-testid={`dead-zone-${zone.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="text-xs font-mono truncate">
                    {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeDeadZoneMutation.mutate(zone.id)}
                  data-testid={`button-remove-dead-zone-${zone.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">About</h3>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Mesh Utility v1.0 - LoRa MeshCore Radio Management</p>
          <p>Connects to MeshCore radios via Web Bluetooth API to discover mesh nodes and map RF coverage.</p>
          <p>Requires Chrome, Edge, or another Chromium-based browser with Web Bluetooth support.</p>
        </div>
      </Card>
    </div>
  );
}
