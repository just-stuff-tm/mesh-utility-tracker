import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Bluetooth,
  MapPin,
  Radio,
  Scan,
  Settings,
  Smartphone,
  Signal,
  Mountain,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

interface Section {
  icon: typeof Bluetooth;
  title: string;
  content: string[];
}

const sections: Section[] = [
  {
    icon: Bluetooth,
    title: "Connecting Your Radio",
    content: [
      "Tap the Connect button in the settings panel (gear icon) to pair with your MeshCore radio via Bluetooth.",
      "Important: Close any other app connected to your radio first (MeshCore app, etc.). Bluetooth only allows one connection at a time.",
      "On iOS, use the Bluefy or WebBLE browser app since Safari doesn't support Web Bluetooth. On Android or desktop, use Chrome or Edge.",
      "Once connected, you'll see your radio's name, battery level, and frequency in the settings panel.",
    ],
  },
  {
    icon: Scan,
    title: "Scanning for Nodes",
    content: [
      "After connecting, toggle the Scan switch to start automatic scanning. The app broadcasts a discovery message and listens for nearby repeaters.",
      "Each scan takes about 40 seconds. The app collects signal strength (RSSI) and signal-to-noise ratio (SNR) from every repeater that responds.",
      "Your current GPS location is recorded with each scan so the coverage map knows where you were standing.",
      "Smart Scan mode (enabled in settings) skips areas you've recently scanned, except dead zones which are always re-scanned.",
    ],
  },
  {
    icon: MapPin,
    title: "Reading the Coverage Map",
    content: [
      "The map shows hexagonal zones colored by signal quality. Each hex represents a small area where scans were taken.",
      "Green = Excellent signal, Yellow-Green = Good, Yellow = Fair, Orange = Marginal, Red = Poor, Dark Red = Dead Zone (no response from any repeater).",
      "Purple zones indicate a Noisy signal: the radio power (RSSI) is decent but the signal quality (SNR) is poor, usually from interference.",
      "Tap any hex zone to see detailed info: average RSSI/SNR, scan count, altitude, and which repeaters were observed.",
    ],
  },
  {
    icon: Signal,
    title: "Understanding Signal Quality",
    content: [
      "Signal quality is based on two measurements: RSSI (signal power in dBm) and SNR (signal clarity in dB).",
      "Excellent: RSSI better than -90 dBm and SNR above 10 dB. Strong, clear signal.",
      "Good: RSSI -90 to -100 dBm, SNR 0 to 10 dB. Reliable connection.",
      "Fair: RSSI -100 to -110 dBm, SNR -7 to 0 dB. Usable but may have occasional issues.",
      "Marginal: RSSI -110 to -115 dBm, SNR -13 to -7 dB. At the edge of usable range.",
      "Poor: RSSI -115 to -120 dBm. Barely receiving a signal.",
      "Dead Zone: No repeater responded at all. You're outside mesh coverage.",
    ],
  },
  {
    icon: Radio,
    title: "Nodes Page",
    content: [
      "The Nodes page lists all mesh network repeaters discovered during scans.",
      "Each node shows its name and unique ID (first 4 bytes of its public key).",
      "Nodes are discovered automatically during scans. The list updates as new repeaters respond.",
    ],
  },
  {
    icon: Mountain,
    title: "Altitude Tracking",
    content: [
      "The app tracks your altitude and records it with each scan.",
      "On mobile devices with GPS, altitude comes directly from the GPS sensor.",
      "On desktop or when GPS altitude isn't available, the app uses a free elevation API to estimate altitude based on your coordinates.",
      "Altitude is shown in the map overlay, scan history, and zone popups. Switch between feet and meters in settings.",
    ],
  },
  {
    icon: Settings,
    title: "Settings",
    content: [
      "Scan Interval: How often automatic scans run (in seconds). Default is 40s.",
      "Smart Scan: When enabled, skips areas scanned within the freshness window (1-14 days). Dead zones are always re-scanned.",
      "Force Scan: Override smart scan to scan your current location regardless of freshness.",
      "Stats Radius: Filter the bottom stats display to only show data within a certain distance from your current position. Set to 0 for all data.",
      "Units: Switch between Imperial (feet, miles) and Metric (meters, kilometers).",
      "Map Layers: Use the layer control on the map to switch between Dark, Standard, and Satellite views.",
    ],
  },
  {
    icon: Smartphone,
    title: "Installing as an App (PWA)",
    content: [
      "Mesh Utility can be installed as an app on your phone or desktop for quick access.",
      "On Android Chrome: Tap the three-dot menu and select 'Install app' or 'Add to Home screen'.",
      "On iOS (Bluefy): Tap the share icon and select 'Add to Home Screen'.",
      "On Desktop Chrome/Edge: Click the install icon in the address bar.",
      "The installed app works just like a native app with its own icon and full-screen experience.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Troubleshooting",
    content: [
      "Can't connect? Make sure no other app is using your radio's Bluetooth. Close MeshCore or other BLE apps first.",
      "No scans happening? Check that location services are enabled and the app has permission. GPS is needed to record scan positions.",
      "Map not updating? Pull down to refresh, or check that scan results are being submitted (look for the status in the map overlay).",
      "Connection drops on iOS? Bluetooth connections may drop when the screen sleeps or the app is backgrounded. Return to the app and it will detect the disconnection.",
      "Wrong frequency shown? The frequency displayed comes from your radio's configuration. If it looks wrong, check your radio's firmware settings.",
    ],
  },
];

export default function ManualPage() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-manual-title">How to Use Mesh Utility</h1>
          <p className="text-sm text-muted-foreground">
            A guide to mapping your LoRa mesh network coverage
          </p>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="space-y-3 pr-2">
          {sections.map((section) => (
            <Card key={section.title} className="p-4" data-testid={`card-manual-${section.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center gap-2 mb-2">
                <section.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <h2 className="text-sm font-semibold">{section.title}</h2>
              </div>
              <div className="space-y-2">
                {section.content.map((paragraph, i) => (
                  <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
