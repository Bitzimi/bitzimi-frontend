/**
 * User Profile Service
 * High-grade fintech user profile management
 */

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface UserProfile {
  // Identity (from registration - immutable)
  fullName: string; // Cannot be edited (set during registration, updated only by verification)
  email: string; // Cannot be edited (set during registration)

  // Editable fields with restrictions
  username: string; // Can edit once per month
  phoneNumber: string; // Can edit once, must verify with SMS
  phoneCountryCode: string; // Phone country code (e.g., "+234")
  phoneCountryIso: string;  // ISO-3166 country code (e.g., "NG")
  phoneCountryName: string; // Country name (e.g., "Nigeria")

  // Address stored as components
  address: string; // Full address string (for compatibility)
  addressComponents: AddressComponents; // Address broken into components

  // Metadata
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  lastUsernameEdit: string | null; // Timestamp of last username change
  addressLockedByVerification: boolean; // True when user becomes verified

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "bitzimiUserProfile";

class UserProfileService {
  /**
   * Initialize user profile from registration data
   */
  createProfile(fullName: string, email: string, username: string): UserProfile {
    const profile: UserProfile = {
      fullName,
      email,
      username,
      phoneNumber: "",
      phoneCountryCode: "",
      phoneCountryIso: "",
      phoneCountryName: "",
      address: "",
      addressComponents: {
        street: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
      },
      phoneVerified: false,
      phoneVerifiedAt: null,
      lastUsernameEdit: null,
      addressLockedByVerification: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveProfile(profile);
    return profile;
  }

  /**
   * Get current user profile
   */
  getProfile(): UserProfile | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse user profile:", e);
        return null;
      }
    }
    return null;
  }

  /**
   * Save profile to storage and notify identity listeners globally
   */
  private saveProfile(profile: UserProfile): void {
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("identity-updated"));
    }
  }

  /**
   * Check if username can be edited (once per month)
   */
  canEditUsername(): { allowed: boolean; reason?: string; nextEditDate?: string } {
    const profile = this.getProfile();
    if (!profile) return { allowed: false, reason: "Profile not found" };

    if (!profile.lastUsernameEdit) {
      return { allowed: true };
    }

    const lastEdit = new Date(profile.lastUsernameEdit);
    const now = new Date();
    const daysSinceLastEdit = Math.floor((now.getTime() - lastEdit.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastEdit >= 30) {
      return { allowed: true };
    }

    const nextEditDate = new Date(lastEdit);
    nextEditDate.setDate(nextEditDate.getDate() + 30);

    return {
      allowed: false,
      reason: `You can edit your username once every 30 days. Next edit available on ${nextEditDate.toLocaleDateString()}.`,
      nextEditDate: nextEditDate.toISOString(),
    };
  }

  /**
   * Update username (if allowed)
   */
  updateUsername(newUsername: string): { success: boolean; message: string } {
    const canEdit = this.canEditUsername();
    if (!canEdit.allowed) {
      return { success: false, message: canEdit.reason || "Cannot edit username" };
    }

    const profile = this.getProfile();
    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    profile.username = newUsername;
    profile.lastUsernameEdit = new Date().toISOString();
    this.saveProfile(profile);

    return { success: true, message: "Username updated successfully" };
  }

  /**
   * Check if phone number can be edited
   */
  canEditPhone(): { allowed: boolean; reason?: string } {
    const profile = this.getProfile();
    if (!profile) return { allowed: false, reason: "Profile not found" };

    if (profile.phoneVerified) {
      return {
        allowed: false,
        reason: "Phone number is verified and cannot be changed",
      };
    }

    return { allowed: true };
  }

  /**
   * Update phone number (must verify after)
   */
  updatePhone(countryCode: string, phoneNumber: string): { success: boolean; message: string } {
    const canEdit = this.canEditPhone();
    if (!canEdit.allowed) {
      return { success: false, message: canEdit.reason || "Cannot edit phone" };
    }

    const profile = this.getProfile();
    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    profile.phoneCountryCode = countryCode;
    profile.phoneNumber = phoneNumber;
    profile.phoneVerified = false; // Reset verification status
    this.saveProfile(profile);

    return { success: true, message: "Phone number updated. Please verify." };
  }

  /**
   * Verify phone number (called after SMS code verification).
   * After verification the phone is permanently locked.
   */
  verifyPhone(countryIso?: string, countryName?: string): { success: boolean; message: string } {
    const profile = this.getProfile();
    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    profile.phoneVerified = true;
    profile.phoneVerifiedAt = new Date().toISOString();
    if (countryIso) profile.phoneCountryIso = countryIso;
    if (countryName) profile.phoneCountryName = countryName;
    this.saveProfile(profile);

    return { success: true, message: "Phone number verified successfully" };
  }

  /**
   * Check if address can be edited
   */
  canEditAddress(): { allowed: boolean; reason?: string } {
    const profile = this.getProfile();
    if (!profile) return { allowed: false, reason: "Profile not found" };

    if (profile.addressLockedByVerification) {
      return {
        allowed: false,
        reason: "Address is locked after verification",
      };
    }

    return { allowed: true };
  }

  /**
   * Update address (if allowed)
   */
  updateAddress(addressComponents: AddressComponents): { success: boolean; message: string } {
    const canEdit = this.canEditAddress();
    if (!canEdit.allowed) {
      return { success: false, message: canEdit.reason || "Cannot edit address" };
    }

    const profile = this.getProfile();
    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Store components
    profile.addressComponents = addressComponents;

    // Build full address string
    const { street, city, state, country, postalCode } = addressComponents;
    profile.address = `${street}, ${city}, ${state}, ${country} ${postalCode}`.trim();

    this.saveProfile(profile);

    return { success: true, message: "Address updated successfully" };
  }

  /**
   * Sync verification data to profile
   * Auto-updates name and address from verification documents
   */
  syncVerificationData(verifiedName: string, verifiedAddress: string): void {
    const profile = this.getProfile();
    if (!profile) return;

    // Update full name from verified identity
    profile.fullName = verifiedName;

    // Update address from proof of address
    profile.address = verifiedAddress;

    // Lock address (cannot edit after verification)
    profile.addressLockedByVerification = true;

    this.saveProfile(profile);
  }

  /**
   * Update full name (only called by verification system)
   */
  updateFullNameFromVerification(verifiedName: string): void {
    const profile = this.getProfile();
    if (!profile) return;

    profile.fullName = verifiedName;
    this.saveProfile(profile);
  }
}

export const userProfileService = new UserProfileService();
