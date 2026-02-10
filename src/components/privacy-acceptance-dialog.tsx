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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const parts = t("privacy.readFull").split("{link}");

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
            {t("privacy.title")}
          </DialogTitle>
          <DialogDescription>
            {mode === "initial"
              ? t("privacy.reviewDesc")
              : t("privacy.requireDesc")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-3 pr-3 text-sm text-muted-foreground">
            <p>{t("privacy.body1")}</p>
            <p>{t("privacy.body2")}</p>
            <p>{t("privacy.body3")}</p>
            <p>{t("privacy.body4")}</p>
            <p>{t("privacy.body5")}</p>
            <p className="text-xs">
              {parts[0]}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary hover:text-primary/80"
                data-testid="link-full-privacy-policy"
              >
                {t("privacy.fullPolicy")}
              </a>
              {parts[1]}
            </p>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={onAccept}
            className="w-full"
            data-testid="button-accept-privacy"
          >
            {t("privacy.iAccept")}
          </Button>
          {mode === "initial" && onSkip && (
            <Button
              variant="outline"
              onClick={onSkip}
              className="w-full"
              data-testid="button-skip-privacy"
            >
              <WifiOff className="h-3.5 w-3.5 mr-1.5" />
              {t("privacy.skipOffline")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
