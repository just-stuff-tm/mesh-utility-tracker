import { Map, Radio, Activity, DollarSign } from "lucide-react";
import { useLocation, Link } from "wouter";
import appIconPath from "@assets/app_icon_1770389147147.png";
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

const navItems = [
  { title: "Coverage Map", url: "/", icon: Map },
  { title: "Nodes", url: "/nodes", icon: Radio },
  { title: "Scan History", url: "/history", icon: Activity },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <img
            src={appIconPath}
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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
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
          <a
            href="https://cash.app/$yuptm"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/10 to-green-500/10 dark:from-emerald-500/15 dark:to-green-500/15 border border-emerald-500/20 px-3 py-1.5 transition-all duration-200 hover:from-emerald-500/20 hover:to-green-500/20 hover:border-emerald-500/40"
            data-testid="link-cashapp-support"
          >
            <DollarSign className="h-3 w-3 text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Support Development
            </span>
          </a>
          <p className="text-[10px] text-muted-foreground text-center">
            Mesh Utility v1.0
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
