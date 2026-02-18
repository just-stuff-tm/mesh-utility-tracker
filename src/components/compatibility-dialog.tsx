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
import { useI18n } from "@/lib/i18n";

type Platform = "ios" | "android" | "desktop";
type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type NavigatorWithBluetooth = Navigator & { bluetooth?: unknown };

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if ((navigator as NavigatorWithStandalone).standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return false;
}

function isBluefyOrWebBLE(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("bluefy") || ua.includes("webble");
}

function hasWebBluetooth(): boolean {
  return !!(navigator as NavigatorWithBluetooth).bluetooth;
}

const DISMISS_KEY = "mesh-compat-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

export function CompatibilityDialog() {
  const { t } = useI18n();
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
            {t("compat.title")}
          </DialogTitle>
          <DialogDescription>
            {t("compat.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {platform === "ios" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t("compat.option1Bluefy")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.bluefyDesc")}
                </p>
                <a
                  href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-bluefy"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("compat.getBluefyAppStore")}
                  </Button>
                </a>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t("compat.option2Install")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.bluefyInstallDesc")}
                </p>
              </div>
            </>
          )}

          {platform === "android" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t("compat.useChromeEdge")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.androidDesc")}
                </p>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t("compat.installAsApp")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.androidInstallDesc")}
                </p>
              </div>
            </>
          )}

          {platform === "desktop" && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  {t("compat.useChromeEdge")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.desktopDesc")}
                </p>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t("compat.installAsApp")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("compat.desktopInstallDesc")}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full" data-testid="button-dismiss-compat">
            {t("compat.gotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
