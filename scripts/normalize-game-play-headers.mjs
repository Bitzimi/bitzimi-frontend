import fs from "node:fs";

const rules = `<Button\n  variant="outline"\n  size="sm"\n  onClick={() => setShowRules(!showRules)}\n  className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 rounded-lg transition-all shrink-0"\n>\n  <Info className="h-4 w-4 mr-2" />\n  Rules\n</Button>`;
const fairness = `<Button variant="outline" size="sm" onClick={() => setShowFairness(true)} className="flex items-center gap-1.5"> <Shield className="h-3.5 w-3.5" />Verify Fairness</Button>`;

function replaceSection(path, marker, endMarker, replacement) {
  const s = fs.readFileSync(path, "utf8");
  const start = s.indexOf(marker);
  if (start < 0) throw new Error(`${path}: marker not found`);
  const end = s.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${path}: end marker not found`);
  fs.writeFileSync(path, s.slice(0, start) + replacement + s.slice(end));
}

for (const [path, title, stake, indent] of [
  ["src/app/pages/PvPCoinFlipGame.tsx", "Coin Flip", "stakeAmount", "        "],
  ["src/app/pages/DiceDuelGame.tsx", "Dice Clash", "stake", "          "],
]) {
  const fairnessPlacement = path.includes("PvPCoinFlipGame")
    ? `${indent}  <div className="flex items-center justify-start">${fairness}</div>`
    : `${indent}  <div></div>\n${indent}  <div className="flex items-center justify-end">${fairness}</div>`;
  const replacement = `/* [Title Row] - Spin Battle-style two-row header */
${indent}<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
${indent}  <div className="min-w-0 flex items-center gap-[6px]">
${indent}    <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">${title}</h1>
${indent}    <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room \{formatCurrencyNoDecimals(${stake})\}</span>
${indent}  </div>
${indent}  <div className="flex items-center justify-end">${rules}</div>
${fairnessPlacement}
${indent}</div>

`;
  replaceSection(path, "/* [Title Row]", "/* Game Rules Panel */", replacement);
}

for (const [path, title] of [
  ["src/app/pages/DiceRoyaleGame.tsx", "Dice Royale"],
  ["src/app/pages/DiceArenaGame.tsx", "Dice Arena"],
]) {
  const indent = "          ";
  const replacement = `/* [Title Row] - Spin Battle-style two-row header */
${indent}<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
${indent}  <div className="min-w-0 flex items-center gap-[6px]">
${indent}    <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">${title}</h1>
${indent}    <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room \{formatCurrencyNoDecimals(initialStake)\}</span>
${indent}  </div>
${indent}  <div className="flex items-center justify-end">${rules}</div>
${indent}  <div className="min-w-0 flex items-center gap-2">
${indent}    <span className="text-sm text-gray-500 whitespace-nowrap">Round #\{roundNumber\}</span>
${indent}    <span className="inline-flex items-center gap-1 text-xs text-green-500 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />LIVE</span>
${indent}  </div>
${indent}  <div className="flex items-center justify-end">${fairness}</div>
${indent}</div>

`;
  replaceSection(path, "/* [Title Row]", "/* Game Rules Panel */", replacement);
}

// Reaction Tap has no fairness control. It keeps the title/stake only on row 1;
// row 2 left is intentionally empty and Rules remains on the right.
{
  const path = "src/app/pages/ReactionTapGameRoom.tsx";
  const s = fs.readFileSync(path, "utf8");
  const markers = [
    "        {/* Header - Spin Battle-style two-row layout; Reaction Tap has no fairness control */}",
    "        {/* Header */}",
  ];
  const start = markers.map(m => s.indexOf(m)).find(i => i >= 0) ?? -1;
  const end = s.indexOf("        {showRules && (", start);
  if (start < 0 || end < 0) throw new Error(`${path}: header boundaries not found`);
  const replacement = `        {/* Header - Spin Battle-style two-row layout; Reaction Tap has no fairness control */}
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={handleExit}
            className="mb-3 sm:mb-4 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4 mr-2" />Exit Room
          </Button>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
            <div className="min-w-0 flex items-center gap-[6px]">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Reaction Tap</h1>
              <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>
            </div>
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)} className="shrink-0">
                <Info className="h-4 w-4 mr-2" />Rules
              </Button>
            </div>
            <div></div>
          </div>
        </div>
`;
  fs.writeFileSync(path, s.slice(0, start) + replacement + s.slice(end));
}
