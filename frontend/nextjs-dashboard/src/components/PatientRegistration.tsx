"use client";

import { useState, useEffect } from "react";
import { User, Calendar, Loader2, CheckCircle, Search } from "lucide-react";
import { registerPatient } from "@/lib/api";
import { usePatient, type PatientInfo } from "@/lib/patient-context";

interface PatientRegistrationProps {
  onPatientReady: (patient: PatientInfo) => void;
}

export default function PatientRegistration({ onPatientReady }: PatientRegistrationProps) {
  const { patient: contextPatient, setPatient: setContextPatient } = usePatient();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
  });
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [error, setError] = useState("");

  // On mount, restore from context if available
  useEffect(() => {
    if (contextPatient && !patient) {
      setPatient(contextPatient);
      onPatientReady(contextPatient);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerPatient(form);
      setPatient(res);
      setContextPatient(res);
      onPatientReady(res);
    } catch {
      setError("Failed to register patient");
    } finally {
      setLoading(false);
    }
  };

  if (patient) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Patient Registered</p>
            <p className="text-xs text-emerald-600">
              {patient.first_name} {patient.last_name}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white p-3 border border-emerald-100">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Patient ID</p>
            <p className="text-sm font-bold text-slate-900">{patient.patient_code}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-emerald-100">
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Age</p>
            <p className="text-sm font-bold text-slate-900">{patient.age} years</p>
          </div>
        </div>
        <button
          onClick={() => {
            setPatient(null);
            setContextPatient(null);
            setForm({ first_name: "", last_name: "", date_of_birth: "" });
          }}
          className="mt-3 text-xs text-emerald-700 hover:underline"
        >
          Change Patient
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <User className="h-5 w-5 text-blue-600" />
        Patient Registration
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Register or look up patient before starting diagnosis
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">First Name</label>
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="John"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Last Name</label>
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Doe"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <Calendar className="h-3 w-3" /> Date of Birth
          </label>
          <input
            type="date"
            required
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {loading ? "Looking up..." : "Register / Look Up Patient"}
        </button>
      </form>
    </div>
  );
}
