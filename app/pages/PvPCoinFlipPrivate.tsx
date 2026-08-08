import PrivateMatchLobby from "../components/PrivateMatchLobby";

export default function PvPCoinFlipPrivate() {
  return (
    <PrivateMatchLobby
      gameType="pvp_coinflip"
      gameName="Coin Flip"
      gamePlayPath="/game/pvp-coinflip/play"
      backPath="/game/pvp-coinflip"
    />
  );
}
