import { WifiOff, RefreshCw } from "lucide-react";
import { useOfflineStatus } from "@/lib/use-offline";
import { useI18n } from "@/lib/i18n";

export function OfflineIndicator() {
  const { online, pendingSync, syncing } = useOfflineStatus();
  const { t } = useI18n();

  if (online && pendingSync === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
      data-testid="status-offline-indicator"
    >
      {!online ? (
        <>
          <WifiOff className="h-3 w-3 text-orange-500" />
          <span className="text-orange-500">{t("offline.offline")}</span>
        </>
      ) : pendingSync > 0 ? (
        <>
          <RefreshCw className={`h-3 w-3 text-blue-500 ${syncing ? "animate-spin" : ""}`} />
          <span className="text-blue-500">{syncing ? t("offline.syncing") : `${pendingSync} ${t("offline.pending")}`}</span>
        </>
      ) : null}
    </div>
  );
}
