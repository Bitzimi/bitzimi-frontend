import PrivateMatchLobby from "../components/PrivateMatchLobby";

export default function DiceClashPrivate() {
  return (
    <PrivateMatchLobby
      gameType="dice_clash"
      gameName="Dice Clash"
      gamePlayPath="/dice-duel/clash/game"
      backPath="/dice-duel/clash"
    />
  );
}
