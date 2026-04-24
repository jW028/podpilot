import Link from "next/link";
import { FiArrowLeft, FiCheckSquare, FiExternalLink } from "react-icons/fi";

interface CredentialsGuidePageProps {
  businessId: string;
}

const CredentialsGuidePage = ({ businessId }: CredentialsGuidePageProps) => {
  return (
    <section className="max-w-4xl mx-auto space-y-6 p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-dark">
            Launch Credentials Guide
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Use this setup checklist before running Launch Agent.
          </p>
        </div>
        <Link
          href={`/business/${businessId}/launch`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-light transition-colors text-sm"
        >
          <FiArrowLeft size={14} />
          Back to Launch
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-300 bg-white p-5 space-y-6">
        <div>
          <h2 className="font-serif text-xl text-dark mb-2">
            Step 1: Create Printify API Token
          </h2>
          <p className="text-sm text-neutral-600">
            In Printify dashboard, open <strong>My Profile</strong> →{" "}
            <strong>Connections</strong> and create a Personal Access Token with
            upload/product scopes.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-xl text-dark mb-2">
            Step 2: Get Your Shop ID
          </h2>
          <p className="text-sm text-neutral-600">
            Fetch your shops using the Printify API and copy the numeric shop ID
            for the business.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-xl text-dark mb-2">
            Step 3: Configure Required Env Keys
          </h2>
          <pre className="text-xs bg-light-secondary border border-neutral-300 rounded-lg p-3 overflow-auto text-dark">
            {`PRINTIFY_DEV_TOKEN=...
PRINTIFY_SHOP_ID=...
PRINTIFY_PLACEHOLDER_IMAGE=assets/printify-placeholders/images.png
# Optional override when already uploaded:
# PRINTIFY_IMAGE_ID=...

TAVILY_API_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash`}
          </pre>
        </div>

        <div>
          <h2 className="font-serif text-xl text-dark mb-2">
            Step 4: Add Placeholder Image
          </h2>
          <p className="text-sm text-neutral-600">
            Place your launch artwork in{" "}
            <code>assets/printify-placeholders</code>. By default the launch
            flow reads <code>images.png</code> unless{" "}
            <code>PRINTIFY_PLACEHOLDER_IMAGE</code> is set.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-xl text-dark mb-3">
            Step 5: Pre-Launch Checklist
          </h2>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="inline-flex items-start gap-2">
              <FiCheckSquare className="mt-0.5 text-primary-700 shrink-0" />
              Printify token is active and has product/upload permissions.
            </li>
            <li className="inline-flex items-start gap-2">
              <FiCheckSquare className="mt-0.5 text-primary-700 shrink-0" />
              Shop ID is correct for the business you are launching from.
            </li>
            <li className="inline-flex items-start gap-2">
              <FiCheckSquare className="mt-0.5 text-primary-700 shrink-0" />
              Placeholder image exists at the configured path.
            </li>
            <li className="inline-flex items-start gap-2">
              <FiCheckSquare className="mt-0.5 text-primary-700 shrink-0" />
              Tavily and model keys are set so market research and pricing can
              run.
            </li>
          </ul>
        </div>
      </div>

      <a
        href="https://developers.printify.com/#products"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800"
      >
        Printify API documentation
        <FiExternalLink size={14} />
      </a>
    </section>
  );
};

export default CredentialsGuidePage;
