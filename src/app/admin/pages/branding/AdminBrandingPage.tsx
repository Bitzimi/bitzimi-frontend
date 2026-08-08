import { useState, useEffect, useCallback } from "react";
import { Star, Save, RefreshCw, CheckCircle2, AlertTriangle, Globe, Mail, Image, ExternalLink } from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

interface BrandingForm {
  name: string;
  tagline: string;
  baseUrl: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  copyrightYear: string;
  companyName: string;
  socialTwitter: string;
  socialTelegram: string;
  socialInstagram: string;
}

const EMPTY: BrandingForm = {
  name: "", tagline: "", baseUrl: "", supportEmail: "",
  logoUrl: "", faviconUrl: "", copyrightYear: "",
  companyName: "", socialTwitter: "", socialTelegram: "", socialInstagram: "",
};

export default function AdminBrandingPage() {
  const { hasPermission } = useAdminAccess();
  const canEdit = hasPermission("admin.config.edit");

  const [form, setForm]     = useState<BrandingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>("/api/v1/platform/branding");
      setForm({
        name:             data.name             ?? "",
        tagline:          data.tagline           ?? "",
        baseUrl:          data.baseUrl           ?? "",
        supportEmail:     data.supportEmail      ?? "",
        logoUrl:          data.logoUrl           ?? "",
        faviconUrl:       data.faviconUrl        ?? "",
        copyrightYear:    data.copyrightYear     ?? String(new Date().getFullYear()),
        companyName:      data.companyName       ?? "",
        socialTwitter:    data.social?.twitter   ?? "",
        socialTelegram:   data.social?.telegram  ?? "",
        socialInstagram:  data.social?.instagram ?? "",
      });
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const configs: Record<string, string> = {
        "platform.name":               form.name,
        "platform.tagline":            form.tagline,
        "platform.base_url":           form.baseUrl,
        "platform.support_email":      form.supportEmail,
        "platform.logo_url":           form.logoUrl,
        "platform.favicon_url":        form.faviconUrl,
        "platform.copyright_year":     form.copyrightYear,
        "platform.company_name":       form.companyName,
        "platform.social.twitter":     form.socialTwitter,
        "platform.social.telegram":    form.socialTelegram,
        "platform.social.instagram":   form.socialInstagram,
      };
      for (const [key, value] of Object.entries(configs)) {
        await apiFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ value }),
        });
      }
      showToast("Branding saved successfully");
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof BrandingForm, placeholder = "", type = "text", hint?: string) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        disabled={!canEdit || loading}
        className="w-full bg-gray-900/50 border border-gray-600/60 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 disabled:opacity-50"
      />
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-7 w-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Platform Branding</h1>
            <p className="text-sm text-gray-400">Configure platform name, logo, URLs, and social links</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.ok ? "bg-green-500/20 border border-green-500/40 text-green-300" : "bg-red-500/20 border border-red-500/40 text-red-300"
        }`}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Identity section */}
      <section className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Star className="h-4 w-4 text-purple-400" /> Platform Identity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Platform Name", "name", "Bitzimi")}
          {field("Company Name", "companyName", "Bitzimi Ltd.")}
          {field("Tagline", "tagline", "Play, Earn & Compete", "text", "Short marketing line shown on auth pages")}
          {field("Copyright Year", "copyrightYear", String(new Date().getFullYear()))}
        </div>
      </section>

      {/* URLs section */}
      <section className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Globe className="h-4 w-4 text-purple-400" /> URLs & Contact
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Base URL", "baseUrl", "https://bitzimi.com", "url", "Used for referral and affiliate links")}
          {field("Support Email", "supportEmail", "support@bitzimi.com", "email")}
        </div>
      </section>

      {/* Assets section */}
      <section className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Image className="h-4 w-4 text-purple-400" /> Logo & Favicon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Logo URL", "logoUrl", "https://…/logo.png", "url", "Leave blank to use the default bundled logo")}
          {field("Favicon URL", "faviconUrl", "https://…/favicon.ico", "url", "Leave blank to use the default favicon")}
        </div>
        {form.logoUrl && (
          <div className="flex items-center gap-4 mt-2">
            <img src={form.logoUrl} alt="Logo preview" className="h-10 max-w-[200px] object-contain bg-gray-900/50 rounded p-1" />
            <a href={form.logoUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Preview
            </a>
          </div>
        )}
      </section>

      {/* Social section */}
      <section className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-purple-400" /> Social Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field("Twitter / X", "socialTwitter", "https://x.com/bitzimi")}
          {field("Telegram", "socialTelegram", "https://t.me/bitzimi")}
          {field("Instagram", "socialInstagram", "https://instagram.com/bitzimi")}
        </div>
      </section>

      {/* Save button */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Branding"}
          </button>
        </div>
      )}
    </div>
  );
}
