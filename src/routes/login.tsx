import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import vosaleLogo from "@/assets/vosale-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);


  if (isAuthenticated) {
    navigate({ to: "/dashboard" });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success("Selamat datang kembali!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-secondary to-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-24 w-24 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            <img
              src={vosaleLogo}
              alt="Logo Vosale Cafe"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Vosale Cafe</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistem Manajemen Inventaris</p>
        </div>

        <Card className="shadow-xl border-border/60">
          <CardHeader>
            <CardTitle>Masuk ke akun Anda</CardTitle>
            <CardDescription>Gunakan email dan kata sandi yang diberikan oleh admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@vosale.cafe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Memproses..." : "Masuk"}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
