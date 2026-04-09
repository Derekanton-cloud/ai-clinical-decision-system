"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import {
  LayoutDashboard,
  Stethoscope,
  MessageSquare,
  FolderClock,
  BarChart3,
  Activity,
  HeartPulse,
  LogOut,
  ChevronUp,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/diagnosis", label: "AI Diagnosis", icon: Stethoscope },
  { href: "/chatbot", label: "Doctor Chatbot", icon: MessageSquare },
  { href: "/monitoring", label: "Patient Monitoring", icon: HeartPulse },
  { href: "/case-history", label: "Case History", icon: FolderClock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "DR";

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      {/* Logo + Hospital */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Activity className="h-7 w-7 text-blue-600" />
        <div className="min-w-0">
          <span className="block text-lg font-bold leading-tight text-gray-900">ClinicalAI</span>
          {user && (
            <span className="block truncate text-[10px] font-medium text-blue-600">
              {user.hospital_name}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Profile */}
      <div className="relative border-t p-4">
        {showDropdown && (
          <div className="absolute bottom-full left-4 right-4 mb-1 rounded-lg border bg-white shadow-lg">
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex w-full items-center gap-3 rounded-lg bg-blue-50 p-3 transition-colors hover:bg-blue-100"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-gray-900">
              Dr. {user?.first_name} {user?.last_name}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.role}</p>
          </div>
          <ChevronUp className={cn("h-4 w-4 text-gray-400 transition-transform", !showDropdown && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
