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
  WifiOff,
  Share2,
  Trash2,
  Map,
  Layers,
  History,
  BarChart3,
  BatteryMedium,
} from "lucide-react";

interface Section {
  icon: typeof Bluetooth;
  title: string;
  content: string[];
}

const sections: Section[] = [
  {
    icon: HelpCircle,
    title: "What Is Mesh Utility?",
    content: [
      "Mesh Utility helps you see how well your LoRa mesh radio network covers an area. Walk or drive around with your radio connected, and the app builds a color-coded map showing where your signal is strong, weak, or missing entirely.",
    ],
  },
  {
    icon: Bluetooth,
    title: "Getting Connected",
    content: [
      "Open the settings panel (gear icon) and tap Connect. Your phone or computer will search for your MeshCore radio over Bluetooth.",
      "Only one app can use Bluetooth with your radio at a time. If you have MeshCore or another app connected, close it first.",
      "On iPhones and iPads, you'll need the Bluefy or WebBLE browser since Safari doesn't support this type of Bluetooth. On Android, computers, or Chromebooks, use Chrome or Edge.",
      "Once connected, the app shows your radio's name, battery level, and frequency at the top of the settings panel. The screen will stay awake while connected so you don't lose your Bluetooth link during scans.",
      "If you put the app in the background (especially on iOS), the Bluetooth connection may drop. When you return, the app checks automatically and lets you know if you need to reconnect.",
    ],
  },
  {
    icon: Scan,
    title: "Scanning",
    content: [
      "With your radio connected, flip the Scan switch to start. The app sends out a discovery signal and listens for any repeaters that respond, measuring how strong and clear each signal is.",
      "Each scan cycle takes about 40 seconds. Your GPS location (and altitude when available) is recorded with each scan so the map knows exactly where you were.",
      "Smart Scan skips areas you've already covered recently (you pick how many days count as \"recent\" in settings). Dead zones are always re-checked regardless. You can also tap Force Scan to override and scan your current spot right away.",
    ],
  },
  {
    icon: Map,
    title: "The Coverage Map",
    content: [
      "The main screen is a map covered with hexagonal zones. Each hex represents a small area where scans were taken, colored by signal quality.",
      "Green means excellent signal. Yellow-green is good. Yellow is fair. Orange is marginal. Red is poor. Dark red means no repeater responded at all (a dead zone). Purple means the signal power is okay but clarity is bad, usually from interference.",
      "Tap any hex to see its details: signal readings, how many scans were taken there, altitude, and which repeaters were heard.",
      "Use the layer control in the top right corner to switch between Dark, Standard, and Satellite map views. The color legend in the upper left shows what each color means (tap it to expand the full scale).",
    ],
  },
  {
    icon: BatteryMedium,
    title: "Map Overlay",
    content: [
      "While connected, an overlay at the top of the map shows your radio's name, battery level, and scan status. It also shows a countdown to the next scan and the result of the last scan.",
      "The scan toggle button in the overlay lets you start or stop scanning without opening the settings panel.",
    ],
  },
  {
    icon: BarChart3,
    title: "Bottom Stats Bar",
    content: [
      "At the bottom of the map, a stats bar shows averages for your coverage data: average signal strength (RSSI), average signal clarity (SNR), total zones scanned, and dead zones found.",
      "You can filter these stats by distance using the Stats Radius setting. Set it to a specific number of miles (or kilometers) to only include data near your current position, or set it to 0 to see averages across all your data.",
    ],
  },
  {
    icon: Signal,
    title: "Signal Quality",
    content: [
      "Each scan measures two things: signal power (RSSI) and signal clarity (SNR). The overall quality is whichever of the two is worse.",
      "Excellent means both power and clarity are strong. Good means a reliable connection. Fair is usable with occasional hiccups. Marginal is at the edge of working range. Poor means you're barely picking up anything. A dead zone means no repeater responded at all.",
      "A \"Noisy\" reading (shown in purple) means the radio is picking up decent power but the signal is garbled, often from nearby interference or competing signals.",
    ],
  },
  {
    icon: Radio,
    title: "Discovered Nodes",
    content: [
      "The Nodes page lists every repeater your radio has heard during scans. Each entry shows the repeater's name and a short identifier based on its public key.",
      "This list grows automatically as you scan in different areas and discover new repeaters.",
    ],
  },
  {
    icon: History,
    title: "Scan History",
    content: [
      "The History page shows a timeline of your recent scans. Each entry includes the signal readings, which repeater responded, your location, altitude, and when the scan happened.",
      "The app keeps the 5 most recent scans per hex zone to save space. Older scans at the same location are automatically cleaned up.",
    ],
  },
  {
    icon: Mountain,
    title: "Altitude",
    content: [
      "Your altitude is recorded with each scan. On phones with GPS, it comes directly from the GPS sensor. On desktop or when GPS altitude isn't available, the app estimates it from your coordinates using a free elevation service.",
      "Altitude appears in the map overlay, scan history cards, and zone popups. You can switch between feet and meters in settings.",
    ],
  },
  {
    icon: Settings,
    title: "Settings",
    content: [
      "Scan Interval sets how many seconds between automatic scans (minimum 40 seconds).",
      "Auto-center keeps the map following your position as you move.",
      "Update Radio Position controls whether your GPS coordinates get written back to the radio during scans. It's off by default to avoid overwriting your Companion radio's stored location. Only turn this on if you want the radio to track where you are.",
      "Tile Caching (off by default) saves map tiles as you browse so they're available offline. You can also download all tiles for your current area at once, or clear cached tiles.",
      "Units lets you switch between Imperial (feet, miles) and Metric (meters, kilometers).",
      "Stats Radius filters the bottom stats bar to only show data within a certain distance from you. Set to 0 to include everything.",
      "Smart Scanning and the freshness slider control whether the app skips areas scanned within a certain number of days.",
      "Dead Zone button marks your current spot as a dead zone when no repeaters can reach it.",
    ],
  },
  {
    icon: WifiOff,
    title: "Online / Offline",
    content: [
      "The app works fully offline after your first visit. Scans, nodes, and coverage data are all stored on your device automatically.",
      "When you lose internet, everything keeps working. Scan results are saved locally and queued up. When connectivity returns, queued items sync to the server automatically.",
      "You can also force offline mode using the toggle in settings. This is handy if you're on a slow or metered connection and want to batch your uploads for later. When you switch back online, any pending data syncs right away.",
      "The header bar shows your connection status: an orange badge for offline, blue for items waiting to sync. In settings, you can tap Sync Now to manually push queued data.",
    ],
  },
  {
    icon: Smartphone,
    title: "Installing the App",
    content: [
      "You can install Mesh Utility as a standalone app on your phone, tablet, or computer for quick access.",
      "On Android, tap the browser menu and choose \"Install app\" or \"Add to Home screen.\" On iOS (in Bluefy), use the share button and \"Add to Home Screen.\" On desktop Chrome or Edge, click the install icon in the address bar.",
      "The installed version runs full-screen with its own icon, just like a regular app.",
    ],
  },
  {
    icon: Share2,
    title: "Sharing & Support",
    content: [
      "Use the Share button in the sidebar to send the app link to others. On phones it opens the system share sheet; on desktop it copies the link to your clipboard.",
      "If you find the app useful, the Support link at the top lets you contribute to development.",
    ],
  },
  {
    icon: Trash2,
    title: "Deleting Your Data",
    content: [
      "Connect your radio and go to Settings. The Delete My Data button at the bottom removes all scan results, coverage zones, and records tied to the radio you're currently connected with.",
      "This is permanent and cannot be undone. It only affects data from that specific radio \u2014 data collected by other radios is not touched.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Troubleshooting",
    content: [
      "Can't connect: Make sure no other app is using your radio's Bluetooth. Only one connection is allowed at a time.",
      "No scans happening: Check that location services are on and the app has permission. GPS is needed to record where you are.",
      "Map not updating: Try refreshing the page, or check the map overlay for scan status messages.",
      "Connection drops on iOS: Bluetooth can disconnect when the screen sleeps or the app goes to the background. Return to the app and it will detect the disconnection automatically.",
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
            Everything you need to know about mapping your mesh network
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
