import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Shield, ChefHat, Wine, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

interface UserRow {
  user_id: string;
  role: "admin" | "kitchen" | "bar";
  profile: { email: string | null; full_name: string | null } | null;
}

function UsersPage() {
  const { isAdmin, loading, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;

      const userIds = Array.from(new Set(roles.map((r) => r.user_id)));
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      return roles.map((r) => ({
        user_id: r.user_id,
        role: r.role as "admin" | "kitchen" | "bar",
        profile: profiles?.find((p) => p.id === r.user_id) ?? null,
      })) as UserRow[];
    },
    enabled: isAdmin,
  });

  const handleDelete = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User dihapus");
      qc.invalidateQueries({ queryKey: ["users-list"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!isAdmin) return null;

  const roleConfig: Record<string, { label: string; icon: any; color: string }> = {
    admin: { label: "Super Admin", icon: Shield, color: "bg-primary/15 text-primary" },
    kitchen: { label: "Kitchen", icon: ChefHat, color: "bg-warning/15 text-warning" },
    bar: { label: "Barista", icon: Wine, color: "bg-accent/30 text-accent-foreground" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Manajemen User</h1>
          <p className="text-muted-foreground mt-1">Kelola staf yang dapat mengakses sistem.</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar User</CardTitle>
          <CardDescription>Total: {users.length} user terdaftar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Memuat...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada user.</TableCell></TableRow>
                ) : (
                  users.map((u) => {
                    const cfg = roleConfig[u.role];
                    const Icon = cfg.icon;
                    const isSelf = u.user_id === currentUser?.id;
                    return (
                      <TableRow key={u.user_id + u.role}>
                        <TableCell className="font-medium">
                          {u.profile?.full_name ?? "—"}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.profile?.email ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditUser(u)}
                              title="Edit user"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isSelf && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus user ini?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      User <strong>{u.profile?.email}</strong> akan kehilangan akses permanen ke sistem.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(u.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog open={openForm} onOpenChange={setOpenForm} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "kitchen" as "admin" | "kitchen" | "bar" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: form,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["users-list"] });
      onOpenChange(false);
      setForm({ email: "", password: "", full_name: "", role: "kitchen" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah User Baru</DialogTitle>
          <DialogDescription>User akan langsung aktif dan dapat login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fn">Nama lengkap</Label>
            <Input id="fn" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em">Email</Label>
            <Input id="em" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Kata sandi (min. 8 karakter)</Label>
            <Input id="pw" type="password" required minLength={8} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Barista (Bar)</SelectItem>
                <SelectItem value="admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={busy}>{busy ? "Membuat..." : "Buat User"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
