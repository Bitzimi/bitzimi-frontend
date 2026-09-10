import fs from "node:fs";
const path = "src/app/services/gameMatchmakingService.ts";
let s = fs.readFileSync(path, "utf8");
const marker = ' async getMatch(matchId:string):Promise<MatchResult>{return apiFetch(`/api/v1/games/matches/${matchId}`);},';
const addition = ' async recoverCoinFlipQueue(stake:number):Promise<any>{return apiFetch(`/api/v1/games/queue/recover?gameType=pvp_coinflip&stake=${encodeURIComponent(stake)}`);},\n async getCoinFlipHistory(stake:number):Promise<any[]>{return apiFetch(`/api/v1/games/coinflip/history?stake=${encodeURIComponent(stake)}`);},';
if(!s.includes(marker)) throw new Error("Coin Flip service insertion marker not found");
if(!s.includes("recoverCoinFlipQueue")) s=s.replace(marker, addition+marker);
fs.writeFileSync(path,s);
console.log("Coin Flip service recovery/history methods added");
