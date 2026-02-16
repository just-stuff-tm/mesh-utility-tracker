import { useState, createContext, useContext } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BluetoothProvider } from "@/lib/bluetooth-context";
import { SiDiscord } from "react-icons/si";
import { CompatibilityDialog } from "@/components/compatibility-dialog";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PrivacyAcceptanceDialog, usePrivacyAccepted, isPrivacyAccepted } from "@/components/privacy-acceptance-dialog";
import { setForceOffline, getForceOffline } from "@/lib/offline-store";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { BuyMeCoffeeButton } from "@/components/buy-me-coffee-button";
import NotFound from "@/pages/not-found";
import MapPage from "@/pages/map-page";
import NodesPage from "@/pages/nodes-page";
import HistoryPage from "@/pages/history-page";
import PrivacyPage from "@/pages/privacy-page";
import ManualPage from "@/pages/manual-page";

interface PrivacyContextType {
  accepted: boolean;
  requireAcceptance: (onAccepted: () => void) => boolean;
  accept: () => void;
  showDialog: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export const PrivacyContext = createContext<PrivacyContextType>({
  accepted: false,
  requireAcceptance: () => false,
  accept: () => {},
  showDialog: false,
  openDialog: () => {},
  closeDialog: () => {},
});

export function usePrivacyContext() {
  return useContext(PrivacyContext);
}
function Router() {
  const base = import.meta.env.BASE_URL;
  return (
    <WouterRouter base={base}>
      <Switch>
        <Route path="/" component={MapPage} />
        <Route path="/nodes" component={NodesPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/manual" component={ManualPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

if (!isPrivacyAccepted() && !getForceOffline()) {
  setForceOffline(true);
}

// ObserversOnline removed - no longer tracked in Cloudflare Worker architecture

function AppContent() {
  const { accepted, accept, showDialog, closeDialog, requireAcceptance } = usePrivacyAccepted();
  const { t } = useI18n();
  const [location] = useLocation();
  const isPrivacyRoute = location === "/privacy";
  const [showInitialPrivacy, setShowInitialPrivacy] = useState(!accepted);

  const handleAcceptInitial = () => {
    accept();
    setShowInitialPrivacy(false);
  };

  const handleSkip = () => {
    setShowInitialPrivacy(false);
  };

  return (
    <BluetoothProvider>
      <PrivacyContext.Provider value={{ accepted, requireAcceptance, accept, showDialog, openDialog: () => {}, closeDialog }}>
        <PrivacyAcceptanceDialog
          open={showInitialPrivacy && !isPrivacyRoute}
          onAccept={handleAcceptInitial}
          onSkip={handleSkip}
          mode="initial"
        />
        <PrivacyAcceptanceDialog
          open={showDialog}
          onAccept={accept}
          onClose={closeDialog}
          mode="require"
        />
        <SidebarProvider style={{ "--sidebar-width": "14rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <header className="flex items-center justify-between gap-2 p-2 border-b border-border shrink-0 z-50 bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-2 flex-wrap">
                  {/* ObserversOnline removed - no backend tracking */}
                  <OfflineIndicator />
                  <BuyMeCoffeeButton
                    className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 hover-elevate"
                    dataTestId="link-support-header"
                    size="header"
                  />
                  <a
                    href="https://discord.gg/Xyhjz7CtuW"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 hover-elevate"
                    data-testid="link-discord-header"
                  >
                    <SiDiscord className="h-3 w-3 text-indigo-500" />
                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                      Discord
                    </span>
                  </a>
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <CompatibilityDialog />
        <Toaster />
      </PrivacyContext.Provider>
    </BluetoothProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
