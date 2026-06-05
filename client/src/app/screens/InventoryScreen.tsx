import React, { useEffect, useState } from "react";
import {
  Filter,
  Download,
  Plus,
  Pill,
  AlertTriangle,
  Eye,
  Edit,
  MoreVertical,
} from "lucide-react";
import {
  inventoryService,
  InventoryItem,
} from "../../services/inventory.service";

interface InventoryScreenProps {
  searchQuery: string;
}

export function InventoryScreen({ searchQuery }: InventoryScreenProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await inventoryService.getAll();
        setInventory(response.data);
      } catch (err) {
        console.error("Failed to fetch inventory:", err);
        setError("Failed to load inventory data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  const filteredData = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batch.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        Loading inventory...
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Inventory Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage all medication stock and batches
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent">
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Medication</span>
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-3">
        <FilterChip label="All" active count={filteredData.length} />
        <FilterChip
          label="Low Stock"
          count={filteredData.filter((i) => i.status === "low").length}
        />
        <FilterChip
          label="Expiring Soon"
          count={filteredData.filter((i) => i.status === "expiring").length}
        />
        <FilterChip
          label="Out of Stock"
          count={filteredData.filter((i) => i.status === "out").length}
        />
        <FilterChip
          label="Expired"
          count={filteredData.filter((i) => i.status === "expired").length}
        />
      </div>

      {/* Inventory Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Medication
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Category
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Batch
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Stock
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Location
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Expiry
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((item) => (
                <tr key={item._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Pill className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {item.category}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                    {item.batch}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.stock}
                      </span>
                      {item.stock < item.minStock && (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {item.location}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(item.expiry).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-accent rounded">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 hover:bg-accent rounded">
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 hover:bg-accent rounded">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              1-{filteredData.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {inventory.length}
            </span>{" "}
            results
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-border rounded hover:bg-accent text-sm">
              Previous
            </button>
            <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm">
              1
            </button>
            <button className="px-3 py-1.5 border border-border rounded hover:bg-accent text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: any) {
  const badges = {
    optimal: { label: "Optimal", class: "bg-success/10 text-success" },
    low: { label: "Low Stock", class: "bg-warning/10 text-warning" },
    out: { label: "Out of Stock", class: "bg-destructive/10 text-destructive" },
    expiring: {
      label: "Expiring Soon",
      class: "bg-secondary/10 text-secondary",
    },
    expired: { label: "Expired", class: "bg-destructive/10 text-destructive" },
  };

  const badge = badges[status as keyof typeof badges] || badges.optimal;
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.class}`}
    >
      {badge.label}
    </span>
  );
}

function FilterChip({ label, active, count }: any) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label} {count !== undefined && `(${count})`}
    </button>
  );
}
