"use client";

import Button from "@/components/ui/shared/Button";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

interface BusinessOnboardingPageProps {
  businessId: string;
}

interface OnboardingInput {
  businessName: string;
  vibe: string;
  targetAudience: string;
  purpose: string;
  productDirection: string;
  confidence: number;
}

interface BusinessFramework {
  niche: string;
  theme: string;
  vibeKeywords: string[];
  brandVoice: string;
  targetAudience: string;
  productLane: string;
  valueProposition: string;
  malaysiaTrendNote: string;
  risks: string[];
  next30Days: string[];
}

const defaultInput: OnboardingInput = {
  businessName: "",
  vibe: "",
  targetAudience: "",
  purpose: "",
  productDirection: "",
  confidence: 5,
};

const styles = {
  container: "max-w-4xl mx-auto",
  heading: "font-serif text-3xl font-bold text-light-primary mb-2",
  subtext: "text-neutral-500 text-sm mb-8",
  card: "bg-white border border-neutral-300 rounded-xl p-6",
  sectionTitle: "font-serif text-xl text-light-primary mb-4",
  label:
    "block text-xs uppercase tracking-wide font-medium text-neutral-500 mb-2",
  input:
    "w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary bg-light",
  textarea:
    "w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary bg-light min-h-24",
  alertError:
    "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm",
  alertSuccess:
    "mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm",
};

const BusinessOnboardingPage = ({ businessId }: BusinessOnboardingPageProps) => {
  const router = useRouter();
  const { user, session } = useAuth();

  const [input, setInput] = useState<OnboardingInput>(defaultInput);
  const [framework, setFramework] = useState<BusinessFramework | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isInputValid = useMemo(() => {
    return (
      input.businessName.trim().length > 1 &&
      input.vibe.trim().length > 2 &&
      input.targetAudience.trim().length > 2 &&
      input.purpose.trim().length > 2 &&
      input.productDirection.trim().length > 2
    );
  }, [input]);

  const handleGenerate = async () => {
    setError("");
    setSuccess("");

    if (!isInputValid) {
      setError("Please fill in all core fields before generating the framework.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/business/onboarding/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const result = (await response.json()) as {
        success: boolean;
        data?: BusinessFramework;
        message?: string;
      };

      if (!response.ok || !result.success || !result.data) {
        setError(result.message ?? "Failed to generate business framework.");
        return;
      }

      setFramework(result.data);
      setSuccess("Framework generated. Review and confirm to continue.");
    } catch (generationError) {
      console.error(generationError);
      setError("Something went wrong while generating the framework.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAndContinue = async () => {
    setError("");
    setSuccess("");

    if (!user || !session?.access_token) {
      setError("Please sign in again before confirming this onboarding step.");
      return;
    }

    if (!framework) {
      setError("Generate a framework before confirming.");
      return;
    }

    if (!confirmationMessage.trim()) {
      setError("Type your confirmation message so the agent can verify intent.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/business/onboarding/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessId,
          input,
          framework,
          confirmationMessage,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        message: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.message || "Could not confirm the business direction yet.");
        return;
      }

      setSuccess("Business direction confirmed. Redirecting to workflow...");
      router.push(result.redirectTo || `/business/${businessId}/workflow`);
    } catch (submitError) {
      console.error(submitError);
      setError("Failed to save your onboarding result.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.container}>
      <div className="mb-8">
        <h1 className={styles.heading}>Business Onboarding</h1>
        <p className={styles.subtext}>
          Define your business direction first. Design confirmation will happen in
          the Design Agent phase.
        </p>
      </div>

      {error && <div className={styles.alertError}>{error}</div>}
      {success && <div className={styles.alertSuccess}>{success}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Input</h2>

          <label htmlFor="businessName" className={styles.label}>
            Business Name
          </label>
          <input
            id="businessName"
            className={styles.input}
            placeholder="e.g. MokiPrints"
            value={input.businessName}
            onChange={(event) =>
              setInput((previous) => ({
                ...previous,
                businessName: event.target.value,
              }))
            }
          />

          <label htmlFor="vibe" className={`${styles.label} mt-4`}>
            Feeling, Theme, Vibe
          </label>
          <textarea
            id="vibe"
            className={styles.textarea}
            placeholder="e.g. minimalist, calm, modern Malaysia-inspired"
            value={input.vibe}
            onChange={(event) =>
              setInput((previous) => ({ ...previous, vibe: event.target.value }))
            }
          />

          <label htmlFor="targetAudience" className={`${styles.label} mt-4`}>
            Target Audience
          </label>
          <textarea
            id="targetAudience"
            className={styles.textarea}
            placeholder="e.g. Malaysian young adults 18-30 who prefer clean aesthetics"
            value={input.targetAudience}
            onChange={(event) =>
              setInput((previous) => ({
                ...previous,
                targetAudience: event.target.value,
              }))
            }
          />

          <label htmlFor="purpose" className={`${styles.label} mt-4`}>
            Business Purpose
          </label>
          <textarea
            id="purpose"
            className={styles.textarea}
            placeholder="e.g. side income with long-term brand potential"
            value={input.purpose}
            onChange={(event) =>
              setInput((previous) => ({
                ...previous,
                purpose: event.target.value,
              }))
            }
          />

          <label htmlFor="productDirection" className={`${styles.label} mt-4`}>
            Product Direction (No Design Yet)
          </label>
          <textarea
            id="productDirection"
            className={styles.textarea}
            placeholder="e.g. start with tees and tote bags, then move to phone cases"
            value={input.productDirection}
            onChange={(event) =>
              setInput((previous) => ({
                ...previous,
                productDirection: event.target.value,
              }))
            }
          />

          <label htmlFor="confidence" className={`${styles.label} mt-4`}>
            Current Confidence ({input.confidence}/10)
          </label>
          <input
            id="confidence"
            type="range"
            min={1}
            max={10}
            className="w-full accent-primary-500"
            value={input.confidence}
            onChange={(event) =>
              setInput((previous) => ({
                ...previous,
                confidence: Number(event.target.value),
              }))
            }
          />

          <div className="mt-6">
            <Button
              variant="primary"
              size="md"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Business Direction"}
            </Button>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Confirmed Direction</h2>

          {!framework ? (
            <p className="text-sm text-neutral-500">
              Generate the framework first. You will review it here before
              confirming.
            </p>
          ) : (
            <div className="space-y-4 text-sm text-neutral-700">
              <div>
                <p className="font-semibold text-light-primary">Niche</p>
                <p>{framework.niche}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Theme</p>
                <p>{framework.theme}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Vibe Keywords</p>
                <p>{framework.vibeKeywords.join(", ")}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Brand Voice</p>
                <p>{framework.brandVoice}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Product Lane</p>
                <p>{framework.productLane}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Malaysia Trend Note</p>
                <p>{framework.malaysiaTrendNote}</p>
              </div>
              <div>
                <p className="font-semibold text-light-primary">Next 30 Days</p>
                <ul className="list-disc ml-5 space-y-1">
                  {framework.next30Days.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-light-primary">
                  Confirmation Message
                </p>
                <textarea
                  className={styles.textarea}
                  placeholder="e.g. yes, proceed with this business direction"
                  value={confirmationMessage}
                  onChange={(event) => setConfirmationMessage(event.target.value)}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Intent-based confirmations are accepted as long as you clearly
                  indicate confidence to proceed.
                </p>
              </div>

              <Button
                variant="secondary"
                size="md"
                onClick={handleConfirmAndContinue}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Confirming..."
                  : "Confirm Direction and Go to Workflow"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BusinessOnboardingPage;
