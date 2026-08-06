import { Link, useLocation } from "react-router";
import {
  ClipboardList,
  Gamepad2,
  Wallet,
  Users,
  Settings
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

export function MobileNav() {
  const location = useLocation();
  const { t } = useSettings();

  const navItems = [
    { path: "/tasks", icon: ClipboardList, label: t("nav.tasks", "Tasks") },
    { path: "/game", icon: Gamepad2, label: t("nav.games", "Game") },
    { path: "/referrals", icon: Users, label: t("nav.referrals", "Referral") },
    { path: "/wallet", icon: Wallet, label: t("nav.wallet", "Wallet") },
    { path: "/settings", icon: Settings, label: t("nav.settings", "Settings") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-sidebar border-t border-gray-200 dark:border-sidebar-border z-50 md:hidden shadow-lg dark:shadow-xl">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 ${
                isActive ? "text-blue-600 dark:text-yellow-500" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-blue-600 dark:text-yellow-500" : "text-gray-600 dark:text-gray-400"}`} />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}