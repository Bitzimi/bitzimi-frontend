import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

s = s.replace(/useState<GameState>\("idle"\)/, 'useState<GameState>("ready")');
const idleStart = s.indexOf('            {/* Idle State');
const searchingStart = s.indexOf('            {/* Searching State */}', idleStart);
if (idleStart >= 0 && searchingStart > idleStart) {
  const readyBlock = `            {/* Ready State - starts the single backend-authoritative coordinator. */}\n            {gameState === "ready" && (\n              <div className="text-center">\n                <Button onClick={startSearch} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}\n\n`;
  s = s.slice(0, idleStart) + readyBlock + s.slice(searchingStart);
}
s = s.replace('if (gameState !== "ready") return;', 'if (gameState !== "ready" && gameState !== "result_popup") return;');

fs.writeFileSync(path, s);
console.log("Coin Flip runtime finalization applied: ready entry, backend-authoritative Search control, and result-popup new-search coordinator.");
