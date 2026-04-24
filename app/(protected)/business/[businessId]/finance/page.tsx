import FinancePage from "@/components/ui/finance/FinancePage";

interface Props {
  params: Promise<{ businessId: string }>;
}

export default async function FinanceRoute({ params }: Props) {
  const { businessId } = await params;
  return <FinancePage businessId={businessId} />;
}
