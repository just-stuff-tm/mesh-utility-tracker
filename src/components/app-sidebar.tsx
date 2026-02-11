import { Map, Radio, Activity, DollarSign, Shield, HelpCircle, Share2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { toast } = useToast();
  const { t } = useI18n();

  const navItems = [
    { title: t("nav.coverageMap"), key: "coverage-map", url: "/", icon: Map },
    { title: t("nav.nodes"), key: "nodes", url: "/nodes", icon: Radio },
    { title: t("nav.scanHistory"), key: "scan-history", url: "/history", icon: Activity },
    { title: t("nav.howToUse"), key: "how-to-use", url: "/manual", icon: HelpCircle },
  ];

  const handleShare = () => {
    const url = window.location.origin;
    const shareData = {
      title: "Mesh Utility",
      text: "Map your LoRa MeshCore mesh network coverage",
      url,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: t("toast.linkCopied") });
      }).catch(() => {
        toast({ title: t("toast.couldNotCopy"), variant: "destructive" });
      });
    } else {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      toast({ title: t("toast.linkCopied") });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/app-icon.png"
            alt="Mesh Utility"
            className="w-9 h-9 rounded-md object-cover"
          />
          <div>
            <h2 className="text-sm font-semibold leading-none">Mesh Utility</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">LoRa MeshCore</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.key}`}
                  >
                    <Link
                      href={item.url}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex flex-col gap-2 items-center">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleShare}
            data-testid="button-share-app"
          >
            <Share2 className="h-3 w-3 mr-1.5" />
            {t("nav.shareApp")}
          </Button>
          <a
            href="https://cash.app/$yuptm"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/10 to-green-500/10 dark:from-emerald-500/15 dark:to-green-500/15 border border-emerald-500/20 px-3 py-1.5 transition-all duration-200 hover:from-emerald-500/20 hover:to-green-500/20 hover:border-emerald-500/40"
            data-testid="link-cashapp-support"
          >
            <DollarSign className="h-3 w-3 text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {t("nav.supportDev")}
            </span>
          </a>
          <Link
            href="/privacy"
            onClick={() => { if (isMobile) setOpenMobile(false); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
            data-testid="link-privacy-policy"
          >
            <Shield className="h-3 w-3" />
            <span>{t("nav.privacyPolicy")}</span>
          </Link>
          <p className="text-[10px] text-muted-foreground text-center">
            Mesh Utility v1.2
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
