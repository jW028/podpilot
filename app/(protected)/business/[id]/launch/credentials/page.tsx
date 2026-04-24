import CredentialsGuidePage from "@/components/ui/launch/CredentialsGuidePage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LaunchCredentialsRoute({ params }: Props) {
  const { id } = await params;
  return <CredentialsGuidePage businessId={id} />;
}
