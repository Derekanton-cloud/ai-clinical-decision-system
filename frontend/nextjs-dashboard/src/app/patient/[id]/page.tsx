"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  User,
  Calendar,
  FileText,
  Loader2,
  ArrowLeft,
  Stethoscope,
  Clock,
  Table,
  LayoutList,
  Activity,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { getPatientCases, updateCaseStatus } from "@/lib/api";

interface CaseItem {
  case_id: string;
  case_code: string;
  date: string;
  diagnosis: string;
  confidence: number;
  risk_level: string;
  status: string;
  notes: string;
  doctor_name: string;
}

interface PatientData {
  patient_id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

const riskColors: Record<string, string> = {
  Low: "border-green-200 bg-green-50 text-green-700",
  Moderate: "border-yellow-200 bg-yellow-50 text-yellow-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Critical: "border-red-200 bg-red-50 text-red-700",
};

const statusColors: Record<string, string> = {
  ONGOING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  REVIEWED: "bg-blue-100 text-blue-700",
};

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function PatientHistoryPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const [statusModal, setStatusModal] = useState<CaseItem | null>(null);
  const [newStatus, setNewStatus] = useState("ONGOING");
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadData = () => {
    if (!patientId) return;
    setLoading(true);
    getPatientCases(patientId)
      .then((data) => {
        setPatient(data.patient);
        setCases(data.cases);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleStatusUpdate = async () => {
    if (!statusModal || !statusNote.trim()) return;
    setUpdating(true);
    try {
      await updateCaseStatus(statusModal.case_id, newStatus, statusNote);
      setCases((prev) =>
        prev.map((c) =>
          c.case_id === statusModal.case_id
            ? { ...c, status: newStatus, notes: statusNote }
            : c
        )
      );
      setStatusModal(null);
      setStatusNote("");
    } catch {
      console.error("Status update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Patient not found</p>
        <Link href="/case-history" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Case History
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/case-history"
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient History</h1>
          <p className="text-sm text-gray-500">
            Complete case timeline for this patient
          </p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <User className="h-7 w-7 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xl font-bold text-gray-900">
              {patient.first_name} {patient.last_name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {patient.patient_code}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                DOB: {patient.date_of_birth}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Age: {calcAge(patient.date_of_birth)} years
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Cases</p>
            <p className="text-3xl font-bold text-blue-600">{cases.length}</p>
          </div>
        </div>
      </div>

      {/* Timeline / Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Clock className="h-5 w-5 text-gray-400" />
            Diagnosis History
          </h2>
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === "timeline" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutList className="h-3.5 w-3.5" /> Timeline
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === "table" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Table className="h-3.5 w-3.5" /> Table
            </button>
          </div>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
            No cases recorded for this patient.
          </div>
        ) : view === "timeline" ? (
          <div className="space-y-3">
            {cases.map((c, i) => (
              <div
                key={c.case_id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  i === 0 ? "ring-2 ring-blue-100" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Stethoscope className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-gray-900">{c.diagnosis}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskColors[c.risk_level] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {c.risk_level}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">{c.case_code}</span> — {c.date}
                      </p>
                      {c.notes && (
                        <p className="mt-2 text-sm text-gray-600">{c.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">{c.doctor_name}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1.5">
                    <p className="text-lg font-bold text-gray-900">
                      {(c.confidence * 100).toFixed(0)}%
                    </p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                    <div>
                      <button
                        onClick={() => {
                          setStatusModal(c);
                          setNewStatus(c.status);
                          setStatusNote("");
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Update Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table view */
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Case</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Diagnosis</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.map((c) => (
                  <tr key={c.case_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">{c.case_code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.diagnosis}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(c.confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskColors[c.risk_level] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{c.risk_level}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.doctor_name}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setStatusModal(c);
                          setNewStatus(c.status);
                          setStatusNote("");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link to monitoring */}
      <div className="rounded-xl border bg-blue-50 p-4">
        <Link
          href={`/monitoring?patient_id=${patient.patient_id}`}
          className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
        >
          <Stethoscope className="h-4 w-4" />
          View Patient Monitoring Data
        </Link>
      </div>

      {/* Status Update Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Update Case Status</h3>
              <button onClick={() => setStatusModal(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Case: <span className="font-mono font-semibold">{statusModal.case_code}</span> — {statusModal.diagnosis}
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ONGOING">ONGOING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="REVIEWED">REVIEWED</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Reason for update <span className="text-red-500">*</span>
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Patient admitted for observation, Follow-up CT scan recommended..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatusModal(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updating || !statusNote.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
