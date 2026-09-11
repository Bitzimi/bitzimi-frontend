import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
s=s.replace('const { formatCurrencyNoDecimals } = useSettings();','const { formatCurrency, formatCurrencyNoDecimals } = useSettings();');
fs.writeFileSync(path,s);
console.log("Coin Flip result modal precision repair applied");
