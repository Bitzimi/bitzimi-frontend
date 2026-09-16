import { RouterProvider } from "react-router";
import { Component, type ReactNode } from "react";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { SettingsProvider } from "./contexts/SettingsContext";
import { PlatformProvider } from "./contexts/PlatformContext";
import { WalletProvider } from "./contexts/WalletContext";
import { GameStatsProvider } from "./contexts/GameStatsContext";
import { TransactionProvider } from "./contexts/TransactionContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { VerificationProvider } from "./contexts/VerificationContext";
import { IdentityProvider } from "./contexts/IdentityContext";
import { FeatureProvider } from "./contexts/FeatureContext";
import { appLifecycleService } from "./services/appLifecycleService";
import { useEffect } from "react";

// Lifecycle side-effects that live outside the router tree
function AppLifecycle() {
  useEffect(() => {
    const cleanup1 = appLifecycleService.onResume(() => {});
    const cleanup2 = appLifecycleService.onBackground(() => {});
    return () => { cleanup1(); cleanup2(); };
  }, []);
  return null;
}

// Error boundary so the component renders gracefully in isolated preview contexts
class RouterErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#09090b", color: "#71717a", fontFamily: "sans-serif", fontSize: 14 }}>
          BitZimi — open in browser to use the full app
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <PlatformProvider>
    <SettingsProvider>
      <NotificationProvider>
        <VerificationProvider>
          <IdentityProvider>
            <FeatureProvider>
            <WalletProvider>
              <GameStatsProvider>
                <TransactionProvider>
                  <AppLifecycle />
                  <RouterErrorBoundary>
                    <RouterProvider router={router} />
                  </RouterErrorBoundary>
                  <Toaster />
                </TransactionProvider>
              </GameStatsProvider>
            </WalletProvider>
            </FeatureProvider>
          </IdentityProvider>
        </VerificationProvider>
      </NotificationProvider>
    </SettingsProvider>
    </PlatformProvider>
  );
}
