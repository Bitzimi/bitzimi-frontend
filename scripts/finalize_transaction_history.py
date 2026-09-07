from pathlib import Path

p = Path('src/app/pages/Wallet.tsx')
s = p.read_text()
marker = '  // [transaction-ui-final]\n'
if marker in s:
    raise SystemExit(0)
helper = '''  const getTransactionDetailRows = (tx: any, txDate: Date) => {
    const m = tx?.metadata ?? {};
    const type = String(tx?.type ?? "").toLowerCase();
    const label = (v: any) => String(v ?? "").replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
    const wallet = (v: any) => `${label(v)} Wallet`;
    const gameNames: Record<string,string> = {
      color_game:"Colour Prediction", color_prediction:"Colour Prediction", colour_prediction:"Colour Prediction",
      spin_battle:"Spin Battle", dice_clash:"Dice Clash", dice_royale:"Dice Royale", dice_arena:"Dice Arena",
      coin_flip:"Coin Flip", pvp_coinflip:"Coin Flip", pvp_coin_flip:"Coin Flip", reaction_tap:"Reaction Tap"
    };
    const gameKey = String(m.gameType ?? m.game ?? "").toLowerCase().replace(/[-\\s]/g, "_");
    const rows: Array<{label:string; value:any}> = [];
    const add = (name:string, value:any) => { if (value !== undefined && value !== null && String(value).trim() !== "") rows.push({label:name, value}); };
    const shortId = tx?.id ? (String(tx.id).startsWith("tx_") ? String(tx.id) : `tx_${Date.parse(tx.createdAt)}_${String(tx.id).replace(/-/g, "").slice(0,9)}`) : "";
    add("Transaction ID", <span className="font-mono text-xs">{shortId}</span>);
    add("Amount", <span className="font-semibold">{formatCurrency(Number(tx.amount))}</span>);
    add("Type", getTransactionTypeLabel(type));
    add("Status", getStatusBadge(tx.status));
    if (type === "transfer") {
      add("From", m.fromWallet ? wallet(m.fromWallet) : undefined); add("To", m.toWallet ? wallet(m.toWallet) : undefined);
      add("Task", m.taskTitle); add("Task ID", m.taskId); add("Worker", m.workerId); add("Reason", m.reason);
    } else if (type === "deposit" || type === "withdrawal") {
      add("Method", m.method ? label(m.method) : undefined); add("Network", m.network); add("Bank", m.bankName);
      if (type === "withdrawal") add("Destination", m.destination ?? m.walletAddress ?? (m.accountNumber ? `${m.bankName ?? "Bank"} • ${m.accountNumber}` : undefined));
      if (type === "deposit") add("To", m.destinationLabel ?? (m.toWallet ? wallet(m.toWallet) : undefined));
      const reference = String(m.txHash ?? m.referenceCode ?? m.paymentReference ?? "").trim();
      if (reference) add("Reference ID", <span className="flex items-center gap-2 justify-end"><span className="font-mono text-xs max-w-[220px] truncate">{reference.length > 24 ? `${reference.slice(0,24)}…` : reference}</span><button type="button" className="shrink-0 text-primary hover:opacity-80" onClick={(e)=>{e.stopPropagation(); navigator.clipboard?.writeText(reference); toast.success("Reference ID copied");}} aria-label="Copy reference ID"><Copy className="h-3.5 w-3.5"/></button></span>);
      if (m.fee != null) add("Fee", formatCurrency(Number(m.fee))); if (m.netAmount != null) add("Net Amount", formatCurrency(Number(m.netAmount)));
    } else if (type.startsWith("game_")) {
      add("Game", gameNames[gameKey] ?? (gameKey ? label(gameKey) : undefined));
      const lobby = m.lobby ?? m.lobbyName ?? m.lobbyId; const stake = m.stakeRoom ?? m.stake ?? m.stakeAmount ?? m.roomStake;
      if (lobby != null) add("Lobby", `Lobby ${String(lobby).replace(/^Lobby\\s*/i, "")}`); else if (stake != null) add("Stake Room", formatCurrency(Number(stake)));
      add("Round", m.roundNumber != null ? `#${m.roundNumber}` : undefined); add("Color", m.color ? label(m.color) : undefined); add("Selection", m.selection ? label(m.selection) : undefined); add("Team", m.team); add("Result", m.result); add("Opponent", m.opponentId); add("Roll", m.roll);
    } else if (type === "task_reward" || type === "task_proof") {
      add("From", m.sourceLabel ?? (m.taskTitle ? `Task: ${m.taskTitle}` : "Completed Task")); add("Task", m.taskTitle); add("Task ID", m.taskId); add("Task Type", m.taskType ? label(m.taskType) : undefined); add("To", m.destinationLabel ?? (m.toWallet ? wallet(m.toWallet) : "Task Wallet"));
    } else if (type === "referral_bonus") {
      add("From", m.sourceLabel ?? "Referral Reward"); add("To", m.destinationLabel ?? "Referral Wallet"); add("Reward Trigger", m.rewardTrigger); add("Referred User", m.referredUserId); add("Referrer", m.referrerId);
    } else if (type === "affiliate_commission" || type === "ambassador_commission") {
      const name = type === "affiliate_commission" ? "Affiliate" : "Ambassador"; add("From", m.sourceLabel ?? `${name} Commission`); add("To", m.destinationLabel ?? `${name} Wallet`); add("Tier", m.tier != null ? `Tier ${m.tier}` : undefined); add("Event", m.eventType ? label(m.eventType) : undefined); add("Rate", m.rate != null ? `${Number(m.rate) * 100}%` : undefined); add("Source User", m.sourceUserId);
    } else if (type === "streak_reward") {
      add("From", m.sourceLabel ?? "Daily Streak"); add("Streak Day", m.streakDay != null ? `Day ${m.streakDay}` : undefined); add("To", m.destinationLabel ?? "Game Wallet");
    } else if (type === "vip_purchase") {
      add("From", m.sourceLabel ?? "Game Wallet"); add("Subscription", m.subscriptionType ?? "VIP"); add("Plan", m.subscriptionPlan ?? "Monthly"); add("Duration", m.durationDays != null ? `${m.durationDays} days` : undefined); add("To", m.destinationLabel ?? "VIP Membership");
    } else if (type === "challenge_reward") {
      add("From", m.sourceLabel ?? (m.challengeTitle ? `Monthly Challenge: ${m.challengeTitle}` : "Monthly Challenge")); add("Period", m.challengePeriod); add("Level", m.level ? label(m.level) : undefined); add("Rank", m.rank != null ? `#${m.rank}` : undefined); add("Prize Pool", m.pool != null ? formatCurrency(Number(m.pool)) : undefined); add("To", m.destinationLabel ?? "Task Wallet");
    } else if (type === "vip_grant") {
      add("From", m.sourceLabel ?? "Admin VIP Grant"); add("Duration", m.durationDays != null ? `${m.durationDays} days` : undefined); add("Reason", m.reason);
    } else if (type === "football_points_conversion") {
      add("From", m.sourceLabel ?? "Football Points"); add("Points Converted", m.pointsConsumed != null ? Number(m.pointsConsumed).toLocaleString() : undefined); add("Batches", m.batches); add("USD Earned", m.usdEarned != null ? formatCurrency(Number(m.usdEarned)) : undefined); add("To", m.destinationLabel ?? "Game Wallet");
    } else if (type === "featured_payment") {
      add("From", m.sourceLabel ?? (m.fromWallet ? wallet(m.fromWallet) : "Task Wallet")); add("Task", m.title); add("Task ID", m.taskId); add("Duration", m.durationDays != null ? `${m.durationDays} days` : undefined); add("Locations", Array.isArray(m.locations) ? m.locations.join(", ") : m.locations);
    } else if (type === "featured_refund") {
      add("From", "Featured Placement Refund"); add("Task ID", m.taskId); add("Duration", m.durationDays != null ? `${m.durationDays} days` : undefined); add("Reason", m.reason); add("To", m.destinationLabel ?? "Task Wallet");
    } else if (type === "auction_bid") {
      add("From", m.fromWallet ? wallet(m.fromWallet) : "Game Wallet"); add("Auction", m.title); add("Auction ID", m.auctionId); add("Bid Number", m.bidNumber != null ? `#${m.bidNumber}` : undefined);
    } else if (type === "auction_reward") {
      add("From", m.sourceLabel ?? "Auction Reward"); add("Auction", m.auctionTitle ?? m.title); add("Auction ID", m.auctionId); add("Reward Type", m.rewardType ? label(m.rewardType) : undefined); add("To", m.destinationLabel ?? "Game Wallet");
    } else if (type === "admin_credit" || type === "admin_debit") {
      add("Reason", m.reason); add("Admin", m.adminId); add("Balance Before", m.balanceBefore != null ? formatCurrency(Number(m.balanceBefore)) : undefined); add("From", m.fromWallet ? wallet(m.fromWallet) : undefined); add("To", m.toWallet ? wallet(m.toWallet) : undefined);
    } else if (type === "wallet_freeze" || type === "wallet_unfreeze") {
      add("Wallet", m.fromWallet || m.toWallet ? wallet(m.fromWallet ?? m.toWallet) : "Wallet"); add("Reason", m.reason); add("Admin", m.adminId);
    } else if (m.sourceLabel || m.destinationLabel) { add("From", m.sourceLabel); add("To", m.destinationLabel); }
    add("Date & Time", txDate.toLocaleString());
    return rows;
  };
  // [transaction-ui-final]
'''
pos = s.rfind('  return (')
if pos < 0:
    raise SystemExit('Wallet return marker not found')
s = s[:pos] + helper + s[pos:]
p.write_text(s)
