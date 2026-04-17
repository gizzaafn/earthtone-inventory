import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Coffee, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

/**
 * One-time admin bootstrap. Allowed only if there are zero admins in the system.
 * Once an admin exists, this page becomes read-only.
 */
function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      setAdminExists((count ?? 0) > 0);
      setChecking(false);
    })();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Re-check to prevent race
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) {
        toast.error("Admin sudah ada. Silakan login.");
        setAdminExists(true);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Gagal membuat akun.");

      // Insert admin role (RLS allows because no admin exists yet — but our policy requires admin).
      // We rely on the fact that user is now authenticated and there are zero admins, so we use a one-time RPC-like approach:
      // Insert via authenticated session — policy only allows admin. So we use service via DB function instead.
      const { error: roleErr } = await supabase.rpc("bootstrap_first_admin");
      if (roleErr) throw roleErr;

      toast.success("Admin berhasil dibuat. Silakan masuk.");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat admin");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Memeriksa konfigurasi...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-secondary to-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg mb-4">
            <Coffee className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-primary">Vosale Cafe</h1>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <CardTitle>Setup Admin Pertama</CardTitle>
            </div>
            <CardDescription>
              Halaman ini hanya tersedia satu kali untuk membuat akun Super Admin pertama.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {adminExists ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Admin sudah dibuat. Setup tidak lagi tersedia.
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">Ke Halaman Login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama lengkap</Label>
                  <Input
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Kata sandi (min. 8 karakter)</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Membuat..." : "Buat Admin"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
