import { useState } from "react";
import { Settings, Timer, MapPin, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface SettingsPanelProps {
  scanInterval: number;
  onScanIntervalChange: (val: number) => void;
  autoCenter: boolean;
  onAutoCenterChange: (val: boolean) => void;
  smartScanEnabled: boolean;
  onSmartScanChange: (val: boolean) => void;
  smartScanDays: number;
  onSmartScanDaysChange: (val: number) => void;
  onMarkDeadZone: () => void;
}

export function SettingsPanel({
  scanInterval,
  onScanIntervalChange,
  autoCenter,
  onAutoCenterChange,
  smartScanEnabled,
  onSmartScanChange,
  smartScanDays,
  onSmartScanDaysChange,
  onMarkDeadZone,
}: SettingsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Settings</span>
      </div>

      <Card className="p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Scan Interval: {scanInterval}s</Label>
          </div>
          <Slider
            value={[scanInterval]}
            onValueChange={([v]) => onScanIntervalChange(v)}
            min={10}
            max={300}
            step={5}
            data-testid="slider-scan-interval"
          />
          <p className="text-xs text-muted-foreground">
            Minimum 10s, recommended 40s+
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Auto-center map</Label>
          </div>
          <Switch
            checked={autoCenter}
            onCheckedChange={onAutoCenterChange}
            data-testid="switch-auto-center"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Smart Scanning</Label>
            <Switch
              checked={smartScanEnabled}
              onCheckedChange={onSmartScanChange}
              data-testid="switch-smart-scan"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Skip scanning in areas covered in the last {smartScanDays} days
          </p>
          {smartScanEnabled && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Coverage freshness: {smartScanDays} days
              </Label>
              <Slider
                value={[smartScanDays]}
                onValueChange={([v]) => onSmartScanDaysChange(v)}
                min={1}
                max={14}
                step={1}
                data-testid="slider-smart-scan-days"
              />
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Dead Zones</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Mark current location as a dead zone. Dead zones always scan at the set interval.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onMarkDeadZone}
            className="w-full"
            data-testid="button-mark-dead-zone"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Mark Dead Zone
          </Button>
        </div>
      </Card>
    </div>
  );
}
