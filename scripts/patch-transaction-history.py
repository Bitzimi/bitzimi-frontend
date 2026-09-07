from pathlib import Path
p=Path('src/app/pages/Wallet.tsx'); s=p.read_text()
s=s.replace('const isDebit = tx.type === "withdrawal" || tx.type === "game_bet" || tx.type === "vip_purchase";', 'const isDebit = tx.type === "withdrawal" || tx.type === "game_bet" || tx.type === "vip_purchase" || tx.type === "featured_payment" || tx.type === "auction_bid" || (tx.type === "transfer" && !!tx.metadata?.fromWallet && tx.metadata?.fromWallet !== tx.metadata?.toWallet);',1)
s=s.replace('{ label: "Platform Reference", value: <span className="font-mono text-xs">{tx.id}</span> },','{ label: "Transaction ID", value: <span className="font-mono text-xs">{`tx_${new Date(tx.createdAt).getTime()}_${String(tx.id).replace(/-/g, "").slice(-9)}`}</span> },',1)
s=s.replace('tx.metadata?.gameType ? { label: "Game", value: tx.metadata.gameType.replace(/_/g, " ") } : null,','tx.metadata?.gameType ? { label: "Game", value: ({ color_game: "Colour Prediction", color_prediction: "Colour Prediction", spin_battle: "Spin Battle", dice_clash: "Dice Clash", dice_royale: "Dice Royale", dice_arena: "Dice Arena", pvp_coinflip: "Coin Flip", coin_flip: "Coin Flip", reaction_tap: "Reaction Tap" } as Record<string,string>)[tx.metadata.gameType] || tx.metadata.gameType.replace(/_/g, " ") } : null,',1)
s=s.replace('tx.metadata?.stake ? { label: "Room", value: formatCurrency(tx.metadata.stake) } : null,','(tx.metadata?.stakeRoom ?? tx.metadata?.stake) ? { label: "Stake Room", value: formatCurrency(tx.metadata?.stakeRoom ?? tx.metadata?.stake) } : null,',1)
s=s.replace('''tx.metadata?.streakDay ? { label: "Streak Day", value: `Day ${tx.metadata.streakDay}` } : null,''','''tx.metadata?.streakDay ? { label: "Streak Day", value: `Day ${tx.metadata.streakDay}` } : null,

tx.metadata?.taskTitle ? { label: "Task", value: tx.metadata.taskTitle } : null,
tx.metadata?.taskId ? { label: "Task ID", value: tx.metadata.taskId } : null,
tx.metadata?.taskType ? { label: "Task Type", value: tx.metadata.taskType.replace(/_/g, " ") } : null,
tx.metadata?.rewardAmount ? { label: "Reward", value: formatCurrency(tx.metadata.rewardAmount) } : null,
tx.metadata?.rewardTrigger ? { label: "Reward Trigger", value: tx.metadata.rewardTrigger } : null,
tx.metadata?.referredUserId ? { label: "Referred User", value: tx.metadata.referredUserId } : null,
tx.metadata?.tier != null ? { label: "Tier", value: `Tier ${tx.metadata.tier}` } : null,
tx.metadata?.eventType ? { label: "Event", value: tx.metadata.eventType.replace(/_/g, " ") } : null,
tx.metadata?.rate != null ? { label: "Rate", value: `${Number(tx.metadata.rate) * 100}%` } : null,
tx.metadata?.sourceUserId ? { label: "Source User", value: tx.metadata.sourceUserId } : null,
tx.metadata?.destination ? { label: tx.metadata.method === "bank" ? "Destination" : "Wallet Address", value: tx.metadata.destination } : null,
tx.metadata?.walletDebits ? { label: "Source Wallets", value: Object.entries(tx.metadata.walletDebits).filter(([,v]) => Number(v)>0).map(([k,v]) => `${k} ${formatCurrency(Number(v))}`).join(", ") } : null,
tx.metadata?.durationDays ? { label: "Duration", value: `${tx.metadata.durationDays} days` } : null,
tx.metadata?.challengeTitle ? { label: "Challenge", value: tx.metadata.challengeTitle } : null,
tx.metadata?.level ? { label: "Level", value: tx.metadata.level } : null,
tx.metadata?.rank != null ? { label: "Rank", value: `#${tx.metadata.rank}` } : null,
tx.metadata?.pool != null ? { label: "Prize Pool", value: formatCurrency(tx.metadata.pool) } : null,
tx.metadata?.title ? { label: "Auction", value: tx.metadata.title } : null,
tx.metadata?.bidNumber ? { label: "Bid Number", value: `#${tx.metadata.bidNumber}` } : null,

(tx.metadata?.txHash || tx.metadata?.referenceCode || tx.metadata?.referenceId || tx.metadata?.referenceRecordId) ? {
  label: "Reference ID",
  value: (() => { const ref = tx.metadata?.txHash || tx.metadata?.referenceCode || tx.metadata?.referenceId || tx.metadata?.referenceRecordId; return <span className="flex items-center gap-2 justify-end"><span className="font-mono text-xs break-all">{ref}</span><button type="button" className="shrink-0 text-primary hover:opacity-80" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(String(ref)); toast.success("Reference ID copied"); }} aria-label="Copy reference ID"><Copy className="h-3.5 w-3.5" /></button></span>; })()
} : null,''',1)
s=s.replace('game_win: "Game Win",','game_win: "Game Win", game_loss: "Game Loss", game_void: "Game Void",',1)
p.write_text(s)
