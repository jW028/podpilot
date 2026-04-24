import LaunchPage from "@/components/ui/launch/LaunchPage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BusinessLaunchRoute({ params }: Props) {
  const { id } = await params;
  return <LaunchPage businessId={id} />;
}
