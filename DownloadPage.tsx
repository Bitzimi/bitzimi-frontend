import { useState } from "react";

function b64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

export default function DownloadPage() {
  const [backendState, setBackendState] = useState<"idle"|"loading"|"done">("idle");
  const [frontendState, setFrontendState] = useState<"idle"|"loading"|"done">("idle");

  async function downloadBackend() {
    setBackendState("loading");
    const { BACKEND_B64 } = await import("./downloads/backendZip");
    const blob = b64ToBlob(BACKEND_B64, "application/zip");
    triggerDownload(blob, "bitzimi-backend-ready.zip");
    setBackendState("done");
  }

  async function downloadFrontend() {
    setFrontendState("loading");
    const { FRONTEND_B64 } = await import("./downloads/frontendZip");
    const blob = b64ToBlob(FRONTEND_B64, "application/zip");
    triggerDownload(blob, "bitzimi-frontend-ready.zip");
    setFrontendState("done");
  }

  const btn = (
    label: string,
    sub: string,
    state: "idle"|"loading"|"done",
    onClick: () => void,
    color: string
  ) => (
    <button
      onClick={onClick}
      disabled={state === "loading"}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 360,
        background: state === "done" ? "#15803d" : state === "loading" ? "#374151" : color,
        color: "#fff",
        border: "none",
        borderRadius: 16,
        padding: "20px 24px",
        fontSize: 18,
        fontWeight: 700,
        cursor: state === "loading" ? "not-allowed" : "pointer",
        textAlign: "left",
        lineHeight: 1.3,
      }}
    >
      {state === "loading" ? "⏳ Preparing download..." : state === "done" ? "✅ Download started!" : label}
      {state === "idle" && (
        <span style={{ display: "block", fontSize: 13, fontWeight: 400, marginTop: 4, opacity: 0.8 }}>
          {sub}
        </span>
      )}
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 20,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, textAlign: "center" }}>
        BitZimi — Download
      </div>
      <div style={{ color: "#888", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
        Tap a button. The ZIP file will download to your device. Both are verified — zero TypeScript errors, clean build.
      </div>

      {btn(
        "⬇  Download Backend",
        "bitzimi-backend-ready.zip — 400 KB · Fastify + Prisma + all modules",
        backendState,
        downloadBackend,
        "#1d4ed8"
      )}

      {btn(
        "⬇  Download Frontend",
        "bitzimi-frontend-ready.zip — 5 MB · React + Vite + all pages",
        frontendState,
        downloadFrontend,
        "#16a34a"
      )}

      <div style={{ color: "#444", fontSize: 11, textAlign: "center", maxWidth: 300, marginTop: 8 }}>
        Frontend button may take 5–10 seconds to prepare. Do not close the preview while it loads.
      </div>
    </div>
  );
}
