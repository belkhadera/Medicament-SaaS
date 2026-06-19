import { LucideIcon } from "lucide-react";

type AlertVariant = "danger" | "warning" | "info";

interface AlertCardProps {
  title: string;
  count: number;
  description: string;
  variant: AlertVariant;
  icon: LucideIcon;
}

const variants: Record<AlertVariant, string> = {
  danger: "bg-destructive/5 border-destructive/20 text-destructive",
  warning: "bg-warning/5 border-warning/20 text-warning",
  info: "bg-secondary/5 border-secondary/20 text-secondary",
};

export function AlertCard({ title, count, description, variant, icon: Icon }: AlertCardProps) {
  return (
    <div className={`rounded-lg border p-6 ${variants[variant]}`}>
      <Icon className="w-8 h-8 mb-4" />
      <h3 className="text-3xl font-bold mb-1">{count}</h3>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}
