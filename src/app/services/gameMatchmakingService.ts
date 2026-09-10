const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
function getAuthHeader(): Record<string,string>{const token=localStorage.getItem("bitzimi_access_token");return token?{Authorization:`Bearer ${token}`}:{ };}
async function apiFetch<T>(path:string,options?:RequestInit):Promise<T>{const res=await fetch(`${API_BASE}${path}`,{...options,headers:{"Content-Type":"application/json",...getAuthHeader(),...(options?.headers??{})}});const json=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(json?.error?.message??"API error"),{code:json?.error?.code,status:res.status});return json.data as T;}

export type MatchGameType="dice_clash"|"pvp_coinflip"|"reaction_tap";
export interface QueueResult{status:"waiting"|"matched"|"cancelled";queueId?:string;matchId?:string;}
export interface GameConfig{gameType:string;feeRate:number;feePercent:number;stakes:number[];}
export interface PrivateRoom{id:string;code:string;gameType:string;stake:number;hostId:string;guestId:string|null;status:"waiting"|"ready"|"active"|"rematch"|"completed"|"cancelled";currentMatchId:string|null;rematchHostReady:boolean;rematchGuestReady:boolean;createdAt:string;expiresAt:string;host:{id:string;profile:{username:string;avatarUrl:string|null}|null};guest:{id:string;profile:{username:string;avatarUrl:string|null}|null}|null;}
export interface MatchResult{matchId:string;gameType:string;stake:number;totalPool:number;platformFee:number;status:"active"|"settled"|"cancelled";opponent:{username:string;userId:string;avatar?:string|null};result:Record<string,any>|null;winnerId:string|null;youWon:boolean;payout:number;createdAt:string;settledAt:string|null;signalSentAt:string|null;yourReady:boolean;opponentReady:boolean;serverNow?:string;animationStartAt?:string;animationDurationMs?:number;}
export interface CoinFlipRecovery{status:"waiting"|"matched"|"cancelled";queueId?:string;matchId?:string;stake?:number;matchStatus?:"active"|"settled"|"cancelled";}
export interface CoinFlipHistoryRecord{matchId:string;stake:number;totalPool:number;platformFee:number;result:"heads"|"tails"|null;youWon:boolean;payout:number;opponent:{username:string;userId:string;avatar?:string|null};createdAt:string;settledAt:string|null;}

let lastQueueContext:{gameType:MatchGameType;stake:number;queueId:string}|null=null;
const recoveredQueueIds=new Map<string,string>();

export const gameMatchmakingService={
 async joinQueue(gameType:MatchGameType,stake:number):Promise<QueueResult>{const result=await apiFetch<QueueResult>("/api/v1/games/queue",{method:"POST",body:JSON.stringify({gameType,stake})});if(result.queueId)lastQueueContext={gameType,stake,queueId:result.queueId};return result;},
 async recoverCoinFlipQueue(stake:number):Promise<CoinFlipRecovery>{return apiFetch(`/api/v1/games/queue/recover?gameType=pvp_coinflip&stake=${encodeURIComponent(stake)}`);},
 async getCoinFlipHistory(stake?:number):Promise<CoinFlipHistoryRecord[]>{return apiFetch(`/api/v1/games/coinflip/history${stake!==undefined?`?stake=${encodeURIComponent(stake)}`:""}`);},
 async pollQueue(queueId:string):Promise<QueueResult>{const effectiveQueueId=recoveredQueueIds.get(queueId)??queueId;try{const result=await apiFetch<QueueResult>(`/api/v1/games/queue/${effectiveQueueId}`);if(result.status==="cancelled"&&lastQueueContext){const replacement=await this.joinQueue(lastQueueContext.gameType,lastQueueContext.stake);if(replacement.queueId)recoveredQueueIds.set(queueId,replacement.queueId);return replacement;}if(result.status==="matched"&&result.matchId){lastQueueContext=null;recoveredQueueIds.delete(queueId);}return result;}catch(error:any){if(error?.status===404&&lastQueueContext){const replacement=await this.joinQueue(lastQueueContext.gameType,lastQueueContext.stake);if(replacement.queueId)recoveredQueueIds.set(queueId,replacement.queueId);return replacement;}throw error;}},
 async leaveQueue(queueId:string):Promise<void>{const effectiveQueueId=recoveredQueueIds.get(queueId)??queueId;await apiFetch(`/api/v1/games/queue/${effectiveQueueId}`,{method:"DELETE"});recoveredQueueIds.delete(queueId);if(lastQueueContext?.queueId===effectiveQueueId)lastQueueContext=null;},
 async getMatch(matchId:string):Promise<MatchResult>{return apiFetch(`/api/v1/games/matches/${matchId}`);},
 async getGameConfig(gameType:string):Promise<GameConfig>{return apiFetch(`/api/v1/games/config/${encodeURIComponent(gameType)}`);},
 async signalReady(matchId:string):Promise<{signalSentAt?:string;delayMs?:number;waiting?:boolean}>{return apiFetch(`/api/v1/games/matches/${matchId}/ready`,{method:"POST",body:"{}"});},
 async submitTap(matchId:string,tapMs:number):Promise<{submitted:boolean}>{return apiFetch(`/api/v1/games/matches/${matchId}/tap`,{method:"POST",body:JSON.stringify({tapMs})});},
 async createRoom(gameType:MatchGameType,stake:number):Promise<PrivateRoom>{return apiFetch("/api/v1/games/private-rooms",{method:"POST",body:JSON.stringify({gameType,stake})});},
 async getRoom(code:string):Promise<PrivateRoom>{return apiFetch(`/api/v1/games/private-rooms/${code}`);},
 async joinRoom(code:string):Promise<PrivateRoom>{return apiFetch(`/api/v1/games/private-rooms/${code}/join`,{method:"POST",body:"{}"});},
 async startMatch(code:string):Promise<{matchId:string;room:PrivateRoom}>{return apiFetch(`/api/v1/games/private-rooms/${code}/start`,{method:"POST",body:"{}"});},
 async signalRematch(code:string):Promise<{status:"started"|"waiting";matchId:string|null;room:PrivateRoom}>{return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`,{method:"POST",body:"{}"});},
 async declineRematch(code:string):Promise<PrivateRoom>{return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`,{method:"DELETE"});},
 async getMyActiveRoom():Promise<PrivateRoom|null>{return apiFetch("/api/v1/games/private-rooms/my/active");},
 async cancelRoom(code:string):Promise<void>{await apiFetch(`/api/v1/games/private-rooms/${code}`,{method:"DELETE"});},
};

export interface DiceRoundInfo{roundId:string;roundNumber:number;stake:number;status:string;playerCount:number;maxPlayers:number;canJoin:boolean;timeRemaining:number|null;resultData:Record<string,any>|null;verificationId?:string|null;serverSeedHash?:string;}
export const diceRoyaleService={
 async getRound(stake:number):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-royale/rounds?stake=${stake}`);},
 async pollRound(roundId:string):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}`);},
 async joinRound(roundId:string,stake:number):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/join`,{method:"POST",body:JSON.stringify({stake})});},
 async leaveRound(roundId:string):Promise<void>{await apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/leave`,{method:"DELETE"});},
};
export const diceArenaService={
 async getRound(stake:number):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-arena/rounds?stake=${stake}`);},
 async pollRound(roundId:string):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}`);},
 async joinRound(roundId:string,stake:number):Promise<DiceRoundInfo>{return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}/join`,{method:"POST",body:JSON.stringify({stake})});},
};

export interface FairnessData{verificationId:string|null;serverSeed:string|null;clientSeed:string|null;nonce:number|null;serverSeedHash:string;settled:boolean;verification:any|null;}
export const fairnessService={
 async getRoundFairness(roundId:string):Promise<FairnessData>{return apiFetch(`/api/v1/games/fairness/round/${roundId}`);},
 async getDiceRoundFairness(roundId:string):Promise<FairnessData>{return apiFetch(`/api/v1/games/fairness/dice-round/${roundId}`);},
 async getMatchFairness(matchId:string):Promise<FairnessData>{return apiFetch(`/api/v1/games/fairness/match/${matchId}`);},
};
