import CommandCenter from "@/components/ui/workflow/CommandCenter";

const BusinessWorkflow = async ({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) => {
  const { businessId } = await params;

  return (
    <section className="space-y-6 p-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#141412] mb-1">
            AI Command Center
          </h1>
          <p className="text-neutral-500 text-sm">
            Orchestrate agents · Monitor workflows · /business/{businessId}
            /workflow
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#F4F3EF] px-3 py-1.5 rounded-md border border-[#E8E7E2]">
          <div className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-pulse" />
          <span className="text-xs font-medium text-neutral-600">Live</span>
        </div>
      </div>

      <CommandCenter businessId={businessId} />
    </section>
  );
};

export default BusinessWorkflow;
