import Link from "next/link";
import React from "react";

const BusinessWorkflow = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-light-primary mb-2">
          Business Workflow
        </h1>
        <p className="text-neutral-500 text-sm">
          This command center receives confirmed handoff payloads from onboarding
          and routes work to downstream agents.
        </p>
      </div>

      <div className="bg-white border border-neutral-300 rounded-xl p-6">
        <h2 className="font-serif text-xl text-light-primary mb-3">
          Onboarding Handoff Status
        </h2>
        <p className="text-sm text-neutral-600">
          If you just completed onboarding, your confirmed business direction has
          been stored and handed off to the design agent queue.
        </p>
        <p className="text-xs text-neutral-500 mt-3">Business ID: {id}</p>
        <div className="mt-5 flex gap-3 flex-wrap">
          <Link
            href={`/business/${id}/onboarding`}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
          >
            Back to Onboarding
          </Link>
          <Link
            href={`/business/${id}/products`}
            className="px-4 py-2 rounded-lg bg-dark text-light hover:bg-neutral-900 transition-colors text-sm"
          >
            Continue to Products
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BusinessWorkflow;
