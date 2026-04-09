"use client";

import { FileText, Clock, AlertTriangle, Eye, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getHospitalCases, searchCases } from "@/lib/api";
import Link from "next/link";

interface CaseRecord {
  case_id: string;
  case_code: string;
  patient_name: string;
  patient_id: string;
  patient_code: string;
  date: string;
  diagnosis: string;
  confidence: number;
  risk_level: string;
  status: string;
  notes: string;
  doctor_name: string;
}

const statusStyles: Record<string, string> = {
  ONGOING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  REVIEWED: "bg-blue-50 text-blue-700 border-blue-200",
};

const riskStyles: Record<string, string> = {
  Low: "text-green-600 bg-green-50",
  Moderate: "text-yellow-600 bg-yellow-50",
  High: "text-orange-600 bg-orange-50",
  Critical: "text-red-600 bg-red-50",
};

export default function CaseHistoryPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");


  const loadCases = async () => {
    setLoading(true);
    try {
      const data = await getHospitalCases();
      setCases(data);
    } catch {
      console.error("Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCases();
      return;
    }
    setLoading(true);
    try {
      const data = await searchCases(searchQuery);
      setCases(data);
    } catch {
      console.error("Search failed");
    } finally {
      setLoading(false);
    }
  };



  const filteredCases =
    filter === "all" ? cases : cases.filter((c) => c.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case History</h1>
          <p className="text-sm text-gray-500">
            Hospital case records from database
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["all", "ONGOING", "COMPLETED", "REVIEWED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by patient name, patient code, doctor name, or diagnosis..."
            className="w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); loadCases(); }}
            className="rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <FileText className="h-8 w-8 text-blue-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
            <p className="text-sm text-gray-500">Total Cases</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <Clock className="h-8 w-8 text-yellow-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {cases.filter((c) => c.status === "ONGOING").length}
            </p>
            <p className="text-sm text-gray-500">Ongoing</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {cases.filter((c) => c.risk_level === "Critical" || c.risk_level === "High").length}
            </p>
            <p className="text-sm text-gray-500">High/Critical Risk</p>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Case #</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Diagnosis</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Doctor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    No cases found
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.case_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/patient/${c.patient_id}`}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        {c.case_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/patient/${c.patient_id}`} className="group">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{c.patient_name}</p>
                        <p className="text-xs text-gray-400 group-hover:text-blue-400 transition-colors">{c.patient_code}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.diagnosis}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(c.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${riskStyles[c.risk_level] || "text-gray-600 bg-gray-50"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          c.risk_level === "Critical" ? "bg-red-500" :
                          c.risk_level === "High" ? "bg-orange-500" :
                          c.risk_level === "Moderate" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                        {c.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[c.status] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.doctor_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
