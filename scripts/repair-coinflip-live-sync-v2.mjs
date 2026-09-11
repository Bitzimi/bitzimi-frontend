import fs from 'node:fs';
const path='src/app/pages/PvPCoinFlipGame.tsx';
let s=fs.readFileSync(path,'utf8');
// v1 intentionally injects several small replacement blocks. Normalize only the
// literal backslash-n sequences it introduced before Vite parses the component.
s=s.replaceAll('\\n','\n');
fs.writeFileSync(path,s);
console.log('Coin Flip live-sync generated source normalized');
