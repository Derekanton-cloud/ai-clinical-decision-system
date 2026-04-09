"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Upload,
  Activity,
  Stethoscope,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { sendClinicalChatMessage, uploadChatbotScan, createCase } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  detectedSymptoms?: string[];
  symptomScores?: Record<string, number>;
  diseaseSuggestions?: [string, number][];
  recommendedTests?: string[];
  readyForScan?: boolean;
}

interface ScanResult {
  predicted_disease: string;
  confidence: number;
  risk_level: string;
  risk_score: number;
  explanation: string;
  chatbot_symptoms: string;
}

interface ClinicalChatbotProps {
  patientId?: string;
  patientName?: string;
  patientAge?: number;
}

export default function ClinicalChatbot({ patientId, patientName, patientAge }: ClinicalChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello, I'm your AI Clinical Assistant powered by BioBERT. " +
        "I'll guide you through a structured clinical assessment. " +
        "Please describe your symptoms in detail to begin.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [allSymptoms, setAllSymptoms] = useState<string[]>([]);
  const [diseaseSuggestions, setDiseaseSuggestions] = useState<[string, number][]>([]);
  const [recommendedTests, setRecommendedTests] = useState<string[]>([]);
  const [readyForScan, setReadyForScan] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendClinicalChatMessage(userMessage.content, conversationId, patientAge);
      setConversationId(data.conversation_id);

      if (data.detected_symptoms?.length) {
        setAllSymptoms(data.detected_symptoms);
      }
      if (data.disease_suggestions?.length) {
        setDiseaseSuggestions(data.disease_suggestions);
      }
      if (data.recommended_tests?.length) {
        setRecommendedTests(data.recommended_tests);
      }
      setReadyForScan(data.ready_for_scan || false);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: data.timestamp,
          detectedSymptoms: data.detected_symptoms,
          symptomScores: data.symptom_scores,
          diseaseSuggestions: data.disease_suggestions,
          recommendedTests: data.recommended_tests,
          readyForScan: data.ready_for_scan,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I apologize, but I'm unable to process your request at the moment. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId, patientAge]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScanUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !conversationId) return;

      setUploadingFile(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: `📎 Uploading chest X-ray: ${file.name}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      try {
        const result = await uploadChatbotScan(file, conversationId);
        setScanResult(result);

        // Save case to database if patient is registered
        if (patientId) {
          try {
            await createCase({
              patient_id: patientId,
              diagnosis: result.predicted_disease,
              confidence: result.confidence,
              risk_level: result.risk_level,
              notes: `Chatbot assessment. Symptoms: ${result.chatbot_symptoms || allSymptoms.join(", ")}`,
            });
          } catch {
            // Case save failure is non-blocking
          }
        }

        const scanMessage =
          `Scan analysis complete!\n\n` +
          `  • Disease Detected: ${result.predicted_disease}\n` +
          `  • Confidence: ${(result.confidence * 100).toFixed(1)}%\n` +
          `  • Risk Level: ${result.risk_level}\n` +
          `  • Risk Score: ${(result.risk_score * 100).toFixed(1)}%\n\n` +
          `${result.explanation}\n\n` +
          (result.chatbot_symptoms
            ? `Symptoms from interview: ${result.chatbot_symptoms}\n\n`
            : "") +
          `This AI analysis combines radiology imaging with the symptoms you reported ` +
          `during our clinical interview for a more comprehensive assessment.`;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: scanMessage,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Failed to process the scan. Please try again with a valid chest X-ray image.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [conversationId, patientId, allSymptoms]
  );

  return (
    <div className="flex h-full gap-4">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                AI Clinical Assistant
              </p>
              <p className="text-xs text-green-600">
                ● BioBERT-Powered
                {patientName && (
                  <span className="ml-2 text-blue-600 font-medium">· Patient: {patientName}</span>
                )}
              </p>
            </div>
          </div>
          {readyForScan && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload X-ray Scan
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleScanUpload}
            className="hidden"
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "assistant"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "assistant"
                      ? "bg-gray-100 text-gray-800"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      msg.role === "assistant" ? "text-gray-400" : "text-blue-200"
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Symptom detection badge inline */}
              {msg.role === "assistant" &&
                msg.detectedSymptoms &&
                msg.detectedSymptoms.length > 0 && (
                  <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                    {msg.detectedSymptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {symptom}
                        {msg.symptomScores?.[symptom] && (
                          <span className="text-green-500">
                            {(msg.symptomScores[symptom] * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-xs text-gray-500">
                    Analyzing with BioBERT...
                  </span>
                </div>
              </div>
            </div>
          )}
          {uploadingFile && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-xs text-gray-500">
                    Running AI radiology analysis on your scan...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your symptoms or ask a clinical question..."
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            BioBERT-powered clinical assessment. Always consult qualified medical
            professionals for diagnosis.
          </p>
        </div>
      </div>

      {/* Right Sidebar — Clinical Intelligence Panel */}
      <div className="hidden w-80 flex-col gap-4 lg:flex">
        {/* Detected Symptoms */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Detected Symptoms
            </h3>
          </div>
          {allSymptoms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {allSymptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {symptom}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Symptoms will appear here as you describe them
            </p>
          )}
        </div>

        {/* Disease Suggestions */}
        {diseaseSuggestions.length > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Preliminary Suggestions
              </h3>
            </div>
            <div className="space-y-2">
              {diseaseSuggestions.slice(0, 4).map(([disease, score]) => (
                <div key={disease} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    {disease}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-amber-400"
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Tests */}
        {recommendedTests.length > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Recommended Tests
              </h3>
            </div>
            <ul className="space-y-1.5">
              {recommendedTests.map((test) => (
                <li
                  key={test}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {test}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Scan Upload Card */}
        {readyForScan && !scanResult && (
          <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-4">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-blue-400" />
              <p className="mt-2 text-sm font-medium text-blue-700">
                Ready for X-ray Analysis
              </p>
              <p className="mt-1 text-xs text-blue-500">
                Upload a chest X-ray to combine imaging with your symptom data
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingFile ? "Analyzing..." : "Upload Scan"}
              </button>
            </div>
          </div>
        )}

        {/* Scan Result Summary */}
        {scanResult && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                AI Scan Result
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Disease</span>
                <span className="font-semibold text-gray-800">
                  {scanResult.predicted_disease}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Confidence</span>
                <span className="font-semibold text-blue-600">
                  {(scanResult.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Risk Level</span>
                <span
                  className={`font-semibold ${
                    scanResult.risk_level === "Critical"
                      ? "text-red-600"
                      : scanResult.risk_level === "High"
                      ? "text-orange-600"
                      : scanResult.risk_level === "Moderate"
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {scanResult.risk_level}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
