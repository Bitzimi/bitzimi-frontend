import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

s = s.replace(/useState<GameState>\("idle"\)/, 'useState<GameState>("ready")');
const idleStart = s.indexOf('            {/* Idle State');
const searchingStart = s.indexOf('            {/* Searching State */}', idleStart);
if (idleStart >= 0 && searchingStart > idleStart) {
  s = s.slice(0, idleStart) + s.slice(searchingStart);
}
s = s.replace('if (gameState !== "ready") return;', 'if (gameState !== "ready" && gameState !== "result_popup") return;');

fs.writeFileSync(path, s);
console.log("Coin Flip runtime finalization applied: ready entry, legacy idle search block removed, and result-popup new-search can invoke the single coordinator.");
