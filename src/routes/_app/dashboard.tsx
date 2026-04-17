import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, TrendingUp, Coins, ChefHat, Wine } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: recentMovements = [] } = useQuery({
    queryKey: ["movements", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, inventory_items(name, unit)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const totalItems = items.length;
  const lowStock = items.filter((i) => Number(i.current_stock) <= Number(i.min_stock));
  const totalValue = items.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_price_idr), 0);

  // Top moved items (out movements)
  const moveCount = new Map<string, { name: string; qty: number; dept: string }>();
  recentMovements.forEach((m: any) => {
    if (m.movement_type !== "out") return;
    const key = m.item_id;
    const prev = moveCount.get(key);
    moveCount.set(key, {
      name: m.inventory_items?.name ?? "—",
      qty: (prev?.qty ?? 0) + Number(m.quantity),
      dept: m.department,
    });
  });
  const topUsed = Array.from(moveCount.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const deptStats = [
    {
      name: "Kitchen",
      value: items.filter((i) => i.department === "kitchen").length,
    },
    {
      name: "Bar",
      value: items.filter((i) => i.department === "bar").length,
    },
  ];

  const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Ringkasan inventaris Vosale Cafe.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Total Barang" value={formatNumber(totalItems)} accent="primary" />
        <StatCard
          icon={AlertTriangle}
          label="Stok Rendah"
          value={formatNumber(lowStock.length)}
          accent={lowStock.length > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={Coins}
          label="Nilai Inventaris"
          value={formatIDR(totalValue)}
          accent="accent"
          smallText
        />
        <StatCard
          icon={TrendingUp}
          label="Pergerakan (50 terakhir)"
          value={formatNumber(recentMovements.length)}
          accent="primary"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top 5 Barang Paling Banyak Keluar</CardTitle>
            <CardDescription>Berdasarkan 50 pergerakan terakhir.</CardDescription>
          </CardHeader>
          <CardContent>
            {topUsed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Belum ada data pergerakan.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topUsed} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="qty" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} name="Jumlah keluar" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Departemen</CardTitle>
            <CardDescription>Jumlah item per area.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={deptStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {deptStats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Low stock list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Peringatan Stok Rendah
          </CardTitle>
          <CardDescription>Barang dengan stok di bawah atau sama dengan batas minimum.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Memuat...</p>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Semua stok dalam kondisi aman. 🌿
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {i.department === "kitchen" ? (
                      <ChefHat className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Wine className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.category}</p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {formatNumber(Number(i.current_stock))} {i.unit}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  smallText,
}: {
  icon: any;
  label: string;
  value: string;
  accent: "primary" | "warning" | "accent" | "success";
  smallText?: boolean;
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    accent: "bg-accent/20 text-accent-foreground",
    success: "bg-success/15 text-success",
  };
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`mt-2 font-bold ${smallText ? "text-lg" : "text-2xl"} truncate`}>{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
