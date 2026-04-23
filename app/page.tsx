import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LandingPage from "@/components/landing/LandingPage";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Header />
      {/* Test Shortcut */}
      <div className="flex justify-center bg-amber-50 py-4 border-b border-amber-200">
        <Link 
          href="/business/123e4567-e89b-12d3-a456-426614174000/finance"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-6 py-2 rounded-full shadow-sm transition"
        >
          View Finance Agent Demo
        </Link>
      </div>
      <LandingPage />
      <Footer />
    </>
  );
}
