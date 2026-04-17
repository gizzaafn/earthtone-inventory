import { createFileRoute, Outlet, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Coffee } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Coffee className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="mt-3 text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold">Akun belum memiliki role</h2>
          <p className="text-sm text-muted-foreground">
            Hubungi Super Admin untuk diberikan akses ke departemen Kitchen, Bar, atau Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-card/50 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">Vosale Cafe</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
