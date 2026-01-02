import TorneioLobbyClient from "./_components/TorneioLobbyClient";

export default function Page({ params }: { params: { instanceId: string } }) {
  return <TorneioLobbyClient instanceId={params.instanceId} />;
}
