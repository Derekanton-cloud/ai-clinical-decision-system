"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Activity, ExternalLink, PieChart as PieChartIcon } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const monthlyStats = [
  { month: "Sep", predictions: 180, accuracy: 89 },
  { month: "Oct", predictions: 220, accuracy: 91 },
  { month: "Nov", predictions: 195, accuracy: 88 },
  { month: "Dec", predictions: 260, accuracy: 92 },
  { month: "Jan", predictions: 310, accuracy: 93 },
  { month: "Feb", predictions: 285, accuracy: 94 },
];

const diseaseAccuracy = [
  { disease: "Pneumonia", accuracy: 94 },
  { disease: "TB", accuracy: 89 },
  { disease: "COVID-19", accuracy: 91 },
  { disease: "Lung Cancer", accuracy: 86 },
  { disease: "Pleural Eff.", accuracy: 88 },
  { disease: "Normal", accuracy: 96 },
];

const modelPerformance = [
  { metric: "Sensitivity", value: 92 },
  { metric: "Specificity", value: 94 },
  { metric: "Precision", value: 91 },
  { metric: "F1-Score", value: 91 },
  { metric: "AUC-ROC", value: 95 },
  { metric: "Accuracy", value: 93 },
];

const diseaseDistribution = [
  { name: "Pneumonia", value: 58, color: "#3b82f6" },
  { name: "COVID-19", value: 21, color: "#8b5cf6" },
  { name: "TB", value: 14, color: "#f59e0b" },
  { name: "Normal", value: 7, color: "#22c55e" },
];

const confidenceHistogram = [
  { range: "50-60%", count: 12 },
  { range: "60-70%", count: 45 },
  { range: "70-80%", count: 120 },
  { range: "80-90%", count: 380 },
  { range: "90-95%", count: 520 },
  { range: "95-100%", count: 373 },
];

const riskDistribution = [
  { level: "Low", count: 580, color: "#22c55e" },
  { level: "Moderate", count: 420, color: "#f59e0b" },
  { level: "High", count: 310, color: "#f97316" },
  { level: "Critical", count: 140, color: "#ef4444" },
];

export default function AnalyticsPage() {
  const powerBIUrl = process.env.NEXT_PUBLIC_POWERBI_EMBED_URL || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">
          Prediction statistics, disease distribution, and model performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-blue-50 p-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">93.2%</p>
            <p className="text-sm text-gray-500">Overall Accuracy</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-green-50 p-3">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">1,450</p>
            <p className="text-sm text-gray-500">Total Predictions</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-5 shadow-sm">
          <div className="rounded-lg bg-purple-50 p-3">
            <Activity className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">4.2ms</p>
            <p className="text-sm text-gray-500">Avg. Inference Time</p>
          </div>
        </div>
      </div>

      {/* Disease Distribution + Confidence Histogram */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Disease Distribution Pie */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            Disease Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={diseaseDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {diseaseDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Confidence Histogram */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Model Confidence Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Risk Levels */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Risk Level Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          {riskDistribution.map((item) => (
            <div key={item.level} className="text-center">
              <div
                className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <span className="text-lg font-bold" style={{ color: item.color }}>
                  {item.count}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{item.level}</p>
              <p className="text-xs text-gray-500">
                {((item.count / 1450) * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 h-4 flex overflow-hidden rounded-full">
          {riskDistribution.map((item) => (
            <div
              key={item.level}
              className="h-full transition-all"
              style={{
                width: `${(item.count / 1450) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-400">
          <span>Low ({((580 / 1450) * 100).toFixed(0)}%)</span>
          <span>Moderate ({((420 / 1450) * 100).toFixed(0)}%)</span>
          <span>High ({((310 / 1450) * 100).toFixed(0)}%)</span>
          <span>Critical ({((140 / 1450) * 100).toFixed(0)}%)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Predictions & Accuracy */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Monthly Predictions & Accuracy
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[80, 100]} />
                <Tooltip />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="predictions"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="accuracy"
                  fill="#22c55e"
                  fillOpacity={0.1}
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-6">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Predictions
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              Accuracy (%)
            </div>
          </div>
        </div>

        {/* Model Performance Radar */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Model Performance
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={modelPerformance}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  dataKey="value"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Disease-wise Accuracy */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Disease-wise Accuracy
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diseaseAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="disease" />
              <YAxis domain={[70, 100]} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power BI Embed */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Power BI Dashboard
          </h3>
          <a
            href="#"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Open in Power BI <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {powerBIUrl ? (
          <iframe
            title="Power BI Dashboard"
            src={powerBIUrl}
            width="100%"
            height="700"
            className="rounded-lg border"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
            <div className="text-center">
              <BarChart3 className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                Power BI Report Embed Area
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Configure your Power BI embed URL in environment variables to display
                interactive analytics here.
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Set <code className="rounded bg-gray-200 px-1.5 py-0.5">NEXT_PUBLIC_POWERBI_EMBED_URL</code> to enable
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Data source: <code className="rounded bg-gray-200 px-1.5 py-0.5">data/prediction_logs.csv</code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
