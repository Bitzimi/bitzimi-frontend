/**
 * Shared formatting and masking utilities for fintech display.
 * Use these everywhere — do NOT duplicate masking logic in components.
 */

/** Mask a crypto wallet address: 0x1a2b••••c1cc */
export function maskWalletAddress(address: string): string {
  if (!address) return "—";
  const clean = address.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
}

/** Mask a bank account number: 12••••5678 */
export function maskBankAccount(account: string): string {
  if (!account) return "—";
  const digits = account.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
}

/** Mask a phone number: +234 08••••12 */
export function maskPhoneNumber(phone: string, countryCode?: string): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••••••";
  const prefix = countryCode ? `${countryCode} ` : "";
  return `${prefix}${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}

/** Shorten a long transaction hash for display: 0x1a2b3c4d…ef123456 */
export function maskTransactionHash(hash: string): string {
  if (!hash) return "—";
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

const EXPLORER_BASES: Record<string, { url: string; name: string }> = {
  bsc:      { url: "https://bscscan.com/tx/",              name: "BscScan" },
  bnb:      { url: "https://bscscan.com/tx/",              name: "BscScan" },
  ethereum: { url: "https://etherscan.io/tx/",             name: "Etherscan" },
  eth:      { url: "https://etherscan.io/tx/",             name: "Etherscan" },
  tron:     { url: "https://tronscan.org/#/transaction/",  name: "Tronscan" },
  trx:      { url: "https://tronscan.org/#/transaction/",  name: "Tronscan" },
  polygon:  { url: "https://polygonscan.com/tx/",          name: "Polygonscan" },
  matic:    { url: "https://polygonscan.com/tx/",          name: "Polygonscan" },
  solana:   { url: "https://solscan.io/tx/",               name: "Solscan" },
  sol:      { url: "https://solscan.io/tx/",               name: "Solscan" },
};

/** Build a block explorer URL for a transaction hash. Returns null if chain unknown or hash invalid. */
export function getExplorerLink(chain: string, hash: string): string | null {
  if (!hash || hash.length < 20) return null;
  const entry = EXPLORER_BASES[chain.toLowerCase().trim()];
  if (!entry) return null;
  return `${entry.url}${hash}`;
}

/** Get the human-readable name of a block explorer for a chain. */
export function getExplorerName(chain: string): string {
  return EXPLORER_BASES[chain.toLowerCase().trim()]?.name ?? "Explorer";
}
