"use client";
import React from "react";
import Link from "next/link";

const agents = [
  {
    initials: "BP",
    title: "Business Prompting Agent",
    desc: "Turns your idea into a real business with brand, niche, and strategy.",
  },
  {
    initials: "DS",
    title: "Design Agent",
    desc: "Generates product designs or outsources to designers automatically.",
  },
  {
    initials: "LA",
    title: "Launch Agent",
    desc: "Handles pricing, market research, and publishes to Printify.",
  },
  {
    initials: "CS",
    title: "Customer Service Agent",
    desc: "Responds to inquiries and resolves complaints 24/7.",
  },
  {
    initials: "FN",
    title: "Finance Agent",
    desc: "Tracks profit, margin, and sends strategic recommendations.",
  },
];

const LandingPage = () => {
  return (
    <main className="w-full">
      {/* Hero */}
      <section className="flex min-h-screen items-center px-16 gap-12 bg-neutral-50">
        <div className="flex-1 max-w-xl">
          <p className="text-primary-500 uppercase tracking-widest text-xs font-medium mb-6">
            AI-Powered Print-On-Demand
          </p>
          <h1 className="font-serif text-neutral-900 text-6xl font-normal leading-tight">
            Run your store
            <br />
            on <span className="italic text-primary-500">autopilot.</span>
          </h1>
          <p className="text-neutral-500 text-base leading-relaxed mt-6">
            Podilot orchestrates intelligent agents that handle product
            creation, publishing, customer support, and analytics — all from a
            single AI command center.
          </p>
          <div className="flex gap-4 mt-8">
            <Link
              href="/register"
              className="bg-neutral-900 text-white hover:bg-neutral-700 rounded-full px-6 py-3 text-sm font-medium transition"
            >
              Start for free →
            </Link>
            <Link
              href="#how-it-works"
              className="text-neutral-600 hover:text-neutral-900 rounded-full px-6 py-3 text-sm font-medium transition"
            >
              Watch demo
            </Link>
          </div>
        </div>

        {/* Right: mock UI cards */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-md flex flex-col gap-3">
            {/* Orchestrator */}
            <div className="bg-white rounded-2xl shadow-xl p-4 border border-neutral-200">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Orchestrator Agent
                  </p>
                  <p className="text-xs text-neutral-500">
                    Routing to Product Agent...
                  </p>
                </div>
              </div>
            </div>

            {/* Product Agent (inset) */}
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-neutral-200 ml-6">
              <p className="text-sm font-medium text-neutral-900 mb-1">
                Product Agent
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Generated &ldquo;Minimalist Mountain Tee&rdquo; — SEO-optimized
                title + 3 pricing tiers ready.
              </p>
            </div>

            {/* Published */}
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-primary-500 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Published to Shopee
                  </p>
                  <p className="text-xs text-neutral-500">
                    3 products live · 2 mins ago
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-neutral-900 text-white rounded-2xl shadow-xl p-5 ml-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                Monthly Revenue
              </p>
              <p className="font-serif text-3xl mt-1">RM 4,280</p>
              <p className="text-xs text-green-400 mt-1">
                ↑ 23% from last month
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="bg-neutral-100 py-24 px-16"
      >
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary-500 uppercase tracking-widest text-xs font-medium mb-4">
            How it works
          </p>
          <h2 className="font-serif text-neutral-900 text-4xl font-normal">
            Five agents. One mission.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {agents.map((a) => (
            <div
              key={a.title}
              className="bg-white rounded-xl p-6 border border-neutral-300"
            >
              <div className="w-10 h-10 rounded-full bg-primary-500 text-neutral-900 flex items-center justify-center text-sm font-semibold mb-4">
                {a.initials}
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">
                {a.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-neutral-900 py-24 px-16 text-center">
        <h2 className="font-serif text-white text-4xl font-normal mb-4">
          Ready to automate your store?
        </h2>
        <p className="text-neutral-400 text-base mb-8">
          Join print-on-demand founders who let AI run their business.
        </p>
        <Link
          href="/register"
          className="inline-block bg-primary-500 hover:bg-primary-600 text-white rounded-full px-6 py-3 text-sm font-medium transition"
        >
          Start for free →
        </Link>
      </section>
    </main>
  );
};

export default LandingPage;
