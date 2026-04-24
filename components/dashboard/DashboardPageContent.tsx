"use client";

import React, { useEffect, useState } from "react";
import StatCard from "./StatCard";
import BusinessCard from "./BusinessCard";
import Button from "@/components/ui/shared/Button";
import DashboardHeader from "./DashboardHeader";
import LoadingState from "../ui/shared/LoadingState";
import { Plus } from "lucide-react";

interface Business {
  id: string;
  name: string;
  niche?: string;
  status: string;
  created_at: string;
  updated_at: string;
  marketplace?: string;
}

interface BusinessWithMetrics extends Business {
  revenue?: number;
  products?: number;
  agentStatus?: {
    status: string;
    icon: string;
  };
  onboardingProgress?: {
    current: number;
    total: number;
  };
}

interface DashboardPageContentProps {
  activeCount?: number;
}

const DashboardPageContent = ({ activeCount }: DashboardPageContentProps) => {
  const [businesses, setBusinesses] = useState<BusinessWithMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessNiche, setNewBusinessNiche] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/businesses");

        if (!response.ok) {
          throw new Error("Failed to fetch businesses");
        }

        const data = await response.json();

        // Enrich with mock metrics (in real app, this would come from your metrics endpoints)
        const enrichedBusinesses = data.map(
          (business: Business, index: number) => ({
            ...business,
            revenue:
              [4280, 5110, 0][index] || Math.floor(Math.random() * 10000),
            products: [23, 18, 0][index] || Math.floor(Math.random() * 50),
            agentStatus:
              index === 0
                ? { status: "Product Agent running", icon: "running" }
                : index === 1
                  ? { status: "All agents idle", icon: "idle" }
                  : undefined,
            onboardingProgress:
              index === 2 ? { current: 3, total: 5 } : undefined,
          }),
        );

        setBusinesses(enrichedBusinesses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setBusinesses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBusinessName.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBusinessName,
          niche: newBusinessNiche || null,
          status: "draft",
          marketplace: "etsy",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create business");
      }

      const newBusiness = await response.json();
      setBusinesses((prev) => [
        {
          ...newBusiness,
          revenue: 0,
          products: 0,
          onboardingProgress: { current: 1, total: 5 },
        },
        ...prev,
      ]);

      setNewBusinessName("");
      setNewBusinessNiche("");
      setShowCreateForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create business",
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Calculate totals for stat cards
  const totalRevenue = businesses.reduce((sum, b) => sum + (b.revenue || 0), 0);
  const totalProducts = businesses.reduce(
    (sum, b) => sum + (b.products || 0),
    0,
  );
  const activeBusinesses = businesses.filter(
    (b) => b.status === "active",
  ).length;

  return (
    <div className="min-h-screen bg-light-secondary">
      <DashboardHeader
        businessCount={activeCount}
        onCreateClick={() => setShowCreateForm(!showCreateForm)}
      />

      <main className="p-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            title="Total Revenue"
            value={`RM ${(totalRevenue / 1000).toFixed(1)}k`}
            change={{ value: "18%", trend: "up", label: "this month" }}
          />
          <StatCard
            title="Active Products"
            value={totalProducts}
            change={{ value: "6", trend: "up", label: "this week" }}
          />
          <StatCard
            title="AI Tasks Run"
            value="312"
            change={{ value: "42", trend: "up", label: "today" }}
          />
          <StatCard
            title="Open Tickets"
            value={businesses.length > 0 ? "8" : "0"}
            change={{ value: "3", trend: "down", label: "unresolved" }}
          />
        </div>

        {/* Active Businesses Section */}
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-bold text-dark mb-6">
            Active Businesses
          </h2>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingState message="Loading businesses..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Create New Business Card */}
              <div
                className="bg-white border border-dashed border-neutral-300 rounded-lg p-6 flex flex-col items-center justify-center min-h-80 hover:bg-light-secondary transition-colors cursor-pointer"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus className="h-8 w-8 text-neutral-400 mb-3" />
                <h3 className="font-serif text-lg font-bold text-dark mb-2">
                  Create new business
                </h3>
                <p className="text-sm text-neutral-500 text-center">
                  AI will guide you through setup
                </p>
              </div>

              {/* Business Cards */}
              {businesses.map((business) => (
                <BusinessCard
                  key={business.id}
                  id={business.id}
                  name={business.name}
                  niche={business.niche}
                  status={business.status}
                  revenue={business.revenue}
                  products={business.products}
                  marketplace={business.marketplace}
                  agentStatus={business.agentStatus}
                  onboardingProgress={business.onboardingProgress}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create Business Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="font-serif text-2xl font-bold text-dark mb-6">
                Create New Business
              </h2>

              <form onSubmit={handleCreateBusiness} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="e.g., MokiPrints"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    Niche
                  </label>
                  <input
                    type="text"
                    value={newBusinessNiche}
                    onChange={(e) => setNewBusinessNiche(e.target.value)}
                    placeholder="e.g., Minimalist lifestyle apparel"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isCreating}
                    className="flex-1"
                  >
                    {isCreating ? "Creating..." : "Create Business"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPageContent;
