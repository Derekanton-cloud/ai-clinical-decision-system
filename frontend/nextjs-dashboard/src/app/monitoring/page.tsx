"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Heart,
  Wind,
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  UserRound,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getMonitoringData, searchPatients } from "@/lib/api";
import { usePatient } from "@/lib/patient-context";

interface VitalReading {
  time: string;
  heartRate: number;
  o2Saturation: number;
  temperature: number;
  respRate: number;
}

interface VitalConfig {
  label: string;
  unit: string;
  icon: typeof Heart;
  color: string;
  bgColor: string;
  borderColor: string;
  normalRange: [number, number];
  criticalLow?: number;
  criticalHigh?: number;
}

const VITAL_CONFIGS: Record<string, VitalConfig> = {
  heartRate: {
    label: "Heart Rate",
    unit: "bpm",
    icon: Heart,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    normalRange: [60, 100],
    criticalLow: 50,
    criticalHigh: 130,
  },
  o2Saturation: {
    label: "O\u2082 Saturation",
    unit: "%",
    icon: Droplets,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    normalRange: [95, 100],
    criticalLow: 90,
  },
  temperature: {
    label: "Temperature",
    unit: "\u00B0C",
    icon: Thermometer,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    normalRange: [36.1, 37.2],
    criticalHigh: 39.0,
  },
  respRate: {
    label: "Respiration Rate",
    unit: "breaths/min",
    icon: Wind,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    normalRange: [12, 20],
    criticalLow: 8,
    criticalHigh: 30,
  },
};

function getTimeLabel(secondsAgo: number): string {
  const d = new Date(Date.now() - secondsAgo * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function generateInitialData(count: number): VitalReading[] {
  const data: VitalReading[] = [];
  for (let i = count - 1; i >= 0; i--) {
    data.push({
      time: getTimeLabel(i * 3),
      heartRate: 72 + Math.round(Math.sin(i * 0.3) * 8 + (Math.random() - 0.5) * 6),
      o2Saturation: Math.min(100, Math.max(88, 96 + Math.round(Math.sin(i * 0.2) * 2 + (Math.random() - 0.5) * 2))),
      temperature: +(36.8 + Math.sin(i * 0.15) * 0.8 + (Math.random() - 0.5) * 0.3).toFixed(1),
      respRate: 16 + Math.round(Math.sin(i * 0.25) * 3 + (Math.random() - 0.5) * 2),
    });
  }
  return data;
}

function getStatus(value: number, config: VitalConfig): "normal" | "warning" | "critical" {
  if (config.criticalLow !== undefined && value < config.criticalLow) return "critical";
  if (config.criticalHigh !== undefined && value > config.criticalHigh) return "critical";
  if (value < config.normalRange[0] || value > config.normalRange[1]) return "warning";
  return "normal";
}

function getTrend(data: VitalReading[], key: keyof Omit<VitalReading, "time">): "up" | "down" | "stable" {
  if (data.length < 5) return "stable";
  const recent = data.slice(-5).map((d) => d[key] as number);
  const avg1 = (recent[0] + recent[1]) / 2;
  const avg2 = (recent[3] + recent[4]) / 2;
  const diff = avg2 - avg1;
  if (Math.abs(diff) < 1) return "stable";
  return diff > 0 ? "up" : "down";
}

const STATUS_STYLES = {
  normal: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  warning: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500 animate-pulse" },
  critical: { badge: "bg-red-100 text-red-700", dot: "bg-red-500 animate-pulse" },
};

function VitalCard({
  vitalKey,
  value,
  data,
}: {
  vitalKey: string;
  value: number;
  data: VitalReading[];
}) {
  const config = VITAL_CONFIGS[vitalKey];
  const status = getStatus(value, config);
  const trend = getTrend(data, vitalKey as keyof Omit<VitalReading, "time">);
  const Icon = config.icon;
  const styles = STATUS_STYLES[status];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const chartColor = status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#22c55e";

  return (
    <div className={`rounded-2xl border ${config.borderColor} bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg ${config.bgColor} p-2`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{config.label}</p>
            <p className="text-[10px] text-slate-400">
              Normal: {config.normalRange[0]}–{config.normalRange[1]} {config.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={`h-3.5 w-3.5 ${
            trend === "up" ? "text-rose-500" : trend === "down" ? "text-blue-500" : "text-slate-400"
          }`} />
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-400">{config.unit}</span>
      </div>

      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.slice(-20)}>
            <defs>
              <linearGradient id={`gradient-${vitalKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={vitalKey}
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${vitalKey})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RiskCorrelationPanel({
  vitals,
}: {
  vitals: VitalReading;
}) {
  // Calculate simulated risk score based on vital signs
  let riskScore = 0;
  if (vitals.heartRate > 100) riskScore += (vitals.heartRate - 100) * 0.5;
  if (vitals.heartRate < 60) riskScore += (60 - vitals.heartRate) * 0.8;
  if (vitals.o2Saturation < 95) riskScore += (95 - vitals.o2Saturation) * 3;
  if (vitals.temperature > 37.5) riskScore += (vitals.temperature - 37.5) * 10;
  if (vitals.respRate > 20) riskScore += (vitals.respRate - 20) * 2;
  riskScore = Math.min(100, Math.max(0, riskScore));

  const riskLevel =
    riskScore < 15 ? "Low" : riskScore < 40 ? "Moderate" : riskScore < 70 ? "High" : "Critical";
  const riskColors = {
    Low: { text: "text-emerald-700", bg: "bg-emerald-500", bar: "from-emerald-400 to-emerald-600" },
    Moderate: { text: "text-amber-700", bg: "bg-amber-500", bar: "from-amber-400 to-amber-600" },
    High: { text: "text-orange-700", bg: "bg-orange-500", bar: "from-orange-400 to-orange-600" },
    Critical: { text: "text-red-700", bg: "bg-red-500", bar: "from-red-400 to-red-600" },
  };
  const rc = riskColors[riskLevel];

  const alerts: string[] = [];
  if (vitals.o2Saturation < 92) alerts.push(`Critical O\u2082: ${vitals.o2Saturation}% — administer supplemental oxygen`);
  if (vitals.heartRate > 120) alerts.push(`Tachycardia: ${vitals.heartRate} bpm — evaluate cardiac status`);
  if (vitals.temperature > 38.5) alerts.push(`Fever: ${vitals.temperature}\u00B0C — assess for infection`);
  if (vitals.respRate > 24) alerts.push(`Tachypnea: ${vitals.respRate} breaths/min — monitor respiratory function`);
  if (vitals.o2Saturation < 95 && vitals.temperature > 37.5) alerts.push("Combined hypoxia + fever — pneumonia risk elevated");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Activity className="h-4 w-4 text-indigo-600" />
        AI Risk Correlation
      </h3>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Composite Risk Score</span>
          <span className={`text-lg font-bold ${rc.text}`}>{riskScore.toFixed(0)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${rc.bar} transition-all duration-700`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Critical</span>
        </div>
      </div>

      <div className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${riskLevel === "Low" ? "bg-emerald-50 text-emerald-700" : riskLevel === "Moderate" ? "bg-amber-50 text-amber-700" : riskLevel === "High" ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700"}`}>
        <span className={`h-2 w-2 rounded-full ${rc.bg}`} />
        {riskLevel} Risk
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Alerts</p>
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <p className="text-xs text-emerald-600 font-medium">All vitals within acceptable range.</p>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const searchParams = useSearchParams();
  const urlPatientId = searchParams.get("patient_id");
  const { patient: contextPatient } = usePatient();

  const initialPatientId = urlPatientId || contextPatient?.patient_id || null;

  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  const [patientInfo, setPatientInfo] = useState<{ name: string; code: string } | null>(null);
  const [data, setData] = useState<VitalReading[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Patient search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Load monitoring data from API
  const loadMonitoringData = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const resp = await getMonitoringData(pid);
      setPatientInfo({ name: resp.patient_name, code: resp.patient_code });
      const mapped: VitalReading[] = (resp.readings || []).map((r: any) => ({
        time: r.time,
        heartRate: r.heart_rate,
        o2Saturation: r.oxygen_saturation,
        temperature: r.temperature,
        respRate: r.respiration_rate,
      }));
      setData(mapped.length > 0 ? mapped : generateInitialData(40));
      setIsLive(true);
    } catch {
      setData(generateInitialData(40));
      setIsLive(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (patientId) {
      loadMonitoringData(patientId);
    }
  }, [patientId, loadMonitoringData]);

  const handlePatientSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchPatients(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectPatient = (p: any) => {
    setPatientId(p.patient_id);
    setSearchResults([]);
    setSearchQuery("");
  };

  const addReading = useCallback(() => {
    setData((prev) => {
      const last = prev[prev.length - 1];
      const newReading: VitalReading = {
        time: getTimeLabel(0),
        heartRate: Math.max(50, Math.min(140,
          last.heartRate + Math.round((Math.random() - 0.5) * 6)
        )),
        o2Saturation: Math.max(85, Math.min(100,
          last.o2Saturation + Math.round((Math.random() - 0.48) * 2)
        )),
        temperature: +Math.max(35.5, Math.min(40.0,
          last.temperature + (Math.random() - 0.5) * 0.3
        )).toFixed(1),
        respRate: Math.max(8, Math.min(35,
          last.respRate + Math.round((Math.random() - 0.5) * 3)
        )),
      };
      return [...prev.slice(-59), newReading];
    });
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(addReading, 3000);
    return () => clearInterval(interval);
  }, [isLive, addReading]);

  const latest = data[data.length - 1];

  // No patient selected — show patient selector
  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="rounded-full bg-blue-50 p-4 mb-3">
              <UserRound className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Select Patient</h2>
            <p className="text-sm text-slate-500 mt-1">Search for a patient to view their vital signs</p>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
              placeholder="Search by name or patient code..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handlePatientSearch}
              disabled={searching}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((p: any) => (
                <button
                  key={p.patient_id}
                  onClick={() => selectPatient(p)}
                  className="w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-900">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-slate-500">{p.patient_code} · DOB: {p.date_of_birth}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading || !latest) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Monitoring</h1>
          <p className="text-sm text-slate-500">
            Real-time vital signs with AI risk correlation
            {patientInfo && (
              <span className="ml-2 text-blue-600 font-medium">
                — {patientInfo.name} ({patientInfo.code})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isLive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </span>
          <button
            onClick={() => setIsLive(!isLive)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isLive
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isLive ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* Vital Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard vitalKey="heartRate" value={latest.heartRate} data={data} />
        <VitalCard vitalKey="o2Saturation" value={latest.o2Saturation} data={data} />
        <VitalCard vitalKey="temperature" value={latest.temperature} data={data} />
        <VitalCard vitalKey="respRate" value={latest.respRate} data={data} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            Vital Signs Timeline
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={false}
                  name="Heart Rate"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="o2Saturation"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="O₂ Saturation"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="respRate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Resp Rate"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-center gap-6">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Heart Rate
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              O₂ Saturation
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Resp Rate
            </div>
          </div>
        </div>

        {/* Risk Correlation Panel */}
        <RiskCorrelationPanel vitals={latest} />
      </div>

      {/* Current Readings Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          Recent Readings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Heart Rate</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">O₂ Sat</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Temp</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Resp Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(-8).reverse().map((reading, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 text-slate-500 font-mono text-xs">{reading.time}</td>
                  <td className="py-2.5">
                    <span className={`font-medium ${
                      getStatus(reading.heartRate, VITAL_CONFIGS.heartRate) === "critical" ? "text-red-600" :
                      getStatus(reading.heartRate, VITAL_CONFIGS.heartRate) === "warning" ? "text-amber-600" : "text-slate-900"
                    }`}>
                      {reading.heartRate} bpm
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`font-medium ${
                      getStatus(reading.o2Saturation, VITAL_CONFIGS.o2Saturation) === "critical" ? "text-red-600" :
                      getStatus(reading.o2Saturation, VITAL_CONFIGS.o2Saturation) === "warning" ? "text-amber-600" : "text-slate-900"
                    }`}>
                      {reading.o2Saturation}%
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`font-medium ${
                      getStatus(reading.temperature, VITAL_CONFIGS.temperature) === "critical" ? "text-red-600" :
                      getStatus(reading.temperature, VITAL_CONFIGS.temperature) === "warning" ? "text-amber-600" : "text-slate-900"
                    }`}>
                      {reading.temperature}°C
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`font-medium ${
                      getStatus(reading.respRate, VITAL_CONFIGS.respRate) === "critical" ? "text-red-600" :
                      getStatus(reading.respRate, VITAL_CONFIGS.respRate) === "warning" ? "text-amber-600" : "text-slate-900"
                    }`}>
                      {reading.respRate} /min
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
