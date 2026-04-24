import CredentialsGuidePage from "@/components/ui/launch/CredentialsGuidePage";

interface Props {
  params: Promise<{ businessId: string }>;
}

export default async function LaunchCredentialsRoute({ params }: Props) {
  const { businessId } = await params;
  return <CredentialsGuidePage businessId={businessId} />;
}
