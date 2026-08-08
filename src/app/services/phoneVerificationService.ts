/**
 * Phone Verification Service
 * High-grade fintech SMS verification system
 */

interface PendingVerification {
  phoneNumber: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const STORAGE_KEY = "phoneVerificationPending";
const MAX_ATTEMPTS = 3;
const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

class PhoneVerificationService {
  /**
   * Generate 6-digit verification code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS verification code (simulated)
   */
  sendVerificationCode(phoneNumber: string): { success: boolean; message: string; code?: string } {
    // Validate phone number format
    if (!phoneNumber || phoneNumber.length < 10) {
      return { success: false, message: "Invalid phone number format" };
    }

    // Generate verification code
    const code = this.generateCode();

    // Store pending verification
    const pending: PendingVerification = {
      phoneNumber,
      code,
      expiresAt: Date.now() + CODE_EXPIRY_MS,
      attempts: 0,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

    // In production, this would send actual SMS via Twilio/AWS SNS
    // Show code in console for development purposes
    console.log("📱 SMS VERIFICATION CODE:", code);
    console.log("📱 Phone:", phoneNumber);
    console.log("📱 Expires in 5 minutes");

    return {
      success: true,
      message: `Verification code sent to ${this.maskPhoneNumber(phoneNumber)}`,
      code, // In production, this would NOT be returned
    };
  }

  /**
   * Verify SMS code
   */
  verifyCode(inputCode: string): { success: boolean; message: string } {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { success: false, message: "No verification pending. Please request a new code." };
    }

    try {
      const pending: PendingVerification = JSON.parse(stored);

      // Check if expired
      if (Date.now() > pending.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return { success: false, message: "Verification code expired. Please request a new code." };
      }

      // Check attempts
      if (pending.attempts >= MAX_ATTEMPTS) {
        localStorage.removeItem(STORAGE_KEY);
        return { success: false, message: "Too many attempts. Please request a new code." };
      }

      // Verify code
      if (inputCode === pending.code) {
        localStorage.removeItem(STORAGE_KEY);
        return { success: true, message: "Phone number verified successfully!" };
      } else {
        // Increment attempts
        pending.attempts++;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

        const remainingAttempts = MAX_ATTEMPTS - pending.attempts;
        return {
          success: false,
          message: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        };
      }
    } catch (e) {
      console.error("Verification error:", e);
      return { success: false, message: "Verification failed. Please try again." };
    }
  }

  /**
   * Get pending verification info
   */
  getPendingVerification(): { phoneNumber: string; expiresAt: number } | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const pending: PendingVerification = JSON.parse(stored);

      // Check if expired
      if (Date.now() > pending.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return {
        phoneNumber: pending.phoneNumber,
        expiresAt: pending.expiresAt,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Mask phone number for display
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return phone;
    const last4 = phone.slice(-4);
    const masked = "*".repeat(phone.length - 4);
    return masked + last4;
  }

  /**
   * Cancel pending verification
   */
  cancelVerification(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const phoneVerificationService = new PhoneVerificationService();
