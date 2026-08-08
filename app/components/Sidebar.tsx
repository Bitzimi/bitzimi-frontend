import { Link, useLocation } from "react-router";
import {
  ClipboardList,
  Gamepad2,
  Wallet,
  Users,
  Settings
} from "lucide-react";
import logo from "../../imports/1000109381-1.png";
import { usePlatform } from "../contexts/PlatformContext";
import { useSettings } from "../contexts/SettingsContext";

export function Sidebar() {
  const location = useLocation();
  const { branding } = usePlatform();
  const { t } = useSettings();

  const navItems = [
    { path: "/tasks", icon: ClipboardList, label: t("nav.tasks", "Tasks") },
    { path: "/game", icon: Gamepad2, label: t("nav.games", "Game") },
    { path: "/referrals", icon: Users, label: t("nav.referrals", "Referral") },
    { path: "/wallet", icon: Wallet, label: t("nav.wallet", "Wallet") },
    { path: "/settings", icon: Settings, label: t("nav.settings", "Settings") },
  ];

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-sidebar border-r border-gray-200 dark:border-sidebar-border h-screen sticky top-0">
      <div className="p-6 border-b border-gray-200 dark:border-sidebar-border">
        <img src={branding.logoUrl || logo} alt={branding.name} className="h-8 w-auto" />
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-sidebar-accent text-blue-600 dark:text-yellow-500 shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-sidebar-accent/50"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-sidebar-border">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          © {branding.copyrightYear || new Date().getFullYear()} {branding.name}
        </div>
      </div>
    </aside>
  );
}