import { Map, Radio, Settings, Activity } from "lucide-react";
import { useLocation } from "wouter";
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
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Coverage Map", url: "/", icon: Map },
  { title: "Nodes", url: "/nodes", icon: Radio },
  { title: "Scan History", url: "/history", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

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
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <p className="text-[10px] text-muted-foreground text-center">
          Mesh Utility v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
