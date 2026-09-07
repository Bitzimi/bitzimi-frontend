from pathlib import Path
p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()
sig='  const getTransactionDetailRows = (tx: any, txDate: Date) => {'
pos=[]; start=0
while True:
    i=s.find(sig,start)
    if i<0: break
    pos.append(i); start=i+len(sig)
if not pos: raise SystemExit('transaction detail helper not found')
i=pos[0]; brace=s.find('{',i); depth=0; end=None
for j in range(brace,len(s)):
    if s[j]=='{': depth+=1
    elif s[j]=='}':
        depth-=1
        if depth==0: end=j+1; break
if end is None: raise SystemExit('unterminated helper')
helper=s[i:end].strip()+"\n  // [transaction-ui-final]\n"
for i in reversed(pos):
    brace=s.find('{',i); depth=0; end=None
    for j in range(brace,len(s)):
        if s[j]=='{': depth+=1
        elif s[j]=='}':
            depth-=1
            if depth==0: end=j+1; break
    if end is None: raise SystemExit('unterminated helper')
    if s[end:end+28].startswith('\n  // [transaction-ui-final]'): end += len('\n  // [transaction-ui-final]')
    s=s[:i]+s[end:]
anchor='  const getGameTransactionView = (tx: any) => {'
pos=s.find(anchor)
if pos<0: raise SystemExit('game transaction helper anchor not found')
s=s[:pos]+helper+s[pos:]
p.write_text(s)
print(f'repaired {len(pos)} helper declaration(s)')
