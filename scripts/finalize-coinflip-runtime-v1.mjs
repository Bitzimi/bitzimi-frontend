import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

s = s.replace(/useState<GameState>\("idle"\)/, 'useState<GameState>("ready")');
s = s.replace(/\n\s*\/\* Idle State[\s\S]*?\{gameState === "idle" && \([\s\S]*?\n\s*\)\}\n/, "\n");
s = s.replace('if (gameState !== "ready") return;', 'if (gameState !== "ready" && gameState !== "result_popup") return;');

fs.writeFileSync(path, s);
console.log("Coin Flip runtime finalization applied: ready entry, no legacy idle search block, and result-popup new-search can invoke the single coordinator.");
