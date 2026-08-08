import { useState } from "react";
import { Outlet } from "react-router";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminHeader } from "../components/AdminHeader";
import { AdminMobileNav } from "../components/AdminMobileNav";
import { AdminRouteGuard } from "../guards/AdminRouteGuard";

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <AdminRouteGuard requiredPermission="admin.dashboard.view">
      <div className="min-h-screen bg-[#09090b] text-zinc-100">

        {/* Fixed desktop sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(c => !c)}
          />
        </div>

        {/* Mobile slide-in drawer */}
        <AdminMobileNav
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Fixed top header */}
        <AdminHeader
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuOpen={() => setMobileNavOpen(true)}
        />

        {/*
          Content area.
          On mobile: no left offset (drawer is overlay).
          On desktop: left offset matches sidebar width.
          Using complete Tailwind class strings (not interpolated) for build-time safety.
        */}
        <div
          className={`pt-16 min-h-screen transition-[padding-left] duration-300 ease-in-out ${
            sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
          }`}
        >
          <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
            <Outlet />
          </main>
        </div>

      </div>
    </AdminRouteGuard>
  );
}
