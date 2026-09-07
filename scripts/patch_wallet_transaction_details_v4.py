from pathlib import Path
import re

p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()

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

block=re.compile(r'\{\s*\[\s*\{\s*label:\s*"Transaction ID".*?\.filter\(Boolean\)\s*\.map\(\(row:\s*any,\s*i\)\s*=>\s*\(.*?\)\)\}',re.S)
replacement='{getTransactionDetailRows(tx, txDate).map((row: any, i: number) => (\n                              <div key={i} className="flex justify-between items-start gap-4 text-xs">\n                                <span className="text-muted-foreground shrink-0">{row.label}</span>\n                                <span className="font-medium text-right">{row.value}</span>\n                              </div>\n                            ))}'
s,n=block.subn(replacement,s,count=1)
print('active detail blocks replaced:',n)
if n > 1: raise SystemExit(f'Unexpected active detail blocks: {n}')
modal=s.find('{/* All Transactions Modal */}')
if modal >= 0:
    head=s[:modal]; tail=s[modal:]
    tail,n2=block.subn(replacement,tail,count=1)
    print('modal detail blocks replaced:',n2)
    if n2 > 1: raise SystemExit(f'Unexpected modal detail blocks: {n2}')
    if n2 == 1: s=head+tail

p.write_text(s)
