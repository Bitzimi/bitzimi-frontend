import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The existing v4 repair contains the complete flow patch, but its generated
// source includes a nested template literal. Normalize that source in memory
// before executing it; this keeps the actual UI/flow patch unchanged.
const sourcePath = path.resolve("scripts/repair-coinflip-flow-v4.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replaceAll('navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`)', 'navigate(\\`/game/pvp-coinflip/private?roomCode=\\${roomCode}&stake=\\${stakeAmount}\\`)');
source = source.replaceAll('navigate(`/game/pvp-coinflip`)', 'navigate(\\`/game/pvp-coinflip\\`)');
const tempPath = path.resolve(".coinflip-flow-v4-fixed.mjs");
fs.writeFileSync(tempPath, source);
try {
  await import(pathToFileURL(tempPath).href + `?t=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
