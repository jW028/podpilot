import ChannelSetupPage from "@/components/ui/launch/ChannelSetupPage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LaunchChannelsRoute({ params }: Props) {
  const { id } = await params;
  return <ChannelSetupPage businessId={id} />;
}
