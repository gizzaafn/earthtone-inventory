import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, TrendingUp, Coins, ChefHat, Wine } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Curated palette for category pie — distinct + on-brand
const CATEGORY_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

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

  // Recent movements (for quick-stats turnover & "Top keluar")
  const { data: recentMovements = [] } = useQuery({
    queryKey: ["movements", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, inventory_items(name, unit, category, unit_price_idr)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // 6-month movement history for trend charts
  const { data: trendMovements = [] } = useQuery({
    queryKey: ["movements", "trend-6m"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("stock_movements")
        .select("created_at, quantity, movement_type, item_id, inventory_items(name, unit_price_idr)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const totalItems = items.length;
  const lowStock = items.filter((i) => Number(i.current_stock) <= Number(i.min_stock));
  const totalValue = items.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_price_idr), 0);

  // ---- Build last 6 months scaffold ----
  const months: { key: string; label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  // ---- Top 3 most-used items overall (out movements only) → series for bar chart ----
  const itemOutTotal = new Map<string, { name: string; unit: string; total: number }>();
  trendMovements.forEach((m: any) => {
    if (m.movement_type !== "out") return;
    const name = m.inventory_items?.name ?? "—";
    const prev = itemOutTotal.get(m.item_id);
    itemOutTotal.set(m.item_id, {
      name,
      unit: items.find((i) => i.id === m.item_id)?.unit ?? "",
      total: (prev?.total ?? 0) + Number(m.quantity),
    });
  });
  const topItems = Array.from(itemOutTotal.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  const monthlyUsage = months.map((m) => {
    const row: Record<string, string | number> = { month: m.label };
    topItems.forEach(([id, meta]) => {
      row[meta.name] = 0;
    });
    trendMovements.forEach((mv: any) => {
      if (mv.movement_type !== "out") return;
      const d = new Date(mv.created_at);
      if (d.getFullYear() !== m.year || d.getMonth() !== m.month) return;
      const top = topItems.find(([id]) => id === mv.item_id);
      if (!top) return;
      const key = top[1].name;
      row[key] = Number(row[key] ?? 0) + Number(mv.quantity);
    });
    return row;
  });

  // ---- Monthly cost trend (sum of out qty × unit_price_idr) ----
  const monthlyCost = months.map((m) => {
    let cost = 0;
    trendMovements.forEach((mv: any) => {
      if (mv.movement_type !== "out") return;
      const d = new Date(mv.created_at);
      if (d.getFullYear() !== m.year || d.getMonth() !== m.month) return;
      const price = Number(mv.inventory_items?.unit_price_idr ?? 0);
      cost += Number(mv.quantity) * price;
    });
    return { month: m.label, cost };
  });

  // ---- Inventory distribution by category (value-weighted) ----
  const categoryMap = new Map<string, number>();
  items.forEach((i) => {
    const value = Number(i.current_stock) * Number(i.unit_price_idr);
    if (value <= 0) return;
    categoryMap.set(i.category, (categoryMap.get(i.category) ?? 0) + value);
  });
  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
  const TOP_CATS = 5;
  const headCats = sortedCategories.slice(0, TOP_CATS);
  const tailValue = sortedCategories.slice(TOP_CATS).reduce((s, [, v]) => s + v, 0);
  const totalCatValue = sortedCategories.reduce((s, [, v]) => s + v, 0) || 1;
  const categoryDistribution = [
    ...headCats.map(([name, value]) => ({ name, value })),
    ...(tailValue > 0 ? [{ name: "Lainnya", value: tailValue }] : []),
  ].map((c) => ({ ...c, pct: Math.round((c.value / totalCatValue) * 100) }));

  // ---- Quick stats ----
  const outMovements = recentMovements.filter((m: any) => m.movement_type === "out");
  const avgOutValue =
    outMovements.length === 0
      ? 0
      : outMovements.reduce(
          (s: number, m: any) =>
            s + Number(m.quantity) * Number(m.inventory_items?.unit_price_idr ?? 0),
          0,
        ) / outMovements.length;

  // Stock turnover ≈ total out qty (last 6m) / avg current stock
  const totalOut6m = trendMovements
    .filter((m: any) => m.movement_type === "out")
    .reduce((s: number, m: any) => s + Number(m.quantity), 0);
  const avgStock = items.length === 0 ? 0 : items.reduce((s, i) => s + Number(i.current_stock), 0) / items.length;
  const stockTurnover = avgStock === 0 ? 0 : totalOut6m / avgStock / 6; // per month

  // Days to restock ≈ avg(stock / monthly out) * 30
  const monthlyOutPerItem = new Map<string, number>();
  trendMovements.forEach((m: any) => {
    if (m.movement_type !== "out") return;
    monthlyOutPerItem.set(m.item_id, (monthlyOutPerItem.get(m.item_id) ?? 0) + Number(m.quantity));
  });
  let daySum = 0;
  let dayCount = 0;
  items.forEach((i) => {
    const monthlyOut = (monthlyOutPerItem.get(i.id) ?? 0) / 6;
    if (monthlyOut <= 0) return;
    daySum += (Number(i.current_stock) / monthlyOut) * 30;
    dayCount++;
  });
  const daysToRestock = dayCount === 0 ? 0 : daySum / dayCount;

  const wastePct = totalItems === 0 ? 0 : (lowStock.length / totalItems) * 100;

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

      {/* Row 1: Monthly Usage Trends + Inventory Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Pemakaian Bulanan</CardTitle>
            <CardDescription>3 barang paling sering dipakai dalam 6 bulan terakhir.</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyUsage} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatNumber(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  {topItems.map(([id, meta], i) => (
                    <Bar
                      key={id}
                      dataKey={meta.name}
                      fill={CATEGORY_COLORS[i]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Inventaris per Kategori</CardTitle>
            <CardDescription>Berdasarkan nilai stok (IDR).</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryDistribution.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    dataKey="value"
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    label={({ name, pct }: any) => `${name} ${pct}%`}
                    labelLine={{ stroke: "var(--color-border)" }}
                  >
                    {categoryDistribution.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatIDR(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Monthly Cost Trend + Quick Stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tren Biaya Bulanan</CardTitle>
            <CardDescription>Estimasi biaya pemakaian (qty keluar × harga satuan) per bulan.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyCost.every((m) => m.cost === 0) ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyCost} margin={{ top: 10, right: 16, bottom: 5, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v) => compactIDR(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatIDR(v)}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: "var(--color-chart-1)", strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
            <CardDescription>Indikator operasional kunci.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <QuickStat label="Rata-rata Nilai Pemakaian" value={formatIDR(avgOutValue)} />
            <QuickStat label="Stock Turnover" value={`${stockTurnover.toFixed(1)}x / bln`} />
            <QuickStat label="Estimasi Hari Restock" value={`${daysToRestock.toFixed(1)} hari`} />
            <QuickStat
              label="Persentase Stok Rendah"
              value={`${wastePct.toFixed(1)}%`}
              valueClass={wastePct > 20 ? "text-warning" : "text-success"}
            />
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

function compactIDR(n: number): string {
  if (n >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return `Rp${n}`;
}

function EmptyChart() {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
      Belum ada data untuk ditampilkan.
    </div>
  );
}

function QuickStat({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
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
