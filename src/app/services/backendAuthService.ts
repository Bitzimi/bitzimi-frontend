/**
 * Backend Authentication Bridge
 *
 * Handles all communication with backend auth endpoints.
 * If the backend is unreachable (VITE_API_URL not set or server down),
 * functions return false / null and the caller decides how to proceed.
 *
 * Token storage: localStorage (access + refresh).
 * Identity sync: after acquiring tokens, /users/me is fetched to write
 * the real backend UUID and role/permissions into bitzimiUser.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY   = "bitzimi_access_token";
const REFRESH_KEY = "bitzimi_refresh_token";

export interface BackendTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface LoginResult {
  ok:            boolean;
  tokens?:       BackendTokens;
  /** 401 = wrong credentials, 403 = suspended, 429 = locked out */
  statusCode?:   number;
  errorCode?:    string;
  errorMessage?: string;
  /** True when backend is unreachable (network error) */
  networkError?: boolean;
  /** True when the backend requires a 2FA TOTP code to complete login */
  requiresTwoFactor?: boolean;
  /** Short-lived challenge token to pass to /auth/2fa-challenge */
  twoFactorToken?: string;
}

// ── Core fetch helpers ────────────────────────────────────────────────────────

function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function storeTokens(tokens: BackendTokens): void {
  if (!tokens?.accessToken) return;
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Fetch /users/me and merge backend identity (id, role, permissions, codes) into localStorage. */
async function syncIdentityFromBackend(accessToken: string): Promise<void> {
  if (!API_BASE) return;
  try {
    const r = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return;
    const json = await r.json();
    const data = json?.data;
    if (!data) return;

    const stored = localStorage.getItem("bitzimiUser");
    const user   = stored ? JSON.parse(stored) : {};

    // Always overwrite id with backend UUID — fixes the ID mismatch
    if (data.id)            user.id            = data.id;
    if (data.email)         user.email         = data.email;
    if (data.referralCode)  user.referralCode  = data.referralCode;
    if (data.affiliateCode) user.affiliateCode = data.affiliateCode;
    if (data.role)          user.role          = data.role;
    if (data.permissions)   user.permissions   = data.permissions;

    localStorage.setItem("bitzimiUser", JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("identity-updated"));
  } catch {
    // ignore — identity will update on next poll
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log in with real backend credentials.
 * Returns a structured result so callers can distinguish credential
 * failures from network errors and show appropriate UI messages.
 */
export async function loginWithBackend(
  email: string,
  password: string,
): Promise<LoginResult> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      const body = data.data;
      // 2FA challenge — backend signals that a TOTP code is required
      if (body?.requiresTwoFactor === true) {
        return { ok: false, requiresTwoFactor: true, twoFactorToken: body.twoFactorToken };
      }
      const tokens: BackendTokens = body;
      storeTokens(tokens);
      await syncIdentityFromBackend(tokens.accessToken);
      return { ok: true, tokens };
    }

    // Structured error from backend
    let errorCode    = "UNKNOWN";
    let errorMessage = "Authentication failed";
    try {
      const body = await res.json();
      errorCode    = body?.error?.code    ?? errorCode;
      errorMessage = body?.error?.message ?? errorMessage;
    } catch { /* ignore */ }

    return { ok: false, statusCode: res.status, errorCode, errorMessage };
  } catch {
    return { ok: false, networkError: true };
  }
}

/** Register via backend. On 409 (already exists), attempts login instead. */
export async function registerWithBackend(
  email:         string,
  password:      string,
  username:      string,
  referralCode?: string,
  affiliateCode?: string,
): Promise<boolean> {
  if (!API_BASE) return false;
  try {
    const body: Record<string, string> = { email, password, username };
    if (referralCode)  body.referralCode  = referralCode;
    if (affiliateCode) body.affiliateCode = affiliateCode;

    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 409) {
        const result = await loginWithBackend(email, password);
        return result.ok;
      }
      return false;
    }

    const data = await res.json();
    const tokens: BackendTokens = data.data;
    storeTokens(tokens);
    await syncIdentityFromBackend(tokens.accessToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Complete a 2FA-gated login.
 * Called after loginWithBackend returns requiresTwoFactor=true.
 * Sends the challenge token + TOTP code to /auth/2fa-challenge.
 */
export async function complete2FAChallenge(
  twoFactorToken: string,
  totpCode:        string,
): Promise<LoginResult> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/2fa-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twoFactorToken, totpCode }),
    });
    if (res.ok) {
      const data = await res.json();
      const tokens: BackendTokens = data.data;
      storeTokens(tokens);
      await syncIdentityFromBackend(tokens.accessToken);
      return { ok: true, tokens };
    }
    let errorCode    = "INVALID_2FA_CODE";
    let errorMessage = "Invalid authenticator code";
    try {
      const body = await res.json();
      errorCode    = body?.error?.code    ?? errorCode;
      errorMessage = body?.error?.message ?? errorMessage;
    } catch { /* ignore */ }
    return { ok: false, statusCode: res.status, errorCode, errorMessage };
  } catch {
    return { ok: false, networkError: true };
  }
}

/** Check if the currently-authenticated user has 2FA enabled on the backend. */
export async function check2FAStatus(): Promise<boolean> {
  const accessToken = getStoredAccessToken();
  if (!API_BASE || !accessToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me/2fa`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.data?.enabled === true;
  } catch {
    return false;
  }
}

/** Verify a TOTP code against the backend. Returns true on success. */
export async function verify2FACode(token: string): Promise<boolean> {
  const accessToken = getStoredAccessToken();
  if (!API_BASE || !accessToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/users/me/2fa/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Refresh the access token using the stored refresh token. */
export async function refreshBackendToken(): Promise<boolean> {
  if (!API_BASE) return false;
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = await res.json();
    storeTokens(data.data);
    return true;
  } catch {
    return false;
  }
}

/** Revoke the refresh token on the backend, then clear local tokens. */
export async function logoutFromBackend(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  clearTokens();
  if (!API_BASE || !refreshToken) return;
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore — tokens are already cleared from localStorage
  }
}

/** Clear stored tokens (legacy alias — prefer logoutFromBackend for full server-side cleanup). */
export function clearBackendTokens(): void {
  clearTokens();
}

// ── Password Reset ────────────────────────────────────────────────────────────

export interface ForgotPasswordResult {
  ok: boolean;
  networkError?: boolean;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, networkError: true };
  }
}

export interface ResetPasswordResult {
  ok: boolean;
  errorCode?: string;
  networkError?: boolean;
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (res.ok) return { ok: true };
    let errorCode = "TOKEN_INVALID";
    try {
      const body = await res.json();
      errorCode = body?.error?.code ?? errorCode;
    } catch { /* ignore */ }
    return { ok: false, errorCode };
  } catch {
    return { ok: false, networkError: true };
  }
}

// ── Email Verification ────────────────────────────────────────────────────────

export interface VerifyEmailResult {
  ok: boolean;
  errorCode?: string;
  networkError?: boolean;
}

/** Request a new verification email for the given address. Always returns ok unless network fails. */
export async function sendVerificationEmailFrontend(email: string): Promise<{ ok: boolean; networkError?: boolean }> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/send-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, networkError: true };
  }
}

/** Verify an email address using the raw token from the link. */
export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  if (!API_BASE) return { ok: false, networkError: true };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) return { ok: true };
    let errorCode = "TOKEN_INVALID";
    try {
      const body = await res.json();
      errorCode = body?.error?.code ?? errorCode;
    } catch { /* ignore */ }
    return { ok: false, errorCode };
  } catch {
    return { ok: false, networkError: true };
  }
}

// ── Account Deactivation ──────────────────────────────────────────────────────

export interface DeactivateAccountResult {
  ok: boolean;
  errorCode?: string;
  networkError?: boolean;
}

/** Soft-delete the authenticated user's account. Requires password + optional TOTP. */
export async function deactivateAccount(
  password: string,
  totpToken?: string,
): Promise<DeactivateAccountResult> {
  const accessToken = getStoredAccessToken();
  if (!API_BASE || !accessToken) return { ok: false, networkError: true };
  try {
    const body: Record<string, string> = { password };
    if (totpToken) body.totpToken = totpToken;
    const res = await fetch(`${API_BASE}/api/v1/users/me/deactivate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    let errorCode = "UNKNOWN";
    try {
      const json = await res.json();
      errorCode = json?.error?.code ?? errorCode;
    } catch { /* ignore */ }
    return { ok: false, errorCode };
  } catch {
    return { ok: false, networkError: true };
  }
}
