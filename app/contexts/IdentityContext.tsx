import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { userProfileService, AddressComponents } from "../services/userProfileService";
import type { UserRole, Permission } from "../admin/types/index";
import { getPermissionsForRole } from "../admin/permissions";

export type IdentityVerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Identity {
  userId: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string; // always set: uploaded image URL or first letter of username
  phoneNumber: string;
  phoneCountryCode: string;
  phoneVerified: boolean;
  address: string;
  addressComponents: AddressComponents;
  addressLockedByVerification: boolean;
  verificationStatus: IdentityVerificationStatus;
  isVerified: boolean;
  referralCode: string;   // BZR-prefix — for Referral Program links (?ref=)
  affiliateCode: string;  // BZA-prefix — for Affiliate Program links (?aff=)
  createdAt: string;
  lastUsernameEdit: string | null;
  // ─── RBAC — populated from backend JWT / user object ─────────────────────
  // These are OPTIONAL and undefined for regular users with no backend yet.
  // The backend will set these fields; never hardcode them in the frontend.
  role?: UserRole;
  permissions?: Permission[];
}

interface IdentityContextType {
  identity: Identity;
  refreshIdentity: () => void;
}

const DEFAULT_IDENTITY: Identity = {
  userId: "",
  fullName: "",
  username: "",
  email: "",
  avatar: "?",
  phoneNumber: "",
  phoneCountryCode: "+234",
  phoneVerified: false,
  address: "",
  addressComponents: { street: "", city: "", state: "", country: "", postalCode: "" },
  addressLockedByVerification: false,
  verificationStatus: "unverified",
  isVerified: false,
  referralCode: "",
  affiliateCode: "",
  createdAt: new Date().toISOString(),
  lastUsernameEdit: null,
};

const IdentityContext = createContext<IdentityContextType>({
  identity: DEFAULT_IDENTITY,
  refreshIdentity: () => {},
});

function buildIdentity(): Identity {
  const user = JSON.parse(localStorage.getItem("bitzimiUser") || "{}");
  const profile = userProfileService.getProfile();

  let verificationStatus: IdentityVerificationStatus = "unverified";
  try {
    const vStored = localStorage.getItem("bitzimiVerification");
    if (vStored) {
      const vParsed = JSON.parse(vStored);
      verificationStatus = (vParsed.status as IdentityVerificationStatus) || "unverified";
    }
  } catch { /* ignore */ }

  const uploadedAvatar = localStorage.getItem("userAvatar");

  // Read role from user object (populated by backend JWT when available)
  const role: UserRole | undefined = user.role as UserRole | undefined;
  // Derive permissions from role, or use explicit permissions array if provided
  const permissions: Permission[] | undefined =
    user.permissions ?? (role ? getPermissionsForRole(role) : undefined);

  return {
    userId: user.id || "",
    fullName: profile?.fullName || user.fullName || "",
    username: profile?.username || user.username || "",
    email: profile?.email || user.email || "",
    // avatar is ALWAYS set: uploaded image first, then first letter of username
    // There is never a null/missing avatar state after registration.
    avatar: uploadedAvatar || ((profile?.username || user.username || "").charAt(0).toUpperCase()) || "?",
    phoneNumber: profile?.phoneNumber || "",
    phoneCountryCode: profile?.phoneCountryCode || "+234",
    phoneVerified: profile?.phoneVerified || false,
    address: profile?.address || "",
    addressComponents: profile?.addressComponents || { street: "", city: "", state: "", country: "", postalCode: "" },
    addressLockedByVerification: profile?.addressLockedByVerification || false,
    verificationStatus,
    isVerified: verificationStatus === "verified",
    referralCode:  user.referralCode  || "",
    affiliateCode: user.affiliateCode || "",
    createdAt: profile?.createdAt || user.createdAt || new Date().toISOString(),
    lastUsernameEdit: profile?.lastUsernameEdit || null,
    role,
    permissions,
  };
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(buildIdentity);

  const refreshIdentity = useCallback(() => {
    setIdentity(buildIdentity());
  }, []);

  useEffect(() => {
    const handleUpdate = () => refreshIdentity();
    window.addEventListener("identity-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    const interval = setInterval(refreshIdentity, 2000);

    return () => {
      window.removeEventListener("identity-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      clearInterval(interval);
    };
  }, [refreshIdentity]);

  return (
    <IdentityContext.Provider value={{ identity, refreshIdentity }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  return useContext(IdentityContext);
}

export function dispatchIdentityUpdate() {
  window.dispatchEvent(new CustomEvent("identity-updated"));
}
