import ChannelSetupPage from "@/components/ui/launch/ChannelSetupPage";

interface Props {
  params: Promise<{ businessId: string }>;
}

export default async function LaunchChannelsRoute({ params }: Props) {
  const { businessId } = await params;
  return <ChannelSetupPage businessId={businessId} />;
}
