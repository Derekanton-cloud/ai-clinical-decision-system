"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2, Play, ShieldCheck, WifiOff } from "lucide-react";
import { checkBackendHealth, demoLogin, login, getHospitals } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { loginUser } = useAuth();
  const [hospitals, setHospitals] = useState<{ hospital_id: string; hospital_name: string; city: string }[]>([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    password: "",
    role: "Radiologist",
    hospital: "",
  });
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    getHospitals()
      .then(setHospitals)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 120_000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const probe = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const healthy = await checkBackendHealth(controller.signal);
      clearTimeout(timeout);
      if (cancelled) return;
      if (healthy) {
        setBackendStatus("ready");
        return;
      }
      if (Date.now() >= deadline) {
        setBackendStatus("unavailable");
        return;
      }
      setBackendStatus("checking");
      timer = setTimeout(probe, 5_000);
    };

    probe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(form);
      loginUser(res.token, {
        user_id: res.user_id,
        first_name: res.first_name,
        last_name: res.last_name,
        role: res.role,
        hospital_id: res.hospital_id,
        hospital_name: res.hospital_name,
      });
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (loading || demoLoading || backendStatus !== "ready") return;
    setError("");
    setDemoLoading(true);
    try {
      // A retry is safe: demo provisioning is idempotent and every success
      // returns a fresh normal JWT for the same fictional clinician.
      let res;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);
          res = await demoLogin(controller.signal);
          clearTimeout(timeout);
          break;
        } catch (requestError) {
          lastError = requestError;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 3_000));
        }
      }
      if (!res) throw lastError instanceof Error ? lastError : new Error("Demo login is unavailable. Please try again shortly.");
      loginUser(res.token, {
        user_id: res.user_id,
        first_name: res.first_name,
        last_name: res.last_name,
        role: res.role,
        hospital_id: res.hospital_id,
        hospital_name: res.hospital_name,
      });
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ClinicalAI</h1>
          <p className="mt-2 text-sm text-blue-200">
            AI Clinical Decision Support System
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Doctor Login</h2>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {backendStatus === "checking" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Starting ClinicalAI services. This may take up to a minute.
            </div>
          )}
          {backendStatus === "unavailable" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <WifiOff className="h-4 w-4 shrink-0" />
              ClinicalAI services are still unavailable. You can use normal sign-in later or refresh to try Demo Bypass again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-blue-200">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-blue-200">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Radiologist" className="bg-slate-900">Radiologist</option>
                <option value="Physician" className="bg-slate-900">Physician</option>
                <option value="Surgeon" className="bg-slate-900">Surgeon</option>
                <option value="Specialist" className="bg-slate-900">Specialist</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200">
                Hospital
              </label>
              <select
                required
                value={form.hospital}
                onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" className="bg-slate-900">Select Hospital</option>
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_name} className="bg-slate-900">
                    {h.hospital_name} — {h.city}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-blue-200/50">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading || demoLoading || backendStatus !== "ready"}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-gradient-to-r from-cyan-500/20 to-blue-600/30 px-4 py-3 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-900/20 transition-all hover:border-cyan-300/60 hover:from-cyan-500/30 hover:to-blue-600/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            {demoLoading ? "Entering Demo Mode..." : backendStatus === "checking" ? "Starting Demo Services..." : "Demo Bypass"}
          </button>
          <p className="mt-2 text-center text-xs text-blue-200/70">
            Explore the dashboard using a preconfigured demonstration account.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-blue-300/50">
          Secure hospital authentication system
        </p>
      </div>
    </div>
  );
}
