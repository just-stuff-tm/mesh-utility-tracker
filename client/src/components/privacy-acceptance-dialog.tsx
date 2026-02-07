import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRIVACY_ACCEPTED_KEY = "mesh-privacy-accepted";

export function usePrivacyAccepted() {
  const [accepted, setAccepted] = useState(
    () => localStorage.getItem(PRIVACY_ACCEPTED_KEY) === "true"
  );

  const accept = () => {
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, "true");
    setAccepted(true);
  };

  return { accepted, accept };
}

export function PrivacyAcceptanceDialog({
  accepted,
  onAccept,
}: {
  accepted: boolean;
  onAccept: () => void;
}) {
  if (accepted) return null;

  return (
    <Dialog open={!accepted} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="dialog-privacy-acceptance"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Policy
          </DialogTitle>
          <DialogDescription>
            Please review and accept our privacy policy to use Mesh Utility.
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

        <DialogFooter>
          <Button
            onClick={onAccept}
            className="w-full"
            data-testid="button-accept-privacy"
          >
            I Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
