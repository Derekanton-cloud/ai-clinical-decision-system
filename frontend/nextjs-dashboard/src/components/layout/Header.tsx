"use client";

import { Bell, Building2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/diagnosis": "AI Diagnosis",
  "/chatbot": "Doctor Chatbot",
  "/monitoring": "Patient Monitoring",
  "/case-history": "Case History",
  "/analytics": "Analytics",
};

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Build breadcrumbs
  const pageLabel = PAGE_LABELS[pathname] || (pathname.startsWith("/patient/") ? "Patient History" : "");

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">Home</Link>
          {pageLabel && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              <span className="font-medium text-gray-700">{pageLabel}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        {user && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
            <Building2 className="h-4 w-4 text-blue-600" />
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.hospital_name}</p>
              <p className="text-xs text-gray-500">AI Clinical DSS v2.0</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
