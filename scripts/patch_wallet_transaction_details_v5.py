from pathlib import Path
import re
p=Path('src/app/pages/Wallet.tsx')
s=p.read_text()
# Reuse the transaction detail helper already injected by prior patch attempts when present.
if 'const getTransactionDetailRows' not in s:
    raise SystemExit('Transaction detail helper missing')
replacement='{getTransactionDetailRows(tx, txDate).map((row: any, i: number) => (\n                              <div key={i} className="flex justify-between items-start gap-4 text-xs">\n                                <span className="text-muted-foreground shrink-0">{row.label}</span>\n                                <span className="font-medium text-right">{row.value}</span>\n                              </div>\n                            ))}'
# The main view may already be converted; only convert a remaining legacy array.
legacy=re.compile(r'\{\s*\[\s*\{\s*label:\s*"Transaction ID".*?\.filter\(Boolean\)\s*\.map\(\(row:\s*any,\s*i\)\s*=>\s*\(.*?\)\)\}',re.S)
s,n=legacy.subn(replacement,s,count=1)
print('legacy main blocks replaced:',n)
# The all-transactions dialog uses a shorter legacy array. Scope by the literal modal heading.
pos=s.find('All Transactions Modal')
if pos >= 0:
    head=s[:pos]; tail=s[pos:]
    arr=re.compile(r'\[\s*\{\s*label:\s*"Transaction ID".*?\]\s*\.filter\(Boolean\)\s*\.map\(',re.S)
    tail,n2=arr.subn('[...getTransactionDetailRows(tx, txDate)].filter(Boolean).map(',tail,count=1)
    print('modal arrays replaced:',n2)
    s=head+tail
else:
    print('modal heading not found; main history still fixed')
p.write_text(s)
