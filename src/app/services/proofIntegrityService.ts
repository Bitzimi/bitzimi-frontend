/**
 * ProofIntegrityService — image fingerprinting and anti-replay protection.
 *
 * Uses browser Canvas API + SubtleCrypto to generate perceptual hashes
 * without any external dependencies.
 *
 * Hash types:
 *   aHash — average hash (exact/near-exact duplicates)
 *   dHash — difference hash (structural similarity, robust to crop/resize)
 *   colorSig — 16-bin color histogram signature
 *
 * Anti-replay rules (enforced via taskProofRepository):
 *   1. Same user submitting same proof image to any task → REJECT
 *   2. Different user submitting an image already seen in the system → REJECT
 *   3. Slightly modified version of a seen image (Hamming distance ≤ threshold) → REJECT
 *
 * Interface contract is separated so future providers (e.g. cloud Vision)
 * can be swapped by implementing IProofIntegrityProvider.
 */

import { VerificationConfig } from "../config/VerificationConfig";
import { taskProofRepository } from "../repositories/LocalTaskProofRepository";

export interface ImageFingerprint {
  aHash: string;        // 64-bit binary string from 8x8 average hash
  dHash: string;        // 64-bit binary string from 9x8 difference hash
  colorSig: string;     // 48-char hex histogram signature
  widthPx: number;
  heightPx: number;
  aspectRatio: string;  // "16:9", "1:1", etc.
  fileSizeBytes: number;
  mimeType: string;
}

export interface ProofReuseResult {
  isReused: boolean;
  reason?: string;
  matchingProofId?: string;
  hammingDistance?: number;
}

export interface IProofIntegrityProvider {
  generateFingerprint(dataUrl: string, fileSizeBytes: number, mimeType: string): Promise<ImageFingerprint>;
  detectReuse(fingerprint: ImageFingerprint, currentUserId: string, currentTaskId: string): Promise<ProofReuseResult>;
}

// ─── Canvas-based hash implementations ───────────────────────────────────────

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

function toGrayscale(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Average hash: resize to 8×8, compare each pixel to mean brightness */
async function computeAHash(img: HTMLImageElement): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 8; c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 8, 8);
  const px = ctx.getImageData(0, 0, 8, 8).data;
  const grays: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    grays.push(toGrayscale(px[i], px[i + 1], px[i + 2]));
  }
  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
  return grays.map(g => (g >= mean ? "1" : "0")).join("");
}

/** Difference hash: resize to 9×8, compare adjacent pixels horizontally */
async function computeDHash(img: HTMLImageElement): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 9; c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 9, 8);
  const px = ctx.getImageData(0, 0, 9, 8).data;
  let hash = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const i1 = (row * 9 + col) * 4;
      const i2 = (row * 9 + col + 1) * 4;
      const g1 = toGrayscale(px[i1], px[i1 + 1], px[i1 + 2]);
      const g2 = toGrayscale(px[i2], px[i2 + 1], px[i2 + 2]);
      hash += g1 > g2 ? "1" : "0";
    }
  }
  return hash;
}

/** Color histogram: 16 bins per channel (R, G, B) → 48-char hex string */
async function computeColorSignature(img: HTMLImageElement): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 32, 32);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  const bins = 16;
  const rHist = new Array(bins).fill(0);
  const gHist = new Array(bins).fill(0);
  const bHist = new Array(bins).fill(0);
  for (let i = 0; i < px.length; i += 4) {
    rHist[Math.floor(px[i] / 16)]++;
    gHist[Math.floor(px[i + 1] / 16)]++;
    bHist[Math.floor(px[i + 2] / 16)]++;
  }
  const encode = (hist: number[]) =>
    hist.map(v => Math.min(15, Math.floor(v / 64)).toString(16)).join("");
  return encode(rHist) + encode(gHist) + encode(bHist);
}

function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioString(w: number, h: number): string {
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

// ─── Service implementation ───────────────────────────────────────────────────

class ProofIntegrityServiceImpl implements IProofIntegrityProvider {
  async generateFingerprint(
    dataUrl: string,
    fileSizeBytes: number,
    mimeType: string,
  ): Promise<ImageFingerprint> {
    const img = await loadImage(dataUrl);
    const [aHash, dHash, colorSig] = await Promise.all([
      computeAHash(img),
      computeDHash(img),
      computeColorSignature(img),
    ]);
    return {
      aHash,
      dHash,
      colorSig,
      widthPx: img.naturalWidth,
      heightPx: img.naturalHeight,
      aspectRatio: aspectRatioString(img.naturalWidth, img.naturalHeight),
      fileSizeBytes,
      mimeType,
    };
  }

  async detectReuse(
    fingerprint: ImageFingerprint,
    currentUserId: string,
    currentTaskId: string,
  ): Promise<ProofReuseResult> {
    const threshold = VerificationConfig.PERCEPTUAL_HASH_SIMILARITY_THRESHOLD;
    const allFingerprints = await taskProofRepository.findAllFingerprints();

    for (const existing of allFingerprints) {
      if (!existing.fingerprintAHash || !existing.fingerprintDHash) continue;

      const aDistance = hammingDistance(fingerprint.aHash, existing.fingerprintAHash);
      const dDistance = hammingDistance(fingerprint.dHash, existing.fingerprintDHash);

      // Exact duplicate (aHash identical)
      if (aDistance === 0 && dDistance === 0) {
        if (existing.userId === currentUserId && existing.taskId === currentTaskId) {
          return { isReused: true, reason: "You have already submitted this exact screenshot for this task.", matchingProofId: existing.id, hammingDistance: 0 };
        }
        if (existing.userId === currentUserId) {
          return { isReused: true, reason: "This screenshot was already used for another task.", matchingProofId: existing.id, hammingDistance: 0 };
        }
        return { isReused: true, reason: "This screenshot has already been submitted by another user.", matchingProofId: existing.id, hammingDistance: 0 };
      }

      // Near-duplicate (perceptual similarity)
      if (aDistance <= threshold && dDistance <= threshold) {
        const maxD = Math.max(aDistance, dDistance);
        if (existing.userId === currentUserId) {
          return { isReused: true, reason: "A nearly identical screenshot was already submitted. Screenshots must be unique.", matchingProofId: existing.id, hammingDistance: maxD };
        }
        return { isReused: true, reason: "This screenshot is too similar to one already in the system.", matchingProofId: existing.id, hammingDistance: maxD };
      }
    }

    return { isReused: false };
  }
}

export const proofIntegrityService: IProofIntegrityProvider = new ProofIntegrityServiceImpl();
