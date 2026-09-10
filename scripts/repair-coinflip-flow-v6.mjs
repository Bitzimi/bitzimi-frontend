import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Execute the existing Coin Flip flow patch after normalizing the nested
// template literal and making its component-return marker unambiguous.
const sourcePath = path.resolve("scripts/repair-coinflip-flow-v4.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replaceAll('navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`)', 'navigate(\\`/game/pvp-coinflip/private?roomCode=\\${roomCode}&stake=\\${stakeAmount}\\`)');
source = source.replaceAll('navigate(`/game/pvp-coinflip`)', 'navigate(\\`/game/pvp-coinflip\\`)');
source = source.replace(
  'between(s, "  // Statistics tracker for debugging fairness", "  return (", flow + "  return (");',
  'between(s, "  // Statistics tracker for debugging fairness", "  return (\\n    <ResponsiveLayout>", flow + "  return (\\n    <ResponsiveLayout>");'
);
const tempPath = path.resolve(".coinflip-flow-v4-fixed.mjs");
fs.writeFileSync(tempPath, source);
try {
  await import(pathToFileURL(tempPath).href + `?t=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
