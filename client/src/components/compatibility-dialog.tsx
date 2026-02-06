import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bluetooth, Download, Smartphone, Monitor, ExternalLink } from "lucide-react";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if ("standalone" in navigator && (navigator as any).standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return false;
}

function isBluefyOrWebBLE(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("bluefy") || ua.includes("webble");
}

function hasWebBluetooth(): boolean {
  return !!(navigator as any).bluetooth;
}

const DISMISS_KEY = "mesh-compat-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

export function CompatibilityDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < DISMISS_DURATION) return;
    }

    if (isStandalone()) return;
    if (isBluefyOrWebBLE()) return;

    const platform = detectPlatform();

    if (platform === "desktop" && hasWebBluetooth()) return;

    setOpen(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setOpen(false);
  };

  const platform = detectPlatform();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-compatibility">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5 text-blue-500" />
            Bluetooth Setup Required
          </DialogTitle>
          <DialogDescription>
            Mesh Utility needs Web Bluetooth to connect to your MeshCore radio. Here's how to get started:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {platform === "ios" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Option 1: Use Bluefy Browser
                </h4>
                <p className="text-sm text-muted-foreground">
                  Bluefy is a browser that supports Web Bluetooth on iPhone/iPad. Open this page in Bluefy to connect to your radio.
                </p>
                <a
                  href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-bluefy"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Get Bluefy on App Store
                  </Button>
                </a>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Option 2: Install as App
                </h4>
                <p className="text-sm text-muted-foreground">
                  In Bluefy, tap the share button and choose "Add to Home Screen" to install Mesh Utility as an app for quick access.
                </p>
              </div>
            </>
          )}

          {platform === "android" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Use Chrome or Edge
                </h4>
                <p className="text-sm text-muted-foreground">
                  Open this page in Chrome or Edge on your Android device. These browsers support Web Bluetooth natively.
                </p>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Install as App
                </h4>
                <p className="text-sm text-muted-foreground">
                  Tap the browser menu and choose "Install app" or "Add to Home Screen" for a full-screen experience.
                </p>
              </div>
            </>
          )}

          {platform === "desktop" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Use Chrome or Edge
                </h4>
                <p className="text-sm text-muted-foreground">
                  Web Bluetooth is supported in Chrome and Edge on desktop. Open this page in one of those browsers to connect to your radio.
                </p>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Install as App
                </h4>
                <p className="text-sm text-muted-foreground">
                  In Chrome or Edge, click the install icon in the address bar to add Mesh Utility as a desktop app.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full" data-testid="button-dismiss-compat">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
