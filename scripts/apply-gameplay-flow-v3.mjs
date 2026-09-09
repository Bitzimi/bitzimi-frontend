import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);
  s = s.replace('import { ArrowLeft, Info, Shield } from "lucide-react";', 'import { ArrowLeft, Info, Shield, Search } from "lucide-react";');
  s = s.replace('type GameState = "idle" | "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  s = s.replace('if (gameState !== "ready") return;', 'if (gameState !== "ready" && gameState !== "result_popup" && gameState !== "showing_result") return;\n    if (searchInFlight.current) return;\n    searchInFlight.current = true;');
  s = s.replace('  const hasStarted = useRef(false);', '  const hasStarted = useRef(false);\n  const searchInFlight = useRef(false);');
  s = s.replaceAll('setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());', 'setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());');
  s = s.replace('const gameOpponentAvatar = md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;', 'const gameOpponentAvatar = md.opponent?.avatar ?? md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;');
  if (!s.includes('getGameConfig("pvp_coinflip")')) {
    const marker = '  const myUsername = identity.username;';
    s = s.replace(marker, `${marker}\n\n  useEffect(() => { gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);`);
  }
  if (!s.includes('recoverQueue("pvp_coinflip"')) {
    const marker = '  // Public matchmaking starts only after the user presses Search.';
    const recovery = `  // Recover an already-paid public search after reload/navigation. Never create a second queue.\n  useEffect(() => {\n    if (privateMatchId) return;\n    let disposed = false;\n    const recover = async () => {\n      try {\n        const recovered = await gameMatchmakingService.recoverQueue("pvp_coinflip", stakeAmount);\n        if (disposed || !recovered) return;\n        searchInFlight.current = true;\n        if (recovered.status === "matched" && recovered.matchId) {\n          const match = await gameMatchmakingService.getMatch(recovered.matchId);\n          if (disposed) return;\n          setMatchId(recovered.matchId); setMatchData(match); setOpponentName(match.opponent.username);\n          setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");\n          setTimeout(() => assignSides(match), 300);\n          return;\n        }\n        if (recovered.status === "waiting" && recovered.queueId) {\n          setQueueId(recovered.queueId); setGameState("searching");\n          if (pollRef.current) clearInterval(pollRef.current);\n          pollRef.current = setInterval(async () => {\n            try {\n              const status = await gameMatchmakingService.pollQueue(recovered.queueId!);\n              if (status.status === "matched" && status.matchId) {\n                clearInterval(pollRef.current!);\n                const match = await gameMatchmakingService.getMatch(status.matchId);\n                setMatchId(status.matchId); setMatchData(match); setOpponentName(match.opponent.username);\n                setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");\n                setTimeout(() => assignSides(match), 300);\n              } else if (status.status === "cancelled") {\n                clearInterval(pollRef.current!); searchInFlight.current = false; setQueueId(null); setGameState("ready");\n              }\n            } catch {}\n          }, 500);\n        }\n      } catch {}\n    };\n    recover();\n    return () => { disposed = true; };\n  }, [privateMatchId, stakeAmount]);\n\n`;
    s = s.replace(marker, recovery + marker);
  }
  s = s.replace('    } catch { setGameState("ready"); toast.error("Unable to start matchmaking"); }', '    } catch (error: any) { searchInFlight.current = false; setGameState("ready"); toast.error(error?.message || "Unable to start matchmaking"); }');
  s = s.replace('const totalPot = Number(matchData?.totalPool ?? stakeAmount);\n  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));', 'const hasActiveStake = gameState !== "ready" && gameState !== "idle";\n  const totalPot = matchId ? Number(matchData?.totalPool ?? 0) : (hasActiveStake ? stakeAmount : 0);\n  const winnerGets = matchId ? Number(matchData?.payout ?? 0) : (hasActiveStake && feeRate > 0 ? stakeAmount * (1 - feeRate) : 0);');
  s = s.replace('{gameState === "idle" && (\n              <div className="text-center">\n                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}', '{gameState === "ready" && (\n              <div className="text-center">\n                <Button onClick={startSearch} className="h-12 min-w-[190px] px-7 rounded-md bg-[#fcd535] text-[#181a20] font-semibold shadow-[0_8px_24px_rgba(252,213,53,0.14)] border border-[#f0b90b]/40 hover:bg-[#f0b90b] hover:text-[#181a20] transition-colors">\n                  <Search className="h-4 w-4 mr-2" />Search\n                </Button>\n                <div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div>\n              </div>\n            )}');
  s = s.replaceAll('<PlayerAvatar avatar={opponentAvatar} />', '<PlayerAvatar avatar={matchData?.opponent?.avatar ?? opponentAvatar} />');
  s = s.replace('Winner takes 90% of the total pot (10% platform fee)', 'Winner receives the total pool after the configured platform fee');
  const duplicateButtons = '              <Button onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}>Search for New Opponent</Button>\n              <Button\n                onClick={() => { setShowResultPopup(false); navigate(`/game/pvp-coinflip/play?stake=${stakeAmount}`); }}\n                className="w-full mt-2"\n              >\n                Search for New Opponent\n              </Button>';
  const singleButton = '              <Button\n                onClick={() => {\n                  gameMatchmakingService.clearQueueContext("pvp_coinflip");\n                  searchInFlight.current = false;\n                  setShowResultPopup(false);\n                  setShowWinner(false);\n                  setCoinResult(null);\n                  setMatchId(null);\n                  setMatchData(null);\n                  setQueueId(null);\n                  setGameState("result_popup");\n                  setTimeout(() => startSearch(), 0);\n                }}\n                className="w-full mt-3 h-12 rounded-md bg-[#fcd535] text-[#181a20] font-semibold border border-[#f0b90b]/50 shadow-[0_8px_24px_rgba(252,213,53,0.14)] hover:bg-[#f0b90b] transition-colors"\n              >\n                <Search className="h-4 w-4 mr-2" />Search for New Opponent\n              </Button>';
  s = s.replace(duplicateButtons, singleButton);
  s = s.replace('setShowResultPopup(true);', 'gameMatchmakingService.clearQueueContext("pvp_coinflip"); searchInFlight.current = false; setShowResultPopup(true);');
  write(p, s);
}

{
  const p = "src/app/pages/DiceDuelGame.tsx";
  let s = read(p);
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '          {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  write(p, s);
}

{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);
  s = s.replace('  | "idle"\n  | "searching"', '  | "ready"\n  | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '            {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  const headerDuplicate = '            <div className="min-w-0 flex items-center gap-[6px]">\n              <span className="text-sm text-gray-500 whitespace-nowrap">Reaction Tap - Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>\n            </div>\n';
  s = s.replace(headerDuplicate, '            <div></div>\n');
  if (!s.includes('const [feeRate, setFeeRate]')) {
    const marker = '  const myUsername   = identity.username;';
    s = s.replace(marker, '  const myUsername   = identity.username;\n  const [feeRate, setFeeRate] = useState(0);\n  useEffect(() => { gameMatchmakingService.getGameConfig("reaction_tap").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);');
  }
  s = s.replace('  const winnerPayout    = Number(winAmount || 0) || 0;', '  const totalPoolDisplay = matchId ? stakeAmount * 2 : stakeAmount;\n  const winnerPayout    = Number(winAmount || (feeRate > 0 ? stakeAmount * (1 - feeRate) : 0)) || 0;');
  s = s.replace('{formatCurrencyNoDecimals(stakeAmount * 2)}', '{formatCurrencyNoDecimals(totalPoolDisplay)}');
  write(p, s);
}

{
  const p = "src/app/hooks/useGlobalGameMonitor.tsx";
  let s = read(p);
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_win",[\s\S]*?\n\s*\);/g, "");
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_loss",[\s\S]*?\n\s*\);/g, "");
  write(p, s);
}

{
  const p = "src/app/components/SpinBattleGameplay.tsx";
  let s = read(p);
  s = s.replace('const potentialWin=Math.floor(lobbyState.totalPool*.9);', 'const potentialWin=lobbyState.totalPool*(1-(lobbyState.feeRate??0));');
  write(p, s);
}

for (const p of ["src/app/pages/PvPCoinFlipGame.tsx", "src/app/pages/DiceDuelGame.tsx", "src/app/pages/ReactionTapGameRoom.tsx"]) {
  let s = read(p).replace(/\}, 2000\);/g, '}, 500);');
  write(p, s);
}

console.log("Applied gameplay flow v3.");
