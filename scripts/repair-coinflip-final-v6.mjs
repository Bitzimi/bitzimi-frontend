import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const duplicate='  const handleNewSearch = () => {forceSearchRef.current=true;startSearch();};\n';
s=s.replace(duplicate,"");
fs.writeFileSync(path,s);
console.log("Coin Flip duplicate handler cleanup applied");
