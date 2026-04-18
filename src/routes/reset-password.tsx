import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import vosaleLogo from "@/assets/vosale-logo.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session via hash (#access_token=...&type=recovery)
    // The client auto-parses it. Listen for PASSWORD_RECOVERY or just check session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi kata sandi tidak cocok");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Kata sandi berhasil diperbarui!");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memperbarui kata sandi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-secondary to-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-24 w-24 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            <img src={vosaleLogo} alt="Logo Vosale Cafe" className="h-full w-full object-contain p-1" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Vosale Cafe</h1>
          <p className="text-sm text-muted-foreground mt-1">Atur Ulang Kata Sandi</p>
        </div>

        <Card className="shadow-xl border-border/60">
          <CardHeader>
            <CardTitle>Buat kata sandi baru</CardTitle>
            <CardDescription>
              {ready && !validSession
                ? "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru."
                : "Masukkan kata sandi baru Anda di bawah ini."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready && validSession ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw">Kata sandi baru</Label>
                  <Input
                    id="pw"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf">Konfirmasi kata sandi</Label>
                  <Input
                    id="cf"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Menyimpan..." : "Simpan kata sandi baru"}
                </Button>
              </form>
            ) : (
              <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
                Kembali ke halaman masuk
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
