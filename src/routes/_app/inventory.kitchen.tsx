import { createFileRoute, redirect } from "@tanstack/react-router";
import { InventoryView } from "@/components/InventoryView";

export const Route = createFileRoute("/_app/inventory/kitchen")({
  component: () => (
    <InventoryView
      department="kitchen"
      title="Stok Kitchen"
      description="Kelola bahan dapur — masuk, keluar, dan stok minimum."
    />
  ),
});
