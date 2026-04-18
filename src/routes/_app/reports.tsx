import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileSpreadsheet, FileText, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatIDR, formatNumber } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { canAccessKitchen, canAccessBar, isAdmin } = useAuth();
  const defaultDept = isAdmin ? "all" : canAccessKitchen ? "kitchen" : "bar";
  const [dept, setDept] = useState<string>(defaultDept);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["report-inventory", dept],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("*").order("name");
      if (dept !== "all") q = q.eq("department", dept as "kitchen" | "bar");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const buildRows = () =>
    items.map((i, idx) => ({
      No: idx + 1,
      Nama: i.name,
      Kategori: i.category,
      Departemen: i.department === "kitchen" ? "Kitchen" : "Bar",
      Satuan: i.unit,
      "Stok Saat Ini": Number(i.current_stock),
      "Stok Minimum": Number(i.min_stock),
      "Harga/Unit (IDR)": Number(i.unit_price_idr),
      "Total Nilai (IDR)": Number(i.current_stock) * Number(i.unit_price_idr),
      Status: Number(i.current_stock) <= Number(i.min_stock) ? "STOK RENDAH" : "Aman",
    }));

  const exportExcel = () => {
    try {
      const rows = buildRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventaris");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `vosale-inventaris-${dept}-${stamp}.xlsx`);
      toast.success("File Excel berhasil diunduh");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Vosale Cafe — Laporan Inventaris", 14, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const deptLabel = dept === "all" ? "Semua Departemen" : dept === "kitchen" ? "Kitchen" : "Bar";
      doc.text(`Departemen: ${deptLabel}`, 14, 22);
      doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 27);

      const rows = buildRows();
      autoTable(doc, {
        startY: 32,
        head: [Object.keys(rows[0] ?? { Nama: "", Kategori: "", Departemen: "", Satuan: "", "Stok Saat Ini": "", "Stok Minimum": "", "Harga/Unit (IDR)": "", "Total Nilai (IDR)": "", Status: "" })],
        body: rows.map((r) => Object.values(r).map((v) => String(v))),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [111, 78, 55] }, // cokelat kayu
        alternateRowStyles: { fillColor: [245, 239, 230] },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`vosale-inventaris-${dept}-${stamp}.pdf`);
      toast.success("File PDF berhasil diunduh");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalValue = items.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_price_idr), 0);
  const lowStockCount = items.filter((i) => Number(i.current_stock) <= Number(i.min_stock)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Laporan</h1>
        <p className="text-muted-foreground mt-1">Ekspor data inventaris ke Excel atau PDF.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter & Ekspor
          </CardTitle>
          <CardDescription>Pilih departemen lalu unduh laporan dalam format yang diinginkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium">Departemen</label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">Semua</SelectItem>}
                  {canAccessKitchen && <SelectItem value="kitchen">Kitchen</SelectItem>}
                  {canAccessBar && <SelectItem value="bar">Bar</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportExcel} disabled={items.length === 0} variant="outline" className="bg-success/10 border-success/30 text-success hover:bg-success/20 hover:text-success">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button onClick={exportPDF} disabled={items.length === 0} variant="outline" className="bg-warning/10 border-warning/30 text-warning hover:bg-warning/20 hover:text-warning">
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <SmallStat label="Total Item" value={formatNumber(items.length)} />
            <SmallStat label="Stok Rendah" value={formatNumber(lowStockCount)} />
            <SmallStat label="Total Nilai" value={formatIDR(totalValue)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pratinjau Data</CardTitle>
          <CardDescription>Data yang akan diekspor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden sm:table-cell">Kategori</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Memuat...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada data.</TableCell></TableRow>
                ) : (
                  items.map((i) => {
                    const low = Number(i.current_stock) <= Number(i.min_stock);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{i.category}</TableCell>
                        <TableCell><Badge variant="secondary">{i.department === "kitchen" ? "Kitchen" : "Bar"}</Badge></TableCell>
                        <TableCell className="text-right">{formatNumber(Number(i.current_stock))} {i.unit}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{formatIDR(Number(i.current_stock) * Number(i.unit_price_idr))}</TableCell>
                        <TableCell>
                          {low ? <Badge variant="destructive">Rendah</Badge> : <Badge className="bg-success text-success-foreground hover:bg-success/90">Aman</Badge>}
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
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/30">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold truncate">{value}</p>
    </div>
  );
}
