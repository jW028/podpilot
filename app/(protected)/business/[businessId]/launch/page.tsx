import LaunchPage from "@/components/ui/launch/LaunchPage";

interface Props {
  params: Promise<{ businessId: string }>;
}

export default async function BusinessLaunchRoute({ params }: Props) {
  const { businessId } = await params;
  return <LaunchPage businessId={businessId} />;
}
