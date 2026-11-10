// Same-origin /api is the production default; NEXT_PUBLIC_API_URL is only
// needed for an explicit local split-stack setup.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth ──

export async function login(data: {
  first_name: string;
  last_name: string;
  password: string;
  role: string;
  hospital: string;
}) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function demoLogin() {
  const res = await fetch(`${API_BASE_URL}/auth/demo-login`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Demo login is unavailable" }));
    throw new Error(err.detail || "Demo login is unavailable");
  }
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function getHospitals() {
  const res = await fetch(`${API_BASE_URL}/auth/hospitals`);
  if (!res.ok) throw new Error("Failed to fetch hospitals");
  return res.json();
}

// ── Patients ──

export async function registerPatient(data: {
  first_name: string;
  last_name: string;
  date_of_birth: string;
}) {
  const res = await fetch(`${API_BASE_URL}/patients/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Patient registration failed");
  return res.json();
}

export async function getPatient(patientId: string) {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch patient");
  return res.json();
}

export async function searchPatients(q: string) {
  const res = await fetch(`${API_BASE_URL}/patients/search/?q=${encodeURIComponent(q)}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Patient search failed");
  return res.json();
}

// ── Cases ──

export async function createCase(data: {
  patient_id: string;
  diagnosis: string;
  confidence: number;
  risk_level: string;
  notes?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/cases/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Case creation failed");
  return res.json();
}

export async function getHospitalCases() {
  const res = await fetch(`${API_BASE_URL}/cases/hospital`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch cases");
  return res.json();
}

export async function getPatientCases(patientId: string) {
  const res = await fetch(`${API_BASE_URL}/cases/patient/${patientId}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch patient cases");
  return res.json();
}

export async function updateCaseStatus(caseId: string, status: string, notes: string) {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error("Failed to update case status");
  return res.json();
}

export async function searchCases(q: string) {
  const res = await fetch(`${API_BASE_URL}/cases/search?q=${encodeURIComponent(q)}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Case search failed");
  return res.json();
}

// ── Dashboard ──

export async function getDashboardStats() {
  const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

// ── Monitoring ──

export async function getMonitoringData(patientId: string) {
  const res = await fetch(`${API_BASE_URL}/monitoring/${patientId}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch monitoring data");
  return res.json();
}

// ── Existing AI endpoints (now with auth) ──

export async function predictDisease(xray: File, symptoms: string) {
  const formData = new FormData();
  formData.append("xray", xray);
  formData.append("symptoms", symptoms);

  const res = await fetch(`${API_BASE_URL}/predict-disease`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) throw new Error("Prediction request failed");
  return res.json();
}

export async function sendChatMessage(message: string, conversationId?: string) {
  const res = await fetch(`${API_BASE_URL}/chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });

  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

export async function generateReport(data: {
  predicted_disease: string;
  confidence: number;
  risk_level: string;
  symptoms: string;
  patient_age?: string;
  patient_name?: string;
  patient_code?: string;
  hospital_name?: string;
  requesting_clinician?: string;
  scan_type?: string;
  gradcam_explanation?: string;
  shap_explanation?: string;
  recommended_tests?: string[];
  uncertainty?: number;
  region_detected?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Report generation failed");
  return res.json();
}

export async function getGradCAM(xray: File) {
  const formData = new FormData();
  formData.append("xray", xray);

  const res = await fetch(`${API_BASE_URL}/explain/gradcam`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) throw new Error("Grad-CAM request failed");
  return res.json();
}

export async function getSHAPExplanation(symptoms: string, predictedDisease: string) {
  const res = await fetch(`${API_BASE_URL}/explain/shap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ symptoms, predicted_disease: predictedDisease }),
  });

  if (!res.ok) throw new Error("SHAP explanation request failed");
  return res.json();
}

export async function sendClinicalChatMessage(
  message: string,
  conversationId?: string,
  patientAge?: number
) {
  const res = await fetch(`${API_BASE_URL}/clinical-chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ message, conversation_id: conversationId, patient_age: patientAge }),
  });

  if (!res.ok) throw new Error("Clinical chatbot request failed");
  return res.json();
}

export async function uploadChatbotScan(xray: File, conversationId: string) {
  const formData = new FormData();
  formData.append("xray", xray);
  formData.append("conversation_id", conversationId);

  const res = await fetch(`${API_BASE_URL}/clinical-chatbot/scan`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) throw new Error("Chatbot scan upload failed");
  return res.json();
}
