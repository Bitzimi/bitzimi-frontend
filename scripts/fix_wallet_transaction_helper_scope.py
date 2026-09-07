from pathlib import Path
p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()
start=s.find('  const getTransactionDetailRows = (tx: any, txDate: Date) => {')
if start < 0: raise SystemExit('Transaction detail helper not found')
end=s.find('\n  return () => {', start)
if end < 0: raise SystemExit('Wallet cleanup return not found')
helper=s[start:end].strip()+"\n"
s=s[:start]+s[end+1:]
render=s.rfind('  return (')
if render < 0: raise SystemExit('Wallet render return not found')
s=s[:render]+helper+'\n'+s[render:]
# Daily streak details must include the actual month while Date & Time remains the final row.
needle='if (m.streakDay != null) rows.push({label:"Streak Day", value:`Day ${m.streakDay}`});\n      rows.push({label:"To", value:m.destinationLabel ?? "Game Wallet"});'
replacement='if (m.streakDay != null) rows.push({label:"Streak Day", value:`Day ${m.streakDay}`});\n      if (m.month) rows.push({label:"Month", value:m.month});\n      rows.push({label:"To", value:m.destinationLabel ?? "Game Wallet"});'
s=s.replace(needle,replacement)
p.write_text(s)
