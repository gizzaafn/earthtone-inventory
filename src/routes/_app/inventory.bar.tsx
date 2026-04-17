import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/InventoryView";

export const Route = createFileRoute("/_app/inventory/bar")({
  component: () => (
    <InventoryView
      department="bar"
      title="Stok Bar"
      description="Kelola bahan bar — kopi, susu, sirup, dan teh."
    />
  ),
});
