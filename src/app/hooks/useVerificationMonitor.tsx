import { useEffect } from "react";
import { useNotifications } from "../contexts/NotificationContext";

/**
 * Monitors pending KYC verification state.
 *
 * IMPORTANT — auto-approval is intentionally removed.
 *
 * TODO(backend): KYC approval must be handled server-side through the following pipeline:
 *   1. User uploads documents → backend stores in secure object storage
 *   2. Backend runs: face match (ID front vs selfie) → age extraction → proof-of-address OCR
 *   3. When confidence meets threshold, backend sets user.verification_status = "verified"
 *   4. Frontend polls GET /users/me (or receives a WebSocket push) and updates IdentityContext
 *
 * The `pendingVerificationMetadata` localStorage key and `approveVerification()` calls
 * in VerificationContext exist only as temporary frontend scaffolding and must be
 * replaced entirely once the backend KYC endpoint is live.
 */
export function useVerificationMonitor() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    const raw = localStorage.getItem("pendingVerificationMetadata");
    if (!raw) return;

    // Verification is pending backend review. Notify once per session if
    // the user still has a pending submission in localStorage.
    try {
      JSON.parse(raw); // validate JSON — discard if corrupted
      addNotification(
        "system_alert",
        "Verification Under Review",
        "Your identity documents have been submitted and are being reviewed. You will be notified when verification is complete.",
      );
    } catch {
      localStorage.removeItem("pendingVerificationMetadata");
    }
  }, []); // run once on mount
}
