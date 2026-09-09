import fs from "node:fs";
const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");
const startMarker = '              {sessionHistory.map((record) => (';
const endMarker = '              ))}\n            </div>\n          </div>\n        </Card>';
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Coin Flip history block not found");
const block = `              {sessionHistory.map((record) => (\n                <div key={record.id} className="flex items-center justify-between p-2.5 rounded bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">\n                  <div className="flex items-center gap-2 flex-1 min-w-0">\n                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0"><PlayerAvatar avatar={identity.avatar} /></div>\n                    <span className="text-[11px] text-gray-500 shrink-0">You</span>\n                    <span className={\`text-xs font-semibold px-2 py-0.5 rounded shrink-0 \${record.result === "win" ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"}\`}>{record.result === "win" ? "WIN" : "LOSS"}</span>\n                    <span className="text-xs text-gray-500 shrink-0">vs</span>\n                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0"><PlayerAvatar avatar={record.opponentAvatar ?? record.opponent.charAt(0).toUpperCase()} /></div>\n                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{record.opponent}</span>\n                    <span className="text-xs text-gray-500 shrink-0">• {record.outcome.toUpperCase()}</span>\n                  </div>\n                  <div className={\`text-sm font-bold ml-2 shrink-0 \${record.result === "win" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}\`}>\n                    {record.result === "win" ? "+" : "-"}{formatCurrencyNoDecimals(record.amount)}\n                  </div>\n                </div>\n`;
s = s.slice(0, start) + block + s.slice(end);

// Complete two small type/flow corrections that are applied in the same build pass.
const spin = "src/app/components/SpinBattleGameplay.tsx";
let spinText = fs.readFileSync(spin, "utf8");
spinText = spinText.replace('totalPool:number; timeRemaining:', 'totalPool:number; feeRate?:number; timeRemaining:');
fs.writeFileSync(spin, spinText);

// Private Coin Flip matches must still load automatically; public matches wait for Search.
s = s.replace('if (hasStarted.current || gameState !== "searching") return;', 'if (hasStarted.current || (!privateMatchId && gameState !== "searching")) return;');
s = s.replace('  }, [gameState]);\n\n  const assignSides', '  }, [gameState, privateMatchId]);\n\n  const assignSides');
fs.writeFileSync(path, s);
