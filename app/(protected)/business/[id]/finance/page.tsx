import FinancePage from "@/components/ui/finance/FinancePage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FinanceRoute({ params }: Props) {
  const { id } = await params;
  return <FinancePage businessId={id} />;
}
