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

// The header's Winner value is the match-level payout, not the current viewer's personal payout.
s = s.replace('const winnerGets = matchData ? Number(matchData.payout ?? 0) : 0;', 'const winnerGets = matchData ? Number(matchData.winnerPayout ?? 0) : 0;');

// The backend exposes a separate landed-result phase: render the authoritative result for 4s before opening the popup.
if (!s.includes('if (phase === "result_display")')) {
  const marker = '      if (phase === "result_popup") {';
  const landedResultBlock = `      if (phase === "result_display") {\n        const result = md?.result?.coinFlip as CoinSide | undefined;\n        if (result) setCoinResult(result);\n        setShowWinner(false);\n        setShowResultPopup(false);\n        setGameState("showing_result");\n        return;\n      }\n\n`;
  if (!s.includes(marker)) throw new Error("Coin Flip result popup phase marker not found");
  s = s.replace(marker, landedResultBlock + marker);
}

fs.writeFileSync(path, s);
console.log("Coin Flip runtime finalization applied: ready entry, universal match payout display, landed-result phase, and result-popup new-search coordinator.");
