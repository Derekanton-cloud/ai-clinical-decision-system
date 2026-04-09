"use client";

import ClinicalChatbot from "@/components/ClinicalChatbot";
import PatientRegistration from "@/components/PatientRegistration";
import { usePatient } from "@/lib/patient-context";

export default function ChatbotPage() {
  const { patient } = usePatient();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          AI Clinical Chatbot
        </h1>
        <p className="text-sm text-gray-500">
          BioBERT-powered clinical assessment with symptom extraction and
          radiology integration
        </p>
      </div>

      {!patient ? (
        <div className="max-w-md">
          <PatientRegistration onPatientReady={() => {}} />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ClinicalChatbot
            patientId={patient.patient_id}
            patientName={`${patient.first_name} ${patient.last_name}`}
            patientAge={patient.age}
          />
        </div>
      )}
    </div>
  );
}
