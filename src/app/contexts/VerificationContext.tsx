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

export function VerificationProvider({ children }: { children: ReactNode }) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);

  useEffect(() => {
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

  // TODO(backend): This method will be invoked by a backend webhook response,
  // not called locally. Keep the signature; remove the direct call site in
  // useVerificationMonitor once the backend KYC pipeline is connected.
  const approveVerification = () => {
    setVerificationStatus("verified");
    saveVerificationStatus("verified", verificationData);
    window.dispatchEvent(new CustomEvent("identity-updated"));
  };

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
