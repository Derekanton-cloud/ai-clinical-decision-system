"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import {
  Upload,
  Search,
  AlertCircle,
  CheckCircle,
  Loader2,
  Shield,
  Activity,
  Brain,
  Zap,
  Eye,
  HeartPulse,
  FileWarning,
  FileDown,
} from "lucide-react";
import { predictDisease, getGradCAM, getSHAPExplanation, generateReport, createCase } from "@/lib/api";
import AIPipelineStatus from "@/components/AIPipelineStatus";
import PatientRegistration from "@/components/PatientRegistration";
import { usePatient, type PatientInfo } from "@/lib/patient-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const LungVisualization = lazy(
  () => import("@/components/visualization/LungVisualization")
);

interface FocusRegion {
  x: number;
  y: number;
  intensity: number;
}

interface PredictionResult {
  predicted_disease: string;
  confidence: number;
  risk_level: string;
  uncertainty: number;
  model_agreement: number;
  uncertainty_warning: string | null;
  explanation: string;
  imaging_explanation: string;
  symptom_explanation: string;
  confidence_explanation: string;
  region_detected: string | null;
  counterfactuals: { change: string; new_prediction: string; confidence: number }[];
  image_prediction: { disease: string; confidence: number };
  symptom_prediction: { disease: string; confidence: number };
}

interface SHAPResult {
  feature_importance: Record<string, number>;
  base_value: number;
  explanation: string;
}

export default function DiagnosisPage() {
  const { patient, setPatient } = usePatient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [focusRegion, setFocusRegion] = useState<FocusRegion | null>(null);
  const [shapData, setShapData] = useState<SHAPResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [caseSaved, setCaseSaved] = useState(false);
  const [savedCaseCode, setSavedCaseCode] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setHeatmapUrl(null);
      setFocusRegion(null);
      setShapData(null);
    }
  };

  const handlePipelineComplete = useCallback(() => {
    setShowResults(true);
    setPipelineActive(false);
  }, []);

  const handleSubmit = async () => {
    if (!selectedFile || !symptoms.trim()) return;
    setLoading(true);
    setShowResults(false);
    setPipelineActive(true);
    try {
      const [predResult, gradcamResult] = await Promise.all([
        predictDisease(selectedFile, symptoms),
        getGradCAM(selectedFile),
      ]);

      setResult(predResult);
      setHeatmapUrl(gradcamResult.heatmap_image);
      if (gradcamResult.focus_region) {
        setFocusRegion(gradcamResult.focus_region);
      }

      // Now get SHAP with actual predicted disease
      const shap = await getSHAPExplanation(symptoms, predResult.predicted_disease);
      setShapData(shap);

      // Save case to database if patient is registered
      if (patient) {
        try {
          const savedCase = await createCase({
            patient_id: patient.patient_id,
            diagnosis: predResult.predicted_disease,
            confidence: predResult.confidence,
            risk_level: predResult.risk_level,
            notes: `Symptoms: ${symptoms}`,
          });
          setCaseSaved(true);
          setSavedCaseCode(savedCase.case_code);
        } catch {
          console.error("Failed to save case");
        }
      }
    } catch {
      console.error("Prediction failed");
      setPipelineActive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!result) return;
    setReportLoading(true);
    try {
      const reportData = await generateReport({
        predicted_disease: result.predicted_disease,
        confidence: result.confidence,
        risk_level: result.risk_level,
        symptoms,
        gradcam_explanation: result.imaging_explanation || "",
        shap_explanation: result.symptom_explanation || "",
        uncertainty: result.uncertainty,
        region_detected: result.region_detected || undefined,
      });
      // Decode base64 PDF and trigger download
      const byteCharacters = atob(reportData.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_${patient?.patient_code || "unknown"}_${result.predicted_disease.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      console.error("Report generation failed");
    } finally {
      setReportLoading(false);
    }
  };

  const riskColor = (level: string) => {
    switch (level) {
      case "Low": return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-500", glow: "shadow-emerald-100" };
      case "Moderate": return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", glow: "shadow-amber-100" };
      case "High": return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-500", glow: "shadow-orange-100" };
      case "Critical": return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500", glow: "shadow-red-100" };
      default: return { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-500", glow: "shadow-slate-100" };
    }
  };

  const shapChartData = shapData
    ? Object.entries(shapData.feature_importance).map(([name, value]) => ({
        name,
        value: Number(value),
        fill: Number(value) > 0 ? "#3b82f6" : "#ef4444",
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Diagnosis</h1>
          <p className="text-sm text-slate-500">
            Upload X-ray images and enter symptoms for AI-powered disease prediction
          </p>
        </div>
        {result && showResults && (
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${riskColor(result.risk_level).bg} ${riskColor(result.risk_level).text} ${riskColor(result.risk_level).border} border`}>
            <span className={`h-2 w-2 rounded-full ${riskColor(result.risk_level).badge}`} />
            {result.risk_level} Risk
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── Input Panel ─── */}
        <div className="space-y-4">
          {/* Patient Registration */}
          <PatientRegistration onPatientReady={(p) => { setCaseSaved(false); setSavedCaseCode(null); }} />

          {/* X-ray Upload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload X-Ray Image
            </h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-inner">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="X-ray preview"
                  className="h-48 w-auto rounded-lg object-contain shadow-md"
                />
              ) : (
                <>
                  <div className="mb-3 rounded-full bg-blue-100 p-3">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    Click to upload X-ray image
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PNG, JPG up to 10MB
                  </p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Symptoms Input */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Activity className="h-5 w-5 text-blue-600" />
              Patient Symptoms
            </h3>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Enter symptoms: e.g., persistent cough, fever, chest pain, breathlessness..."
              className="h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedFile || !symptoms.trim() || loading || !patient}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Analyzing..." : "Run AI Diagnosis"}
          </button>
        </div>

        {/* ─── Results Panel ─── */}
        <div className="space-y-4">
          {/* AI Pipeline Animation */}
          {(pipelineActive || (loading && !showResults)) && (
            <AIPipelineStatus
              active={pipelineActive}
              onComplete={handlePipelineComplete}
            />
          )}

          {result && showResults ? (
            <>
              {/* ── Main Diagnosis Card ── */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {/* Card header strip */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white/20 p-2">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-blue-100">AI Diagnosis Result</p>
                      <p className="text-2xl font-bold text-white tracking-tight">
                        {result.predicted_disease}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status cards grid */}
                <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-slate-100">
                  {/* Confidence */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Confidence</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                      {(result.confidence * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
                        style={{ width: `${result.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Risk Level */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Risk Level</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${riskColor(result.risk_level).badge}`} />
                      <p className={`text-2xl font-bold ${riskColor(result.risk_level).text}`}>
                        {result.risk_level}
                      </p>
                    </div>
                  </div>

                  {/* Model Agreement */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Model Agreement</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                      {(result.model_agreement * 100).toFixed(0)}%
                    </p>
                  </div>

                  {/* Uncertainty */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HeartPulse className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Uncertainty</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                      {(result.uncertainty * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Uncertainty warning */}
                {result.uncertainty_warning && (
                  <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700">
                      {result.uncertainty_warning}
                    </p>
                  </div>
                )}
              </div>

              {/* ── AI Diagnostic Reasoning ── */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Brain className="h-4 w-4" />
                    AI Diagnostic Reasoning
                  </h3>
                  <p className="text-[11px] text-indigo-200 mt-0.5">Step-by-step analysis pipeline</p>
                </div>
                <div className="p-5">
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200" />

                    {/* Step 1: Image Analysis */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md shadow-blue-200">
                        1
                      </div>
                      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Image Analysis</p>
                        <p className="text-sm text-slate-700">
                          {result.imaging_explanation || `CNN detected abnormal opacity patterns in the ${result.region_detected || "lung"} region.`}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: GradCAM Localization */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white shadow-md shadow-cyan-200">
                        2
                      </div>
                      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">GradCAM Localization</p>
                        <p className="text-sm text-slate-700">
                          {result.region_detected
                            ? `Heatmap highlights infection region in ${result.region_detected.toLowerCase()}.`
                            : "Heatmap highlights areas of interest across the lung field."}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Symptom Correlation */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-md shadow-amber-200">
                        3
                      </div>
                      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Symptom Correlation</p>
                        <p className="text-sm text-slate-700">
                          {result.symptom_explanation || `Reported symptoms increase ${result.predicted_disease} likelihood.`}
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Risk Evaluation */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-md shadow-orange-200">
                        4
                      </div>
                      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Risk Evaluation</p>
                        <p className="text-sm text-slate-700">
                          {result.confidence_explanation || `XGBoost risk model predicts ${result.risk_level.toLowerCase()} severity with ${(result.model_agreement * 100).toFixed(0)}% model agreement.`}
                        </p>
                      </div>
                    </div>

                    {/* Final Diagnosis */}
                    <div className="relative flex gap-4">
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-md shadow-emerald-200">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className={`flex-1 rounded-xl border p-3.5 ${riskColor(result.risk_level).bg} ${riskColor(result.risk_level).border}`}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Final Diagnosis</p>
                        <p className={`text-lg font-bold ${riskColor(result.risk_level).text}`}>
                          {result.predicted_disease}
                        </p>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Confidence: {(result.confidence * 100).toFixed(1)}% &middot; Risk: {result.risk_level}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Download Report Button ── */}
              <button
                onClick={handleDownloadReport}
                disabled={reportLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {reportLoading ? "Generating Report..." : "Download Radiology Report"}
              </button>

              {/* Case Saved Indicator */}
              {caseSaved && savedCaseCode && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm text-emerald-700">
                    Case saved as <span className="font-bold font-mono">{savedCaseCode}</span> for patient <span className="font-semibold">{patient?.patient_code}</span>
                  </p>
                </div>
              )}

              {/* ── AI Explanation Card ── */}
              {result.explanation && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Brain className="h-4 w-4 text-indigo-600" />
                    AI Explanation
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {result.explanation}
                  </p>
                  {result.region_detected && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Region: {result.region_detected}
                    </div>
                  )}
                </div>
              )}

              {/* ── What-If Analysis ── */}
              {result.counterfactuals && result.counterfactuals.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Zap className="h-4 w-4 text-violet-600" />
                    What-If Analysis
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">
                    Minimal changes that would alter the diagnosis
                  </p>
                  <div className="space-y-2">
                    {result.counterfactuals.map((cf, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900 capitalize">
                            {cf.change}
                          </p>
                          <p className="text-xs text-slate-500">
                            → {cf.new_prediction}
                          </p>
                        </div>
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                          {(cf.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Grad-CAM Heatmap ── */}
              {heatmapUrl && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Eye className="h-4 w-4 text-cyan-600" />
                    Grad-CAM Heatmap
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">
                    Highlighted regions show where the AI model focused
                  </p>
                  <img
                    src={heatmapUrl}
                    alt="Grad-CAM heatmap"
                    className="w-full rounded-xl shadow-inner"
                  />
                </div>
              )}

              {/* ── SHAP Feature Importance ── */}
              {shapData && shapChartData.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Symptom Importance (SHAP)
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">
                    {shapData.explanation}
                  </p>
                  <div className="h-64 rounded-xl bg-slate-50 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shapChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {shapChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── 3D Lung Visualization ── */}
              {result && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <HeartPulse className="h-4 w-4 text-rose-600" />
                    3D Lung Visualization
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">
                    Rotate and zoom to explore — infection focus mapped from Grad-CAM
                  </p>
                  <div className="h-[450px] rounded-xl overflow-hidden">
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center rounded-xl bg-slate-900">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
                            <p className="mt-2 text-xs text-slate-400">Loading 3D model...</p>
                          </div>
                        </div>
                      }
                    >
                      <LungVisualization
                        focusRegion={focusRegion || undefined}
                        diseaseLabel={result.predicted_disease}
                        animate
                      />
                    </Suspense>
                  </div>
                </div>
              )}
            </>
          ) : !pipelineActive && !loading ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12">
              <div className="text-center">
                <div className="mx-auto mb-4 rounded-full bg-slate-100 p-4">
                  <AlertCircle className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  No results yet
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Upload an X-ray and enter symptoms to run AI diagnosis
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
