import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ChefHat, Wine, FileBarChart, Users, LogOut } from "lucide-react";
import vosaleLogo from "@/assets/vosale-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user, role, isAdmin, canAccessKitchen, canAccessBar } = useAuth();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const roleLabel: Record<string, string> = {
    admin: "Super Admin",
    kitchen: "Kitchen",
    bar: "Barista",
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shrink-0">
            <Coffee className="h-5 w-5" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-semibold text-sm leading-tight">Vosale Cafe</p>
            <p className="text-xs text-muted-foreground">Inventaris</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")} tooltip="Dashboard">
                  <Link to="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {canAccessKitchen && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/inventory/kitchen")} tooltip="Stok Kitchen">
                    <Link to="/inventory/kitchen">
                      <ChefHat />
                      <span>Stok Kitchen</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {canAccessBar && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/inventory/bar")} tooltip="Stok Bar">
                    <Link to="/inventory/bar">
                      <Wine />
                      <span>Stok Bar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/reports")} tooltip="Laporan">
                  <Link to="/reports">
                    <FileBarChart />
                    <span>Laporan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrasi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/users")} tooltip="Manajemen User">
                    <Link to="/users">
                      <Users />
                      <span>Manajemen User</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <p className="text-xs font-medium truncate">{user?.email}</p>
          {role && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {roleLabel[role]}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden ml-2">Keluar</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
