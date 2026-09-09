from pathlib import Path
import subprocess

if "[game-fix-applied]" in subprocess.check_output(["git", "log", "-1", "--pretty=%B"], text=True):
    raise SystemExit(0)

def replace(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old in s:
        p.write_text(s.replace(old, new, 1))
        return True
    return False

replace("src/app/pages/PvPCoinFlipGame.tsx",
    "const totalPot   = stakeAmount * 2;\n    const feeAmount  = Math.floor(totalPot * (PLATFORM_FEE_PERCENT / 100));\n    const winnings   = totalPot - feeAmount;",
    "const totalPot   = Number(md.totalPool ?? stakeAmount * 2);\n    const feeAmount  = Number(md.platformFee ?? 0);\n    const winnings   = Number(md.payout ?? 0);")
replace("src/app/pages/PvPCoinFlipGame.tsx",
    "  const winnerGets = totalPot * 0.9; // 90% after 10% platform fee",
    "  const winnerGets = Number(matchData?.payout ?? 0);")
replace("src/app/pages/DiceDuelGame.tsx",
    "  const PLATFORM_FEE_PERCENT = 0.1; // 10%\n  const totalPool = stake * 2;\n  const platformFee = totalPool * PLATFORM_FEE_PERCENT;\n  const winnerPayout = totalPool - platformFee;",
    "  const totalPool = Number(matchData?.totalPool ?? stake * 2);\n  const platformFee = Number(matchData?.platformFee ?? 0);\n  const winnerPayout = Number(matchData?.payout ?? 0);")

rp = Path("src/app/pages/ReactionTapGameRoom.tsx")
s = rp.read_text()
s = s.replace('import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp } from "lucide-react";', 'import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp, Info } from "lucide-react";')
s = s.replace('  const [walletAnimation,  setWalletAnimation]  = useState(false);', '  const [walletAnimation,  setWalletAnimation]  = useState(false);\n  const [showRules, setShowRules] = useState(false);')
s = s.replace('    const fee        = Math.floor(totalPool * 0.10);\n    const payout     = totalPool - fee;', '    const fee        = Number(match.platformFee ?? 0);\n    const payout     = Number(match.payout ?? 0);')
s = s.replace('  const winnerPayout    = stakeAmount * 2 * 0.9;', '  const winnerPayout    = Number(winAmount || 0) || 0;')
wallet = '''            <Card className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 transition-all duration-300 ${walletAnimation ? "scale-105" : ""}`}>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mb-0.5">Game Wallet</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(balances.game)}</p>
              </div>
            </Card>'''
s = s.replace(wallet, '', 1)
sidebar_marker = '          {/* Sidebar */}\n          <div className="lg:col-span-1">\n            <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 sticky top-4">'
sidebar_replacement = '''          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 transition-all duration-300 mb-4 ${walletAnimation ? "scale-105" : ""}`}>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mb-0.5">Game Wallet</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(balances.game)}</p>
              </div>
            </Card>
            <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 sticky top-4">'''
s = s.replace(sidebar_marker, sidebar_replacement, 1)
header_end = '''          </div>
        </div>

        {/* Main */}'''
header_new = '''          </div>
            <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)} className="shrink-0">
              <Info className="h-4 w-4 mr-2" />Rules
            </Button>
        </div>
        {showRules && (
          <Card className="mt-3 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Play Reaction Tap</h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Two real players enter the same stake room and each stakes the room amount.</li>
                <li>Both players must be ready before the server sends the reaction signal.</li>
                <li>Tap only when the signal appears. Tapping before it is an early tap and loses the match.</li>
                <li>The faster valid reaction wins; if both players tap early, the match is void and stakes are refunded.</li>
                <li>The winner receives the server-calculated pool payout after the current platform fee.</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Main */}'''
s = s.replace(header_end, header_new, 1)
s = s.replace('Fee (10%)', 'Platform Fee')
rp.write_text(s)

css = Path("src/app/styles/globals.css")
extra = r'''

/* Game header alignment: Coin Flip / Dice Clash. */
@supports selector(:has(*)) {
  .flex.items-center.justify-between.gap-4:has(> div > button:has(svg.lucide-shield)):has(> div > button:has(svg.lucide-info)) { display:grid !important; grid-template-columns:minmax(0,1fr) auto; gap:.5rem 1rem; align-items:center; }
  .flex.items-center.justify-between.gap-4:has(> div > button:has(svg.lucide-shield)):has(> div > button:has(svg.lucide-info)) > div:first-child { grid-column:1; grid-row:1; }
  .flex.items-center.justify-between.gap-4:has(> div > button:has(svg.lucide-shield)):has(> div > button:has(svg.lucide-info)) > div:last-child { display:contents; }
  .flex.items-center.justify-between.gap-4:has(> div > button:has(svg.lucide-shield)):has(> div > button:has(svg.lucide-info)) > div > button:has(svg.lucide-info) { grid-column:2; grid-row:1; justify-self:end; }
  .flex.items-center.justify-between.gap-4:has(> div > button:has(svg.lucide-shield)):has(> div > button:has(svg.lucide-info)) > div > button:has(svg.lucide-shield) { grid-column:1; grid-row:2; justify-self:start; }
}
'''
current = css.read_text()
if "Game header alignment: Coin Flip / Dice Clash." not in current:
    css.write_text(current + extra)

subprocess.run(["git", "config", "user.name", "github-actions[bot]"])
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"])
subprocess.run(["git", "add", "src/app/pages/PvPCoinFlipGame.tsx", "src/app/pages/DiceDuelGame.tsx", "src/app/pages/ReactionTapGameRoom.tsx", "src/app/styles/globals.css"])
if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
    raise SystemExit(0)
subprocess.run(["git", "commit", "-m", "fix: apply game payout and header corrections [game-fix-applied]"], check=True)
subprocess.run(["git", "push"], check=True)
