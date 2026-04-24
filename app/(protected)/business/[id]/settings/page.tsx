import PrintifySettingsPanel from "@/components/ui/settings/PrintifySettingsPanel";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BusinessSettings({ params }: Props) {
  const { id } = await params;
  return <PrintifySettingsPanel businessId={id} />;
}
