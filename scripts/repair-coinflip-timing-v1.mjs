import fs from "node:fs";
const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");
s = s.replaceAll("8000", "12000");
fs.writeFileSync(path, s);
console.log("Coin Flip frontend timeline aligned to 12 seconds");
