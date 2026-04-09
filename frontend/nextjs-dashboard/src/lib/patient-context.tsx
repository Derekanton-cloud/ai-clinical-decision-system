"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface PatientInfo {
  patient_id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age: number;
}

interface PatientContextValue {
  patient: PatientInfo | null;
  setPatient: (patient: PatientInfo | null) => void;
  clearPatient: () => void;
}

const STORAGE_KEY = "clinical_ai_patient";

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patient, setPatientState] = useState<PatientInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPatientState(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  const setPatient = useCallback((p: PatientInfo | null) => {
    setPatientState(p);
    if (p) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearPatient = useCallback(() => {
    setPatientState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Don't render children until hydrated to avoid mismatch
  if (!hydrated) return null;

  return (
    <PatientContext.Provider value={{ patient, setPatient, clearPatient }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}
