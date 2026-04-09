"use client";

import { User, HeartPulse, X, ExternalLink } from "lucide-react";
import { usePatient } from "@/lib/patient-context";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function ActivePatientBanner() {
  const { patient, clearPatient } = usePatient();
  const { user } = useAuth();

  if (!patient) return null;

  return (
    <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 px-6 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left — Patient Code Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 shadow-sm">
            <User className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold font-mono text-white tracking-wider shadow-sm">
              {patient.patient_code}
            </span>
            <div className="h-5 w-px bg-blue-200" />
          </div>
        </div>

        {/* Center — Patient Info */}
        <div className="flex flex-1 items-center gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight tracking-tight">
              {patient.first_name} {patient.last_name}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight">
              Age {patient.age} · DOB {patient.date_of_birth}
            </p>
          </div>

          {user?.hospital_name && (
            <>
              <div className="h-5 w-px bg-blue-200 hidden sm:block" />
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">Hospital</p>
                <p className="text-xs font-medium text-slate-700 leading-tight">{user.hospital_name}</p>
              </div>
            </>
          )}

          <div className="h-5 w-px bg-blue-200 hidden md:block" />
          <Link
            href={`/patient/${patient.patient_id}`}
            className="hidden md:flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <HeartPulse className="h-3.5 w-3.5" />
            View History
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Right — Clear Button */}
        <button
          onClick={clearPatient}
          className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          title="Clear active patient"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear Patient</span>
        </button>
      </div>
    </div>
  );
}
