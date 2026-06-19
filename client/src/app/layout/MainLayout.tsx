import React, { useState } from "react";
import {
  LayoutDashboard,
  Pill,
  Package,
  AlertTriangle,
  BarChart3,
  FileText,
  Warehouse,
  Truck,
  Tags,
  ShoppingCart,
  Search,
  Menu,
  X,
  Settings,
  LogOut,
  UserCircle,
  ScanLine,
  Users,
} from "lucide-react";
import { NavItem } from "../components/layout/NavItem";
import { NotificationBell } from "../components/layout/NotificationBell";
import { useAuth } from "../components/useAuth";

interface MainLayoutProps {
  children: React.ReactNode;
  currentScreen: string;
  onScreenChange: (screen: any) => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MainLayout({
  children,
  currentScreen,
  onScreenChange,
  onLogout,
  searchQuery,
  onSearchChange,
}: MainLayoutProps) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"} bg-sidebar border-r border-sidebar-border transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                MediTrack
              </h1>
              <p className="text-xs text-muted-foreground">Santé Pro</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem
            icon={LayoutDashboard}
            label="Tableau de bord"
            active={currentScreen === "dashboard"}
            onClick={() => onScreenChange("dashboard")}
          />
          <NavItem
            icon={ScanLine}
            label="Scanner un médicament"
            active={currentScreen === "scanning"}
            onClick={() => onScreenChange("scanning")}
          />
          <NavItem
            icon={Package}
            label="Inventaire"
            active={currentScreen === "inventory"}
            onClick={() => onScreenChange("inventory")}
          />
          <NavItem
            icon={Tags}
            label="Médicaments"
            active={currentScreen === "medications"}
            onClick={() => onScreenChange("medications")}
          />
          <NavItem
            icon={AlertTriangle}
            label="Alertes & avertissements"
            active={currentScreen === "expiration"}
            onClick={() => onScreenChange("expiration")}
          />
          <NavItem
            icon={BarChart3}
            label="Analyses"
            active={currentScreen === "analytics"}
            onClick={() => onScreenChange("analytics")}
          />
          <NavItem
            icon={FileText}
            label="Rapports"
            active={currentScreen === "reports"}
            onClick={() => onScreenChange("reports")}
          />
          <NavItem
            icon={Warehouse}
            label="Unités de stockage"
            active={currentScreen === "storage"}
            onClick={() => onScreenChange("storage")}
          />
          <NavItem
            icon={Truck}
            label="Fournisseurs"
            active={currentScreen === "suppliers"}
            onClick={() => onScreenChange("suppliers")}
          />
          <NavItem
            icon={ShoppingCart}
            label="Achats"
            active={currentScreen === "purchasing"}
            onClick={() => onScreenChange("purchasing")}
          />
          {user?.role === "Administrator" && (
            <NavItem
              icon={Users}
              label="Utilisateurs"
              active={currentScreen === "users"}
              onClick={() => onScreenChange("users")}
            />
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={() => onScreenChange("profile")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent hover:bg-accent transition-colors ${currentScreen === "profile" ? "ring-2 ring-ring" : ""}`}
            title="Mon profil"
          >
            <UserCircle className="w-8 h-8 text-sidebar-foreground" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || "Chargement..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.role || "Utilisateur"}
              </p>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent rounded-lg"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher médicaments, lots, fournisseurs..."
                className="w-96 pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell onNavigate={() => onScreenChange("expiration")} />
            <button onClick={() => onScreenChange("profile")} className="p-2 hover:bg-accent rounded-lg" title="Mon profil">
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-accent rounded-lg"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
