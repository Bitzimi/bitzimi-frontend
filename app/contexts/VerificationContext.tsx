import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { withdrawalLimitService, TIER_LIMITS, type UserTier } from "../services/withdrawalLimitService";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface VerificationData {
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  idFrontImage?: string;
  idBackImage?: string;
  selfieImage?: string;
}

// Shape kept for backwards compatibility with existing consumers.
// All values are now derived from withdrawalLimitService (single source of truth).
interface WithdrawalLimits {
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
}

interface VerificationContextType {
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  verificationData: VerificationData | null;
  withdrawalLimits: WithdrawalLimits;
  submitVerification: (data: VerificationData) => Promise<boolean>;
  // TODO(backend): approveVerification must be triggered by the backend AI verification
  // pipeline (face match + age check + proof-of-address OCR), not by a frontend timer.
  // Remove all client-side calls to this method once the backend is live.
  approveVerification: () => void;
  canWithdraw: (amount: number, isVIP: boolean) => { allowed: boolean; reason?: string };
  recordWithdrawal: (amount: number) => void;
  getWithdrawalLimits: (isVIP: boolean) => WithdrawalLimits;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

const STORAGE_KEY = "bitzimiVerification";

function getTier(status: VerificationStatus, isVIP: boolean): UserTier {
  if (isVIP) return "vip";
  if (status === "verified") return "verified";
  return "free";
}

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

function getAuthToken(): string | null {
  try {
    const u = localStorage.getItem("bitzimiUser");
    return u ? JSON.parse(u)?.accessToken ?? null : null;
  } catch { return null; }
}

export function VerificationProvider({ children }: { children: ReactNode }) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);

  useEffect(() => {
    // Load from localStorage first so the UI is not blank on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setVerificationStatus(parsed.status || "unverified");
        setVerificationData(parsed.data || null);
      } catch (e) {
        console.error("Failed to load verification data", e);
      }
    }

    // Sync authoritative status from backend KYC endpoint.
    // The backend is the single source of truth; localStorage is only a cache.
    if (API_BASE) {
      const token = getAuthToken();
      if (token) {
        fetch(`${API_BASE}/api/v1/kyc`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then((body: any) => {
            const backendStatus: VerificationStatus = body?.data?.status ?? null;
            if (backendStatus) {
              setVerificationStatus(backendStatus);
              // Keep localStorage in sync so subsequent mounts reflect reality
              const existingRaw = localStorage.getItem(STORAGE_KEY);
              const existing = existingRaw ? JSON.parse(existingRaw) : {};
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, status: backendStatus }));
            }
          })
          .catch(() => { /* backend unavailable — keep localStorage value */ });
      }
    }
  }, []);

  const saveVerificationStatus = (status: VerificationStatus, data: VerificationData | null) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, data }));
  };

  const submitVerification = async (data: VerificationData): Promise<boolean> => {
    try {
      const metadataOnly = {
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        idType: data.idType,
        idNumber: data.idNumber,
        // DO NOT store images — too large for localStorage
      };

      setVerificationData(metadataOnly as VerificationData);
      setVerificationStatus("pending");
      saveVerificationStatus("pending", metadataOnly as VerificationData);

      // TODO(backend): Submit documents to backend KYC endpoint.
      // The backend runs: face match → age verification → proof-of-address OCR.
      // On confidence ≥ threshold, backend sets status to "verified" and
      // the frontend fetches the updated status from GET /users/me.

      return true;
    } catch (e) {
      console.error("Verification submission failed", e);
      return false;
    }
  };

  // approveVerification is intentionally a no-op on the frontend.
  // KYC approval is authoritative only when set by the backend pipeline.
  // Status is synced from GET /api/v1/kyc on mount (above).
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const approveVerification = () => {};

  // Derive limits from withdrawalLimitService — single source of truth.
  const getWithdrawalLimits = (isVIP: boolean): WithdrawalLimits => {
    const tier = getTier(verificationStatus, isVIP);
    const { dailyUsed, monthlyUsed } = withdrawalLimitService.getUsed();
    const caps = TIER_LIMITS[tier];
    return {
      dailyLimit: caps.daily,
      monthlyLimit: caps.monthly,
      dailyUsed,
      monthlyUsed,
    };
  };

  const canWithdraw = (amount: number, isVIP: boolean): { allowed: boolean; reason?: string } => {
    const tier = getTier(verificationStatus, isVIP);
    const result = withdrawalLimitService.check(amount, tier);
    return { allowed: result.allowed, reason: result.reason };
  };

  const recordWithdrawal = (amount: number) => {
    withdrawalLimitService.record(amount);
  };

  // Read-only snapshot for consumers that display limit info.
  const isVIPNow = false; // VIP status is authoritative from backend only
  const tier = getTier(verificationStatus, isVIPNow);
  const { dailyUsed, monthlyUsed } = withdrawalLimitService.getUsed();
  const caps = TIER_LIMITS[tier];
  const withdrawalLimits: WithdrawalLimits = {
    dailyLimit: caps.daily,
    monthlyLimit: caps.monthly,
    dailyUsed,
    monthlyUsed,
  };

  const isVerified = verificationStatus === "verified";

  return (
    <VerificationContext.Provider
      value={{
        verificationStatus,
        isVerified,
        verificationData,
        withdrawalLimits,
        submitVerification,
        approveVerification,
        canWithdraw,
        recordWithdrawal,
        getWithdrawalLimits,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error("useVerification must be used within VerificationProvider");
  }
  return context;
}
