import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 max-w-3xl mx-auto space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold" data-testid="text-privacy-title">Privacy Policy</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-privacy-updated">Last updated: February 7, 2026</p>

        <Card className="p-4 space-y-4" data-testid="card-privacy-content">
          <section className="space-y-2" data-testid="section-overview">
            <h2 className="text-base font-medium">Overview</h2>
            <p className="text-sm text-muted-foreground">
              Mesh Utility is an open tool for mapping LoRa MeshCore radio coverage. We are committed to keeping your data private and being transparent about what we collect, how we use it, and how you can manage it.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-data-collected">
            <h2 className="text-base font-medium">Data We Collect</h2>
            <p className="text-sm text-muted-foreground">
              When you use Mesh Utility, the following data may be collected and stored:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
              <li><span className="font-medium text-foreground">Location data:</span> GPS coordinates from your device while scanning, used to map coverage zones on the grid.</li>
              <li><span className="font-medium text-foreground">Radio signal data:</span> RSSI and SNR readings collected from mesh radio responses during scans.</li>
              <li><span className="font-medium text-foreground">Node identifiers:</span> Public key prefixes and advertised names of discovered mesh network nodes.</li>
              <li><span className="font-medium text-foreground">Radio identifier:</span> A public key prefix identifying the radio you connect with, used to associate scan data with your device.</li>
              <li><span className="font-medium text-foreground">Scan metadata:</span> Timestamps, observer names, and sender/receiver labels for each scan result.</li>
            </ul>
          </section>

          <section className="space-y-2" data-testid="section-data-not-collected">
            <h2 className="text-base font-medium">Data We Do Not Collect</h2>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
              <li>We do not collect your name, email, phone number, or any personal contact information.</li>
              <li>We do not require account creation or login.</li>
              <li>We do not use cookies for tracking or advertising.</li>
              <li>We do not collect or store the full cryptographic keys of your radio.</li>
              <li>We do not share any data with third-party analytics or advertising services.</li>
            </ul>
          </section>

          <section className="space-y-2" data-testid="section-data-usage">
            <h2 className="text-base font-medium">How Your Data Is Used</h2>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
              <li>To display RF coverage zones and signal quality on the interactive map.</li>
              <li>To track scan history so you can review past readings.</li>
              <li>To identify dead zones where no repeaters were discovered.</li>
              <li>To support smart scanning by tracking which areas have been recently scanned.</li>
            </ul>
          </section>

          <section className="space-y-2" data-testid="section-permissions">
            <h2 className="text-base font-medium">Bluetooth and Location Permissions</h2>
            <p className="text-sm text-muted-foreground">
              Mesh Utility uses the Web Bluetooth API to connect to your LoRa radio and the Geolocation API to determine your position while scanning. Both require your explicit browser permission. You can revoke these permissions at any time through your browser or device settings. The app will not function without Bluetooth access, and location is required for coverage mapping.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-storage-deletion">
            <h2 className="text-base font-medium">Data Storage and Deletion</h2>
            <p className="text-sm text-muted-foreground">
              All scan data is stored in a PostgreSQL database on the server. You can delete all data associated with your radio from the Settings panel using the "Delete My Data" option. This permanently removes all scan results, coverage zones, and node records linked to your radio's identifier.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-local-storage">
            <h2 className="text-base font-medium">Local Storage</h2>
            <p className="text-sm text-muted-foreground">
              The app stores a small amount of non-sensitive data in your browser's local storage, including your theme preference (dark/light mode), scan settings (interval, freshness), and whether the compatibility dialog has been dismissed. No personal or radio data is stored locally.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-third-party">
            <h2 className="text-base font-medium">Third-Party Services</h2>
            <p className="text-sm text-muted-foreground">
              The app loads map tiles from CartoDB and marker icons from Cloudflare CDN. These services may log standard web request data (IP address, user agent) according to their own privacy policies. No user-specific data is sent to these services by the app.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-changes">
            <h2 className="text-base font-medium">Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground">
              We may update this privacy policy from time to time. Any changes will be reflected on this page with an updated date. Continued use of the app after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="space-y-2" data-testid="section-contact">
            <h2 className="text-base font-medium">Contact</h2>
            <p className="text-sm text-muted-foreground">
              If you have questions about this privacy policy or your data, you can reach us through the feedback section on the app's homepage.
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
}
