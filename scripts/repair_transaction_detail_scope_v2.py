from pathlib import Path
p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()
sig='const getTransactionDetailRows = (tx: any, txDate: Date) => {'
positions=[]; start=0
while True:
    i=s.find(sig,start)
    if i<0: break
    positions.append(i); start=i+len(sig)
if not positions: raise SystemExit('transaction detail helper not found')
i=positions[0]; brace=s.find('{',i); depth=0; end=None
for j in range(brace,len(s)):
    if s[j]=='{': depth+=1
    elif s[j]=='}':
        depth-=1
        if depth==0: end=j+1; break
if end is None: raise SystemExit('unterminated helper')
helper=s[s.rfind('\n',0,i)+1:end].strip()+"\n  // [transaction-ui-final]\n"
for i in reversed(positions):
    brace=s.find('{',i); depth=0; end=None
    for j in range(brace,len(s)):
        if s[j]=='{': depth+=1
        elif s[j]=='}':
            depth-=1
            if depth==0: end=j+1; break
    if end is None: raise SystemExit('unterminated helper')
    s=s[:i]+s[end:]
anchor='  const getGameTransactionView = (tx: any) => {'
anchor_pos=s.find(anchor)
if anchor_pos<0: raise SystemExit('game transaction helper anchor not found')
s=s[:anchor_pos]+helper+s[anchor_pos:]
p.write_text(s)
print('transaction helper moved to component scope')
