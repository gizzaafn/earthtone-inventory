import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatIDR, formatNumber, formatRelativeTime, formatDateTime } from "@/lib/format";

type Department = "kitchen" | "bar";

interface Item {
  id: string;
  name: string;
  category: string;
  department: Department;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_price_idr: number;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

const KITCHEN_CATEGORIES = ["Bahan Pokok", "Sayur", "Daging", "Bumbu", "Lainnya"];
const BAR_CATEGORIES = ["Kopi", "Susu", "Sirup", "Teh", "Lainnya"];

export function InventoryView({
  department,
  title,
  description,
}: {
  department: Department;
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [movement, setMovement] = useState<{ item: Item; type: "in" | "out" } | null>(null);

  const categories = department === "kitchen" ? KITCHEN_CATEGORIES : BAR_CATEGORIES;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("department", department)
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  // Tick every 30s so relative timestamps stay fresh on screen.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: refresh whenever items or movements change for this department.
  useEffect(() => {
    const channel = supabase
      .channel(`inventory-${department}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items", filter: `department=eq.${department}` },
        () => qc.invalidateQueries({ queryKey: ["inventory", department] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_movements", filter: `department=eq.${department}` },
        () => qc.invalidateQueries({ queryKey: ["inventory", department] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [department, qc]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Barang dihapus");
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleAdd = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const handleEdit = (item: Item) => {
    setEditing(item);
    setOpenForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <Button onClick={handleAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Barang
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="sm:w-52">
                <SelectValue placeholder="Filter kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Harga/unit</TableHead>
                  <TableHead className="text-right w-[200px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Memuat...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada barang.</TableCell></TableRow>
                ) : (
                  filtered.map((i) => {
                    const low = Number(i.current_stock) <= Number(i.min_stock);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {low && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                            {i.name}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{i.category}</Badge></TableCell>
                        <TableCell className="text-right">
                          <span className={low ? "text-warning font-semibold" : ""}>
                            {formatNumber(Number(i.current_stock))} {i.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(Number(i.min_stock))} {i.unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatIDR(Number(i.unit_price_idr))}
                        </TableCell>
                        <TableCell>
                          <ItemActions
                            item={i}
                            onEdit={() => handleEdit(i)}
                            onMove={(type) => setMovement({ item: i, type })}
                            onDelete={() => deleteMut.mutate(i.id)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Memuat...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada barang.</p>
            ) : (
              filtered.map((i) => {
                const low = Number(i.current_stock) <= Number(i.min_stock);
                return (
                  <div key={i.id} className="rounded-lg border border-border p-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1">
                          {low && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                          {i.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{i.category}</p>
                      </div>
                      <Badge variant={low ? "destructive" : "secondary"}>
                        {formatNumber(Number(i.current_stock))} {i.unit}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Min: {formatNumber(Number(i.min_stock))} {i.unit} · {formatIDR(Number(i.unit_price_idr))}
                    </div>
                    <div className="mt-3">
                      <ItemActions
                        item={i}
                        onEdit={() => handleEdit(i)}
                        onMove={(type) => setMovement({ item: i, type })}
                        onDelete={() => deleteMut.mutate(i.id)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <ItemForm
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        department={department}
        categories={categories}
      />

      {movement && (
        <MovementDialog
          item={movement.item}
          type={movement.type}
          onClose={() => setMovement(null)}
        />
      )}
    </div>
  );
}

function ItemActions({
  item,
  onEdit,
  onMove,
  onDelete,
}: {
  item: Item;
  onEdit: () => void;
  onMove: (type: "in" | "out") => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1 flex-wrap">
      <Button size="sm" variant="outline" onClick={() => onMove("in")} className="h-8">
        <ArrowDownToLine className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Masuk</span>
      </Button>
      <Button size="sm" variant="outline" onClick={() => onMove("out")} className="h-8">
        <ArrowUpFromLine className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Keluar</span>
      </Button>
      <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus "{item.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Seluruh riwayat pergerakan stok untuk barang ini juga akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemForm({
  open,
  onOpenChange,
  editing,
  department,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Item | null;
  department: Department;
  categories: string[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    category: categories[0],
    unit: "pcs",
    current_stock: 0,
    min_stock: 0,
    unit_price_idr: 0,
    notes: "",
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("inventory_items")
          .update({
            name: form.name,
            category: form.category,
            unit: form.unit,
            min_stock: form.min_stock,
            unit_price_idr: form.unit_price_idr,
            notes: form.notes || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const { error } = await supabase.from("inventory_items").insert({
          name: form.name,
          category: form.category,
          department,
          unit: form.unit,
          current_stock: form.current_stock,
          min_stock: form.min_stock,
          unit_price_idr: form.unit_price_idr,
          notes: form.notes || null,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Barang diperbarui" : "Barang ditambahkan");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
      setForm({ name: "", category: categories[0], unit: "pcs", current_stock: 0, min_stock: 0, unit_price_idr: 0, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) {
        if (editing) {
          setForm({
            name: editing.name,
            category: editing.category,
            unit: editing.unit,
            current_stock: Number(editing.current_stock),
            min_stock: Number(editing.min_stock),
            unit_price_idr: Number(editing.unit_price_idr),
            notes: editing.notes ?? "",
          });
        } else {
          setForm({ name: "", category: categories[0], unit: "pcs", current_stock: 0, min_stock: 0, unit_price_idr: 0, notes: "" });
        }
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Barang" : "Tambah Barang Baru"}</DialogTitle>
          <DialogDescription>
            {editing ? "Perbarui detail barang." : "Stok awal dapat diisi langsung saat menambah barang baru."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama barang</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Satuan</Label>
              <Input id="unit" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, L..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="cur">Stok awal</Label>
                <Input id="cur" type="number" min={0} step="0.01" value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: Number(e.target.value) })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="min">Stok minimum</Label>
              <Input id="min" type="number" min={0} step="0.01" value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="price">Harga per unit (IDR)</Label>
              <Input id="price" type="number" min={0} value={form.unit_price_idr}
                onChange={(e) => setForm({ ...form, unit_price_idr: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan (opsional)</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  item,
  type,
  onClose,
}: {
  item: Item;
  type: "in" | "out";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (qty <= 0) throw new Error("Jumlah harus lebih dari 0");
      if (type === "out" && qty > Number(item.current_stock)) {
        throw new Error("Jumlah keluar melebihi stok saat ini");
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("stock_movements").insert({
        item_id: item.id,
        department: item.department,
        movement_type: type,
        quantity: qty,
        notes: notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(type === "in" ? "Stok masuk dicatat" : "Stok keluar dicatat");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Stok {type === "in" ? "Masuk" : "Keluar"} — {item.name}
          </DialogTitle>
          <DialogDescription>
            Stok saat ini: {formatNumber(Number(item.current_stock))} {item.unit}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qty">Jumlah ({item.unit})</Label>
            <Input id="qty" type="number" min={0.01} step="0.01" required value={qty || ""}
              onChange={(e) => setQty(Number(e.target.value))} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mnotes">Catatan (opsional)</Label>
            <Textarea id="mnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Memproses..." : "Catat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
