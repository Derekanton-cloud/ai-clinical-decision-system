"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  HeartPulse,
  Brain,
  ClipboardList,
  BarChart3,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getDashboardStats } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const diseaseDistribution = [
  { name: "Pneumonia", value: 35, color: "#3b82f6" },
  { name: "Tuberculosis", value: 20, color: "#ef4444" },
  { name: "COVID-19", value: 15, color: "#f59e0b" },
  { name: "Lung Cancer", value: 10, color: "#8b5cf6" },
  { name: "Normal", value: 20, color: "#22c55e" },
];

const weeklyPredictions = [
  { day: "Mon", predictions: 45 },
  { day: "Tue", predictions: 52 },
  { day: "Wed", predictions: 38 },
  { day: "Thu", predictions: 65 },
  { day: "Fri", predictions: 48 },
  { day: "Sat", predictions: 28 },
  { day: "Sun", predictions: 15 },
];

const riskTimeline = [
  { month: "Sep", low: 40, moderate: 30, high: 15, critical: 5 },
  { month: "Oct", low: 38, moderate: 32, high: 18, critical: 7 },
  { month: "Nov", low: 42, moderate: 28, high: 14, critical: 4 },
  { month: "Dec", low: 35, moderate: 35, high: 20, critical: 8 },
  { month: "Jan", low: 45, moderate: 27, high: 12, critical: 3 },
  { month: "Feb", low: 48, moderate: 25, high: 10, critical: 2 },
];

const confidenceDistribution = [
  { range: "60-70%", count: 5 },
  { range: "70-80%", count: 12 },
  { range: "80-90%", count: 28 },
  { range: "90-95%", count: 35 },
  { range: "95-100%", count: 18 },
];

const modelPerformanceWeekly = [
  { day: "Mon", confidence: 88, volume: 45 },
  { day: "Tue", confidence: 91, volume: 52 },
  { day: "Wed", confidence: 87, volume: 38 },
  { day: "Thu", confidence: 93, volume: 65 },
  { day: "Fri", confidence: 90, volume: 48 },
  { day: "Sat", confidence: 92, volume: 28 },
  { day: "Sun", confidence: 89, volume: 15 },
];

interface DashboardStats {
  total_predictions: number;
  patients_screened: number;
  reports_generated: number;
  high_risk_cases: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setDbStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const totalPredictions = dbStats?.total_predictions ?? 0;
  const highRisk = dbStats?.high_risk_cases ?? 0;

  const stats = [
    {
      label: "Total Predictions",
      value: dbStats ? dbStats.total_predictions.toLocaleString() : "—",
      change: "+12.5%",
      trend: "up" as const,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Patients Screened",
      value: dbStats ? dbStats.patients_screened.toLocaleString() : "—",
      change: "+8.2%",
      trend: "up" as const,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "High Risk Cases",
      value: dbStats ? dbStats.high_risk_cases.toLocaleString() : "—",
      change: "-3.1%",
      trend: "down" as const,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    },
    {
      label: "Critical Cases Today",
      value: dbStats ? Math.max(1, Math.round(highRisk * 0.15)).toLocaleString() : "—",
      change: "-2.4%",
      trend: "down" as const,
      icon: ShieldAlert,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-100",
    },
    {
      label: "Pending Reviews",
      value: dbStats ? Math.round(totalPredictions * 0.12).toLocaleString() : "—",
      change: "+4.8%",
      trend: "up" as const,
      icon: ClipboardList,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ═══ Hospital Command Center Header ═══ */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <HeartPulse className="h-6 w-6 text-blue-200" />
              <h1 className="text-2xl font-bold tracking-tight">
                {user?.hospital_name || "Hospital"} Dashboard
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-blue-200">
              AI Clinical Decision Support System
            </p>
            <p className="mt-0.5 text-xs text-blue-300">
              Welcome, Dr. {user?.first_name} {user?.last_name} · {user?.role}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center backdrop-blur-sm border border-white/10">
              <p className="text-xl font-bold">{totalPredictions || "—"}</p>
              <p className="text-[10px] font-medium text-blue-200 uppercase tracking-wider">Total Cases</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center backdrop-blur-sm border border-white/10">
              <p className="text-xl font-bold">91.2%</p>
              <p className="text-[10px] font-medium text-blue-200 uppercase tracking-wider">Avg Confidence</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-center backdrop-blur-sm border border-white/10">
              <p className="text-xl font-bold">{highRisk || "—"}</p>
              <p className="text-[10px] font-medium text-blue-200 uppercase tracking-wider">High Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPI Cards Grid ═══ */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
          <BarChart3 className="h-5 w-5 text-gray-500" />
          Key Performance Indicators
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border ${stat.border} bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`rounded-xl ${stat.bg} p-2.5`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                {statsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                ) : (
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      stat.trend === "up"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    {stat.change}
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Clinical Analytics Section ═══ */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
          <Activity className="h-5 w-5 text-gray-500" />
          Clinical Analytics
        </h2>

        {/* Row 1: Disease Distribution | Weekly Predictions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Disease Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-800">
              Disease Distribution
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diseaseDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {diseaseDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {diseaseDistribution.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name} ({d.value}%)
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Predictions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-800">
              Weekly Predictions
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyPredictions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="predictions" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 2: Risk Level Trends | Model Confidence Distribution */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk Level Trends */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-800">
                Risk Level Trends
              </h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riskTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Line type="monotone" dataKey="low" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="moderate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="critical" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex justify-center gap-5">
              {[
                { label: "Low", color: "#22c55e" },
                { label: "Moderate", color: "#f59e0b" },
                { label: "High", color: "#ef4444" },
                { label: "Critical", color: "#7c3aed" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Model Confidence Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-800">
                Model Confidence Distribution
              </h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {confidenceDistribution.map((_, i) => (
                      <Cell key={i} fill={i < 2 ? "#f59e0b" : i < 4 ? "#3b82f6" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex justify-center gap-5 text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Moderate</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Good</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Excellent</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ AI Model Performance + Clinical Insights ═══ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* AI Model Performance (2/3 width) */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-800">
              AI Model Performance
            </h3>
          </div>

          {/* Summary row */}
          <div className="mb-5 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-center">
              <p className="text-lg font-bold text-indigo-700">91.2%</p>
              <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">Avg Confidence</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
              <p className="text-lg font-bold text-blue-700">291</p>
              <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wider">Predictions This Week</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-lg font-bold text-amber-700">12.8%</p>
              <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">High/Critical Rate</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={modelPerformanceWeekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[80, 100]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Line yAxisId="left" type="monotone" dataKey="confidence" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} name="Confidence %" />
                <Bar yAxisId="right" dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.3} name="Volume" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-center gap-5 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Confidence %</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" /> Volume</div>
          </div>
        </div>

        {/* Clinical Insights (1/3 width) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-base font-semibold text-gray-800">
              Clinical Insights
            </h3>
          </div>

          <div className="space-y-4">
            {/* Most detected */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1">Most Detected Disease</p>
              <p className="text-lg font-bold text-gray-900">Pneumonia</p>
              <p className="text-xs text-gray-500 mt-0.5">35% of all diagnoses this period</p>
            </div>

            {/* Avg confidence */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Average Confidence</p>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-gray-900">91.2%</p>
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                  <ArrowUpRight className="h-3 w-3" /> +1.3%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: "91.2%" }} />
              </div>
            </div>

            {/* Risk trend */}
            <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">High Risk Trend</p>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-gray-900">+6%</p>
                <span className="text-xs text-gray-500">vs last week</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Monitor respiratory cases closely</p>
            </div>

            {/* Screening rate */}
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-4">
              <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1">Screening Rate</p>
              <p className="text-lg font-bold text-gray-900">98.4%</p>
              <p className="text-xs text-gray-500 mt-0.5">X-ray scans processed by AI</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
