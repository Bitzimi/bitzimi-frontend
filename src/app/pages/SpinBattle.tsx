import { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
import { useIdentity } from "../contexts/IdentityContext";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { fairnessService } from "../services/gameMatchmakingService";
import SpinBattleGameplay from "../components/SpinBattleGameplay";

type BackendPhase = "waiting" | "countdown" | "locked" | "spinning" | "result" | "completed";

interface BackendPlayer { userId:string; username:string; index:number; avatar?:string|null; betAmount:number; color:string; segmentStart:number; segmentEnd:number; probability:number; }
interface BackendWinner { roundNumber:number; winnerId:string|null; winnerUsername:string|null; winnerPayout:number; timestamp:string; avatar?:string|null; }
interface LobbyState {
  lobbyId:string; roundId:string; roundNumber:number; phase:BackendPhase; playerCount:number; maxPlayers:number;
  minBet:number; maxBet:number; totalPool:number; timeRemaining:number|null; winnerId:string|null; winnerUsername:string|null;
  winnerPayout:number|null; canJoin:boolean; players:BackendPlayer[]; myBet:{inRound:boolean;amount:number|null}|null;
  recentWinners:BackendWinner[];
  history?:Array<{id?:string;roundNumber:number;lobbyId:string|null;betAmount:number;won:boolean|null;payout:number;timestamp:number}>;
  verificationId?:string|null; serverSeedHash?:string|null;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
const LOBBY_RANGES:Record<string,{min:number;max:number}>={A:{min:1,max:20},B:{min:21,max:50},C:{min:51,max:120},D:{min:121,max:500}};
const VALID_LOBBIES = new Set(["A","B","C","D"]);

function getToken(){ return localStorage.getItem("bitzimi_access_token"); }

export default function SpinBattle(){
 const navigate=useNavigate();
 const [searchParams,setSearchParams]=useSearchParams();
 const {formatCurrencyNoDecimals}=useSettings();
 const {balances,refreshWalletsFromBackend}=useWallet();
 const {addGameResult}=useGameStats();
 const {addNotification}=useNotifications();
 const {identity}=useIdentity();
 const myUsername=identity.username;
 const initialLobby=searchParams.get("lobby");
 const [selectedLobby,setSelectedLobby]=useState<string|null>(initialLobby&&VALID_LOBBIES.has(initialLobby)?initialLobby:null);
 const [allLobbies,setAllLobbies]=useState<Record<string,Partial<LobbyState>>>({});
 const [betAmount,setBetAmount]=useState("");
 const [lobbyState,setLobbyState]=useState<LobbyState|null>(null);
 const [joining,setJoining]=useState(false);
 const [connectionError,setConnectionError]=useState(false);
 const processedRound=useRef<number|null>(null);
 const prevPhase=useRef<BackendPhase|null>(null);
 const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);
 const lobbiesPollRef=useRef<ReturnType<typeof setInterval>|null>(null);
 const inFlight=useRef(false);
 const mounted=useRef(true);

 useEffect(()=>()=>{mounted.current=false;if(pollRef.current)clearInterval(pollRef.current);if(lobbiesPollRef.current)clearInterval(lobbiesPollRef.current);},[]);

 // URL is the durable source for the selected lobby. Refreshing the page therefore
 // restores the same lobby instead of returning to the lobby selector.
 useEffect(()=>{
   const urlLobby=searchParams.get("lobby");
   if(urlLobby&&VALID_LOBBIES.has(urlLobby)){setSelectedLobby(current=>current===urlLobby?current:urlLobby);}
 },[searchParams]);

 const selectLobby=(lobbyId:string)=>{
   setLobbyState(null);setConnectionError(false);setBetAmount(String(LOBBY_RANGES[lobbyId]?.min??1));
   setSelectedLobby(lobbyId);setSearchParams({lobby:lobbyId});
 };
 const leaveLobby=()=>{if(pollRef.current)clearInterval(pollRef.current);setLobbyState(null);setConnectionError(false);setSelectedLobby(null);setSearchParams({});};

 // Selector data. Keep this lightweight and never allow a slow request to block navigation.
 useEffect(()=>{
   if(!API_BASE||!getToken()||selectedLobby)return;
   let cancelled=false;
   const poll=async()=>{try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);const res=await fetch(`${API_BASE}/api/v1/games/spin/lobbies`,{headers:{Authorization:`Bearer ${getToken()}`},signal:controller.signal});clearTimeout(timer);if(!cancelled&&res.ok){const json=await res.json();setAllLobbies(json.data??{});}}catch{} };
   poll();lobbiesPollRef.current=setInterval(poll,3000);return()=>{cancelled=true;if(lobbiesPollRef.current)clearInterval(lobbiesPollRef.current);};
 },[selectedLobby]);

 const handleLobbySnapshot=useCallback((data:LobbyState)=>{
   if(!mounted.current)return;
   setLobbyState(data);setConnectionError(false);
   if(Array.isArray(data.history)){
     // Keep the parent history scoped as well; Gameplay applies a second defensive filter.
     (data as any).history=data.history.filter(h=>!h.lobbyId||h.lobbyId===data.lobbyId);
   }
   if(data.phase==="waiting"&&data.roundNumber!==processedRound.current){ }
   if(data.phase==="result"&&data.winnerId&&processedRound.current!==data.roundNumber){
     processedRound.current=data.roundNumber;
     if(data.roundId)fairnessService.getRoundFairness(data.roundId).catch(()=>{});
     refreshWalletsFromBackend().catch(()=>{});
     const inRound=data.myBet?.inRound??false;const iWon=inRound&&data.winnerId===identity.userId;const myBet=data.myBet?.amount??0;const payout=data.winnerPayout??0;
     if(inRound){
       addGameResult({gameType:"spin_battle",betAmount:myBet,winAmount:iWon?payout:0,profit:iWon?payout-myBet:-myBet,won:iWon});
       if(iWon){addNotification("game_win","🎉 Spin Battle Won!",`Won ${formatCurrencyNoDecimals(payout)} in Lobby ${data.lobbyId}`,{game:"spin_battle",lobby:data.lobbyId,amount:payout,roundNumber:data.roundNumber});liveActivityService.addActivity("game_win",myUsername,"won in Spin Battle",payout);toast.success(`🎉 ${myUsername} won ${formatCurrencyNoDecimals(payout)}!`,{duration:5000});}
       else {addNotification("game_loss","Spin Battle Lost",`Lost ${formatCurrencyNoDecimals(myBet)} in Lobby ${data.lobbyId}`,{game:"spin_battle",lobby:data.lobbyId,amount:myBet,roundNumber:data.roundNumber});toast.info(`${data.winnerUsername??"Someone"} won ${formatCurrencyNoDecimals(payout)}`);}
     }
   }
   prevPhase.current=data.phase;
 },[identity.userId,myUsername,formatCurrencyNoDecimals,refreshWalletsFromBackend,addGameResult,addNotification]);

 const fetchLobby=useCallback(async()=>{
   if(!selectedLobby||!API_BASE||!getToken()||inFlight.current)return;
   inFlight.current=true;
   try{
     const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
     const res=await fetch(`${API_BASE}/api/v1/games/spin/lobbies/${selectedLobby}`,{headers:{Authorization:`Bearer ${getToken()}`},signal:controller.signal});
     clearTimeout(timer);
     if(!res.ok){if(mounted.current&&!lobbyState)setConnectionError(true);return;}
     const json=await res.json();handleLobbySnapshot(json.data as LobbyState);
   }catch{if(mounted.current&&!lobbyState)setConnectionError(true);}finally{inFlight.current=false;}
 },[selectedLobby,handleLobbySnapshot,lobbyState]);

 useEffect(()=>{
   if(!selectedLobby||!API_BASE||!getToken())return;
   setLobbyState(null);setConnectionError(false);inFlight.current=false;
   fetchLobby();
   pollRef.current=setInterval(fetchLobby,1000);
   return()=>{if(pollRef.current)clearInterval(pollRef.current);pollRef.current=null;};
 },[selectedLobby]); // eslint-disable-line react-hooks/exhaustive-deps

 const handleJoin=useCallback(async()=>{
   if(!selectedLobby||!API_BASE||!getToken()||joining)return;
   const range=LOBBY_RANGES[selectedLobby];const bet=parseFloat(betAmount)||range?.min||1;
   if(range&&(bet<range.min||bet>range.max)){toast.error(`Bet must be $${range.min}–$${range.max} for Lobby ${selectedLobby}`);return;}
   if(balances.game<bet){toast.error(`Insufficient balance. Need ${formatCurrencyNoDecimals(bet)}`);return;}
   setJoining(true);
   try{
     const res=await fetch(`${API_BASE}/api/v1/games/spin/lobbies/${selectedLobby}/join`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({amount:bet})});
     if(!res.ok){const err=await res.json().catch(()=>({}));toast.error((err as any)?.error?.message??"Failed to join round");return;}
     await refreshWalletsFromBackend().catch(()=>{});toast.success(`Joined Round #${lobbyState?.roundNumber??"—"} with ${formatCurrencyNoDecimals(bet)}!`);await fetchLobby();
   }catch{toast.error("Network error. Please try again.");}finally{setJoining(false);}
 },[selectedLobby,betAmount,joining,balances.game,formatCurrencyNoDecimals,lobbyState,refreshWalletsFromBackend,fetchLobby]);

 if(!selectedLobby){
  return <ResponsiveLayout><div className="max-w-4xl mx-auto space-y-6 pb-8"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={()=>navigate("/games")} className="hover:bg-gray-200 dark:hover:bg-gray-800"><ArrowLeft className="h-4 w-4"/></Button><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spin Battle</h1><p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Choose a lobby to join</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{(["A","B","C","D"] as const).map(lobbyId=>{const range=LOBBY_RANGES[lobbyId];const info=allLobbies[lobbyId];const playerCount=info?.playerCount??0;const phase=info?.phase??"waiting";return <Card key={lobbyId} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/90 dark:to-gray-800/90 border border-gray-200 dark:border-gray-700/50 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm" onClick={()=>selectLobby(lobbyId)}><CardContent className="p-8"><div className="text-center space-y-4"><div className="flex justify-center"><div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform"><span className="text-4xl font-bold text-blue-500 dark:text-blue-400">{lobbyId}</span></div></div><div><h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Lobby {lobbyId}</h3><p className="text-sm text-gray-600 dark:text-gray-400">Max 12 players per round</p></div><div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700/50"><div className="flex items-center justify-center gap-2"><Users className="h-4 w-4 text-blue-600 dark:text-blue-400"/><span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{playerCount} {playerCount===1?"player":"players"} in round</span></div>{phase!=="waiting"&&<p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 capitalize">{phase}</p>}</div><div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700/50"><p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Bet Range</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(range.min)} – {formatCurrencyNoDecimals(range.max)}</p></div><Button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold">Join Lobby {lobbyId}</Button></div></CardContent></Card>;})}</div></div></ResponsiveLayout>;
 }

 if(!lobbyState){
  return <ResponsiveLayout><div className="flex items-center justify-center min-h-64"><div className="text-center"><Loader2 className="h-12 w-12 text-blue-400 mx-auto mb-3 animate-spin"/><p className="text-gray-600 dark:text-gray-400">{connectionError?`Unable to connect to Lobby ${selectedLobby}`:`Connecting to lobby ${selectedLobby}...`}</p>{connectionError&&<div className="mt-4 flex items-center justify-center gap-2"><Button size="sm" onClick={()=>{setConnectionError(false);fetchLobby();}}>Retry</Button><Button size="sm" variant="outline" onClick={leaveLobby}>Back to Lobbies</Button></div>}</div></div></ResponsiveLayout>;
 }

 return <ResponsiveLayout><SpinBattleGameplay lobbyState={lobbyState} selectedLobby={selectedLobby} betAmount={betAmount} setBetAmount={setBetAmount} joining={joining} onJoin={handleJoin} onBack={leaveLobby} balances={balances} identity={identity} userHistory={(lobbyState.history??[]).filter(h=>!h.lobbyId||h.lobbyId===selectedLobby)}/></ResponsiveLayout>;
}
