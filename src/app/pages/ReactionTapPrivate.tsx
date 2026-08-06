import PrivateMatchLobby from "../components/PrivateMatchLobby";

export default function ReactionTapPrivate() {
  return (
    <PrivateMatchLobby
      gameType="reaction_tap"
      gameName="Reaction Tap"
      gamePlayPath="/game/reaction-tap/play"
      backPath="/game/reaction-tap"
    />
  );
}
