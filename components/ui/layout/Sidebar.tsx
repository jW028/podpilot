import React from "react";
import Link from "next/link";

const Sidebar = () => {
  return (
    <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col">
      <Link href="/dashboard" className="text-2xl font-bold mb-8">
        Podpilot
      </Link>
      <nav className="flex-1 space-y-4">
        <Link
          href="/dashboard"
          className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/profile"
          className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Profile
        </Link>
        <Link
          href="/business"
          className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Businesses
        </Link>
      </nav>
      <div className="border-t border-gray-700 pt-4">
        <button className="w-full px-4 py-2 text-left rounded hover:bg-gray-800 transition-colors">
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
