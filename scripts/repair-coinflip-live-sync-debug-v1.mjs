import fs from 'node:fs';
const lines=fs.readFileSync('src/app/pages/PvPCoinFlipGame.tsx','utf8').split('\n');
console.log('[CoinFlip debug] generated lines',lines.length);
for(const [a,b] of [[1,80],[81,180],[181,280],[281,380],[381,lines.length]]){console.log(`[CoinFlip debug] lines ${a}-${b}`);for(let i=a;i<=Math.min(b,lines.length);i++)console.log(`${i}: ${lines[i-1]}`);}
