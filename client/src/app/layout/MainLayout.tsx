import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Pill,
  Package,
  AlertTriangle,
  BarChart3,
  FileText,
  Warehouse,
  Truck,
  Users,
  Bell,
  Search,
  Menu,
  X,
  Settings,
  LogOut,
  UserCircle,
  ScanLine
} from 'lucide-react';
import { NavItem } from '../components/layout/NavItem';
import { authService, User } from '../../services/auth.service';

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
  onSearchChange
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(authService.getCurrentUser());
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-sidebar border-r border-sidebar-border transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">MediTrack</h1>
              <p className="text-xs text-muted-foreground">Pro Healthcare</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={currentScreen === 'dashboard'} onClick={() => onScreenChange('dashboard')} />
          <NavItem icon={ScanLine} label="Scan Medication" active={currentScreen === 'scanning'} onClick={() => onScreenChange('scanning')} />
          <NavItem icon={Package} label="Inventory" active={currentScreen === 'inventory'} onClick={() => onScreenChange('inventory')} badge="8" />
          <NavItem icon={AlertTriangle} label="Expiration Monitor" active={currentScreen === 'expiration'} onClick={() => onScreenChange('expiration')} badge="5" badgeVariant="warning" />
          <NavItem icon={BarChart3} label="Analytics" active={currentScreen === 'analytics'} onClick={() => onScreenChange('analytics')} />
          <NavItem icon={FileText} label="Reports" active={currentScreen === 'reports'} onClick={() => onScreenChange('reports')} />
          <NavItem icon={Warehouse} label="Storage Units" active={currentScreen === 'storage'} onClick={() => onScreenChange('storage')} />
          <NavItem icon={Truck} label="Suppliers" active={currentScreen === 'suppliers'} onClick={() => onScreenChange('suppliers')} />
          <NavItem icon={Users} label="User Management" active={currentScreen === 'users'} onClick={() => onScreenChange('users')} />
          <NavItem icon={Bell} label="Notifications" active={currentScreen === 'notifications'} onClick={() => onScreenChange('notifications')} badge="12" badgeVariant="danger" />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent">
            <UserCircle className="w-8 h-8 text-sidebar-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Loading...'}</p>
              <p className="text-xs text-muted-foreground">{user?.role || 'User'}</p>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-accent rounded-lg">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search medications, batches, suppliers..."
                className="w-96 pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 hover:bg-accent rounded-lg">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-accent rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={onLogout} className="p-2 hover:bg-accent rounded-lg">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
