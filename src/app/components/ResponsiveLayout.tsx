import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { FloatingOnlineCounter } from "./FloatingOnlineCounter";

interface ResponsiveLayoutProps {
  children: ReactNode;
  showFloatingOnlineCounter?: boolean;
}

export function ResponsiveLayout({ children, showFloatingOnlineCounter = true }: ResponsiveLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background">
      <div className="hidden md:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 bg-gray-50 dark:bg-background">{children}</main>
      </div>
      <MobileNav />
      {showFloatingOnlineCounter && <FloatingOnlineCounter />}
    </div>
  );
}