from pathlib import Path
import re

p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()

helper = r'''  const getTransactionDetailRows = (tx: any, txDate: Date) => {
    const m = tx.metadata ?? {};
    const type = String(tx.type ?? "").toLowerCase();
    const wallet = (v: any) => String(v ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const gameKey = String(m.gameType ?? m.game ?? m.game_type ?? "").toLowerCase().replace(/[-\s]/g, "_");
    const gameNames: Record<string,string> = { color_game:"Colour Prediction", color_prediction:"Colour Prediction", colour_prediction:"Colour Prediction", spin_battle:"Spin Battle", dice_clash:"Dice Clash", dice_royale:"Dice Royale", dice_arena:"Dice Arena", pvp_coinflip:"Coin Flip", coin_flip:"Coin Flip", pvp_coin_flip:"Coin Flip", reaction_tap:"Reaction Tap" };
    const game = gameNames[gameKey] ?? (gameKey ? wallet(gameKey) : "");
    const rows: Array<{label:string; value:any}> = [
      { label:"Transaction ID", value:<span className="font-mono text-xs">{typeof tx.id === "string" ? (tx.id.startsWith("tx_") ? tx.id : `tx_${Date.parse(tx.createdAt)}_${tx.id.replace(/-/g, "").slice(0,9)}`) : tx.id}</span> },
      { label:"Amount", value:<span className="font-semibold">{formatCurrency(tx.amount)}</span> },
      { label:"Type", value:getTransactionTypeLabel(tx.type) },
      { label:"Status", value:getStatusBadge(tx.status) },
    ];
    if (type === "transfer") {
      if (m.fromWallet) rows.push({label:"From", value:`${wallet(m.fromWallet)} Wallet`});
      if (m.toWallet) rows.push({label:"To", value:`${wallet(m.toWallet)} Wallet`});
    } else if (type === "deposit" || type === "withdrawal") {
      if (m.method) rows.push({label:"Method", value:wallet(m.method)});
      if (m.network) rows.push({label:"Network", value:m.network});
      if (m.bankName) rows.push({label:"Bank", value:m.bankName});
      if (type === "withdrawal" && m.destination) rows.push({label:m.method === "bank" ? "Bank Account" : "Wallet Address", value:m.destination});
      if (type === "deposit" && m.destinationLabel) rows.push({label:"To", value:m.destinationLabel});
      const ref = m.referenceCode;
      if (ref) rows.push({label:"Reference ID", value:<span className="flex items-center gap-2 justify-end"><span className="font-mono text-xs max-w-[220px] truncate">{String(ref).length > 24 ? `${String(ref).slice(0,24)}…` : String(ref)}</span><button type="button" className="shrink-0 text-primary hover:opacity-80" onClick={(e)=>{e.stopPropagation(); navigator.clipboard?.writeText(String(ref)); toast.success("Reference ID copied");}} aria-label="Copy reference ID"><Copy className="h-3.5 w-3.5"/></button></span>});
      if (type === "withdrawal" && m.fee != null) rows.push({label:"Fee", value:formatCurrency(Number(m.fee))});
      if (type === "withdrawal" && m.netAmount != null) rows.push({label:"Net Amount", value:formatCurrency(Number(m.netAmount))});
    } else if (type.startsWith("game_")) {
      if (game) rows.push({label:"Game", value:game});
      const lobby = m.lobby ?? m.lobbyName ?? m.lobbyId;
      const stake = m.stakeRoom ?? m.stake ?? m.stakeAmount ?? m.roomStake;
      if (lobby != null && String(lobby).trim()) rows.push({label:"Lobby", value:`Lobby ${String(lobby).replace(/^Lobby\s*/i,"")}`});
      else if (stake != null && String(stake).trim()) rows.push({label:"Stake Room", value:`$${Number(stake).toLocaleString()}`});
      if (m.roundNumber != null) rows.push({label:"Round", value:`#${m.roundNumber}`});
      if (m.color) rows.push({label:"Color", value:wallet(m.color)});
      if (m.selection) rows.push({label:"Selection", value:wallet(m.selection)});
    } else if (type === "task_reward") {
      rows.push({label:"From", value:m.sourceLabel ?? (m.taskTitle ? `Task: ${m.taskTitle}` : "Completed Task")});
      rows.push({label:"To", value:m.destinationLabel ?? (m.toWallet ? `${wallet(m.toWallet)} Wallet` : "Task Wallet")});
      if (m.taskType) rows.push({label:"Task Type", value:wallet(m.taskType)});
      if (m.taskId) rows.push({label:"Task ID", value:m.taskId});
    } else if (type === "referral_bonus") {
      rows.push({label:"From", value:m.sourceLabel ?? "Referral Reward"});
      rows.push({label:"To", value:m.destinationLabel ?? "Referral Wallet"});
      if (m.rewardTrigger) rows.push({label:"Reward Trigger", value:m.rewardTrigger});
      if (m.referredUserId) rows.push({label:"Referred User", value:m.referredUserId});
    } else if (type === "affiliate_commission" || type === "ambassador_commission") {
      rows.push({label:"From", value:m.sourceLabel ?? `${type === "affiliate_commission" ? "Affiliate" : "Ambassador"} Commission`});
      rows.push({label:"To", value:m.destinationLabel ?? `${type === "affiliate_commission" ? "Affiliate" : "Ambassador"} Wallet`});
      if (m.tier != null) rows.push({label:"Tier", value:`Tier ${m.tier}`});
      if (m.eventType) rows.push({label:"Event", value:wallet(m.eventType)});
      if (m.rate != null) rows.push({label:"Rate", value:`${Number(m.rate)*100}%`});
    } else if (type === "streak_reward") {
      rows.push({label:"From", value:m.sourceLabel ?? "Daily Streak"});
      if (m.streakDay != null) rows.push({label:"Streak Day", value:`Day ${m.streakDay}`});
      if (m.month) rows.push({label:"Month", value:m.month});
      rows.push({label:"To", value:m.destinationLabel ?? "Game Wallet"});
    } else if (type === "vip_purchase") {
      rows.push({label:"From", value:m.sourceLabel ?? "Game Wallet"});
      rows.push({label:"Subscription", value:m.subscriptionType ?? "VIP"});
      rows.push({label:"Plan", value:m.subscriptionPlan ?? "Monthly"});
      if (m.durationDays != null) rows.push({label:"Duration", value:`${m.durationDays} days`});
      rows.push({label:"To", value:m.destinationLabel ?? "VIP Membership"});
    } else if (type === "challenge_reward") {
      rows.push({label:"From", value:m.sourceLabel ?? "Monthly Challenge"});
      if (m.level) rows.push({label:"Level", value:wallet(m.level)});
      if (m.rank != null) rows.push({label:"Rank", value:`#${m.rank}`});
      if (m.pool != null) rows.push({label:"Prize Pool", value:formatCurrency(Number(m.pool))});
      rows.push({label:"To", value:m.destinationLabel ?? "Task Wallet"});
    } else if (type === "vip_grant") {
      rows.push({label:"From", value:m.sourceLabel ?? "VIP Grant"});
      if (m.durationDays != null) rows.push({label:"Duration", value:`${m.durationDays} days`});
      if (m.reason) rows.push({label:"Reason", value:m.reason});
    } else if (m.sourceLabel || m.destinationLabel) {
      if (m.sourceLabel) rows.push({label:"From", value:m.sourceLabel});
      if (m.destinationLabel) rows.push({label:"To", value:m.destinationLabel});
    }
    rows.push({label:"Date & Time", value:txDate.toLocaleString()});
    return rows;
  };
'''
marker='  // Transaction History\n'
if 'const getTransactionDetailRows' not in s:
    if marker not in s: raise SystemExit('Wallet transaction-history marker not found')
    s=s.replace(marker,helper+marker,1)
pat=re.compile(r'\[\s*\{ label: "Transaction ID".*?\n\s*\]',re.S)
s,n=pat.subn('[...getTransactionDetailRows(tx, txDate)]',s)
print('arrays replaced:',n)
if n != 2: raise SystemExit(f'Expected 2 transaction detail arrays, found {n}')
p.write_text(s)
