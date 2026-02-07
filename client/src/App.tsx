import { useState, createContext, useContext } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BluetoothProvider } from "@/lib/bluetooth-context";
import { Heart } from "lucide-react";
import { CompatibilityDialog } from "@/components/compatibility-dialog";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PrivacyAcceptanceDialog, usePrivacyAccepted, isPrivacyAccepted } from "@/components/privacy-acceptance-dialog";
import { setForceOffline, getForceOffline } from "@/lib/offline-store";
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
  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/nodes" component={NodesPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/manual" component={ManualPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

if (!isPrivacyAccepted() && !getForceOffline()) {
  setForceOffline(true);
}

function AppContent() {
  const { accepted, accept, showDialog, closeDialog, requireAcceptance } = usePrivacyAccepted();
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
                <div className="flex items-center gap-2">
                  <OfflineIndicator />
                  <a
                    href="https://cash.app/$yuptm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-green-500/15 border border-emerald-500/25 px-2.5 py-1 transition-all duration-200 hover:from-emerald-500/25 hover:to-green-500/25 hover:border-emerald-500/40"
                    data-testid="link-support-header"
                  >
                    <Heart className="h-3 w-3 text-emerald-500" />
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Support
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
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
