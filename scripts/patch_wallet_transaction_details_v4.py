from pathlib import Path
import re

p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()

# Move a helper that was accidentally placed inside the monitoring useEffect.
bad=re.search(r'    // Cleanup on unmount\n(?P<helper>  const getTransactionDetailRows = \(tx: any, txDate: Date\) => \{.*?\n  \};)\n\n  return \(\) => \{',s,re.S)
if bad:
    helper=bad.group('helper')
    s=s[:bad.start()]+'    // Cleanup on unmount\n    return () => {'+s[bad.end():]
    idx=s.rfind('  return (')
    if idx < 0: raise SystemExit('Wallet return not found')
    s=s[:idx]+helper+'\n\n'+s[idx:]

while True:
    dup=re.search(r'    // Cleanup on unmount\n\s{2,}const getTransactionDetailRows = \(tx: any, txDate: Date\) => \{.*?\n\s{2,}\};\n\n\s*return \(\) => \{',s,re.S)
    if not dup: break
    s=s[:dup.start()]+'    // Cleanup on unmount\n    return () => {'+s[dup.end():]

if 'const getTransactionDetailRows' not in s:
    raise SystemExit('Transaction detail helper missing')

transfer='''      if (m.fromWallet) rows.push({label:"From", value:`${wallet(m.fromWallet)} Wallet`});\n      if (m.toWallet) rows.push({label:"To", value:`${wallet(m.toWallet)} Wallet`});'''
transfer2='''      if (m.fromWallet) rows.push({label:"From", value:`${wallet(m.fromWallet)} Wallet`});\n      if (m.toWallet) rows.push({label:"To", value:`${wallet(m.toWallet)} Wallet`});\n      if (m.taskTitle) rows.push({label:"Task", value:m.taskTitle});\n      if (m.taskId) rows.push({label:"Task ID", value:m.taskId});\n      if (m.workerId) rows.push({label:"Worker", value:m.workerId});\n      if (m.reason) rows.push({label:"Reason", value:m.reason});'''
if transfer in s and 'if (m.workerId) rows.push({label:"Worker"' not in s:
    s=s.replace(transfer,transfer2,1)

anchor='    } else if (m.sourceLabel || m.destinationLabel) {'
inject='''    } else if (type === "football_points_conversion") {\n      rows.push({label:"From", value:m.sourceLabel ?? "Football Points"});\n      if (m.pointsConsumed != null) rows.push({label:"Points Converted", value:Number(m.pointsConsumed).toLocaleString()});\n      if (m.batches != null) rows.push({label:"Batches", value:m.batches});\n      if (m.usdEarned != null) rows.push({label:"USD Earned", value:formatCurrency(Number(m.usdEarned))});\n      rows.push({label:"To", value:m.destinationLabel ?? "Game Wallet"});\n    } else if (type === "featured_payment") {\n      rows.push({label:"From", value:m.sourceLabel ?? (m.fromWallet ? `${wallet(m.fromWallet)} Wallet` : "Task Wallet")});\n      if (m.title) rows.push({label:"Task", value:m.title});\n      if (m.taskId) rows.push({label:"Task ID", value:m.taskId});\n      if (m.durationDays != null) rows.push({label:"Duration", value:`${m.durationDays} days`});\n      if (m.locations) rows.push({label:"Locations", value:Array.isArray(m.locations) ? m.locations.join(", ") : m.locations});\n    } else if (type === "featured_refund") {\n      rows.push({label:"From", value:"Featured Placement Refund"});\n      if (m.taskId) rows.push({label:"Task ID", value:m.taskId});\n      if (m.durationDays != null) rows.push({label:"Duration", value:`${m.durationDays} days`});\n      if (m.reason) rows.push({label:"Reason", value:m.reason});\n      rows.push({label:"To", value:m.destinationLabel ?? "Task Wallet"});\n    } else if (type === "auction_bid") {\n      rows.push({label:"From", value:m.fromWallet ? `${wallet(m.fromWallet)} Wallet` : "Game Wallet"});\n      if (m.title) rows.push({label:"Auction", value:m.title});\n      if (m.auctionId) rows.push({label:"Auction ID", value:m.auctionId});\n      if (m.bidNumber != null) rows.push({label:"Bid Number", value:`#${m.bidNumber}`});\n    } else if (type === "auction_reward") {\n      rows.push({label:"From", value:m.sourceLabel ?? "Auction Reward"});\n      if (m.auctionTitle) rows.push({label:"Auction", value:m.auctionTitle});\n      if (m.auctionId) rows.push({label:"Auction ID", value:m.auctionId});\n      if (m.rewardType) rows.push({label:"Reward Type", value:wallet(m.rewardType)});\n      rows.push({label:"To", value:m.destinationLabel ?? "Game Wallet"});\n    } else if (type === "admin_credit" || type === "admin_debit") {\n      if (m.reason) rows.push({label:"Reason", value:m.reason});\n      if (m.adminId) rows.push({label:"Admin", value:m.adminId});\n      if (m.balanceBefore != null) rows.push({label:"Balance Before", value:formatCurrency(Number(m.balanceBefore))});\n      if (m.fromWallet) rows.push({label:"From", value:`${wallet(m.fromWallet)} Wallet`});\n      if (m.toWallet) rows.push({label:"To", value:`${wallet(m.toWallet)} Wallet`});\n    } else if (type === "wallet_freeze" || type === "wallet_unfreeze") {\n      rows.push({label:"Wallet", value:m.fromWallet || m.toWallet ? `${wallet(m.fromWallet ?? m.toWallet)} Wallet` : "Wallet"});\n      if (m.reason) rows.push({label:"Reason", value:m.reason});\n      if (m.adminId) rows.push({label:"Admin", value:m.adminId});\n    } else if (m.sourceLabel || m.destinationLabel) {\n'''
if 'type === "football_points_conversion"' not in s:
    if anchor not in s: raise SystemExit('detail category anchor not found')
    s=s.replace(anchor,inject,1)

# Date & Time remains the final row; no separate Month row is rendered.
s=re.sub(r'\n\s*if \(m\.month\).*?;', '', s)
p.write_text(s)
