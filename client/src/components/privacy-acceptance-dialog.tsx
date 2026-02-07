import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, WifiOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRIVACY_ACCEPTED_KEY = "mesh-privacy-accepted";

export function isPrivacyAccepted(): boolean {
  return localStorage.getItem(PRIVACY_ACCEPTED_KEY) === "true";
}

export function usePrivacyAccepted() {
  const [accepted, setAccepted] = useState(() => isPrivacyAccepted());
  const [showDialog, setShowDialog] = useState(false);
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  const accept = useCallback(() => {
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, "true");
    setAccepted(true);
    setShowDialog(false);
    if (pendingCallbackRef.current) {
      const cb = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      cb();
    }
  }, []);

  const closeDialog = useCallback(() => {
    setShowDialog(false);
    pendingCallbackRef.current = null;
  }, []);

  const requireAcceptance = useCallback((onAccepted: () => void): boolean => {
    if (isPrivacyAccepted()) return true;
    pendingCallbackRef.current = onAccepted;
    setShowDialog(true);
    return false;
  }, []);

  return { accepted, accept, showDialog, closeDialog, requireAcceptance };
}

export function PrivacyAcceptanceDialog({
  open,
  onAccept,
  onSkip,
  onClose,
  mode,
}: {
  open: boolean;
  onAccept: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  mode: "initial" | "require";
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {
      if (mode === "require" && onClose) onClose();
    }}>
      <DialogContent
        className={`max-w-md ${mode === "initial" ? "[&>button]:hidden" : ""}`}
        onPointerDownOutside={(e) => {
          if (mode === "initial") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (mode === "initial") e.preventDefault();
        }}
        data-testid="dialog-privacy-acceptance"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Policy
          </DialogTitle>
          <DialogDescription>
            {mode === "initial"
              ? "Please review our privacy policy to continue."
              : "You must accept the privacy policy before switching to online mode."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-3 pr-3 text-sm text-muted-foreground">
            <p>
              Mesh Utility collects location data, radio signal measurements, and device identifiers when you scan. This data is used to build the coverage map and is stored on our server.
            </p>
            <p>
              We do not collect your name, email, or personal contact information. No account or login is required. We do not use tracking cookies or share data with advertisers.
            </p>
            <p>
              The app requires Bluetooth and Location permissions to function. You can revoke these at any time through your browser or device settings.
            </p>
            <p>
              Data is also stored on your device for offline use. You can delete all data associated with your radio at any time from the Settings panel.
            </p>
            <p>
              Map tiles are loaded from CartoDB and Cloudflare. These services may log standard web request information. Altitude estimates may use the Open-Meteo elevation API.
            </p>
            <p className="text-xs">
              Read the{" "}
              <button
                onClick={() => window.open("/privacy", "_blank")}
                className="underline text-primary hover:text-primary/80"
                data-testid="link-full-privacy-policy"
              >
                full privacy policy
              </button>{" "}
              for complete details.
            </p>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={onAccept}
            className="w-full"
            data-testid="button-accept-privacy"
          >
            I Accept
          </Button>
          {mode === "initial" && onSkip && (
            <Button
              variant="outline"
              onClick={onSkip}
              className="w-full"
              data-testid="button-skip-privacy"
            >
              <WifiOff className="h-3.5 w-3.5 mr-1.5" />
              Skip (Offline Only)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
