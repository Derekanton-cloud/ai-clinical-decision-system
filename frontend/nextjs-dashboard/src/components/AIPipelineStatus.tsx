"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Circle } from "lucide-react";

const PIPELINE_STEPS = [
  { label: "Enhancing X-ray", detail: "Diffusion denoising model", icon: "🧠" },
  { label: "CNN Detection", detail: "EfficientNet-B0 classifier", icon: "🔬" },
  { label: "Grad-CAM", detail: "Visual attention mapping", icon: "🫁" },
  { label: "SHAP Analysis", detail: "Symptom feature importance", icon: "📊" },
  { label: "Uncertainty", detail: "Monte Carlo Dropout", icon: "🎯" },
  { label: "Risk Scoring", detail: "XGBoost risk model", icon: "⚕️" },
  { label: "Case Matching", detail: "Similarity search", icon: "🔍" },
  { label: "Recommendations", detail: "Clinical guidelines", icon: "📋" },
];

const STEP_INTERVAL_MS = 800;

interface AIPipelineStatusProps {
  active: boolean;
  onComplete?: () => void;
}

export default function AIPipelineStatus({
  active,
  onComplete,
}: AIPipelineStatusProps) {
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!active) {
      setCurrentStep(-1);
      return;
    }

    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= PIPELINE_STEPS.length) {
          clearInterval(interval);
          onComplete?.();
          return prev;
        }
        return next;
      });
    }, STEP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [active, onComplete]);

  if (!active && currentStep === -1) return null;

  const progress =
    ((Math.min(currentStep + 1, PIPELINE_STEPS.length)) / PIPELINE_STEPS.length) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/30" />
              <div className="relative rounded-full bg-blue-500 p-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                AI Clinical Analysis Pipeline
              </h3>
              <p className="text-xs text-slate-400">
                Step {Math.min(currentStep + 1, PIPELINE_STEPS.length)} of {PIPELINE_STEPS.length}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
            {progress.toFixed(0)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-0.5">
        {PIPELINE_STEPS.map((step, i) => {
          const completed = i < currentStep;
          const isCurrent = i === currentStep;
          const pending = i > currentStep;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${
                isCurrent
                  ? "bg-blue-50 ring-1 ring-blue-200"
                  : completed
                  ? "opacity-100"
                  : "opacity-35"
              }`}
              style={{
                transform: pending ? "translateX(4px)" : "translateX(0)",
                transition: "all 0.4s ease",
              }}
            >
              {/* Status icon */}
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                {completed ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
              </div>

              {/* Step emoji */}
              <span className="text-base">{step.icon}</span>

              {/* Label + detail */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm block ${
                    completed
                      ? "font-medium text-slate-700"
                      : isCurrent
                      ? "font-semibold text-blue-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                  {isCurrent && (
                    <span className="ml-1 text-xs text-blue-400">processing...</span>
                  )}
                </span>
                {(isCurrent || completed) && (
                  <span className="text-[11px] text-slate-400">{step.detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed summary */}
      {currentStep >= PIPELINE_STEPS.length - 1 && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <CheckCircle className="h-4 w-4" />
          Analysis complete — rendering results
        </div>
      )}
    </div>
  );
}
