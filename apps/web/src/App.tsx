import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Download, HeartPulse, LogOut, Plus, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Modal } from "./components/ui/modal";
import { cn } from "./lib/utils";

type Risk = "low" | "watch" | "high" | "urgent";
type Advice = {
  label: string;
  riskLevel: Risk;
  summary: string;
  dos: string[];
  donts: string[];
  seekCare: string;
};
type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  takenAt: string;
  context?: string;
  symptoms: string[];
  advice: Advice;
};
type User = {
  id: string;
  name: string;
  email: string;
};
type AuthResponse = {
  token: string;
  user: User;
};

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const symptomOptions = [
  ["chest_pain", "Chest pain"],
  ["shortness_of_breath", "Shortness of breath"],
  ["weakness", "Weakness"],
  ["vision_changes", "Vision changes"],
  ["difficulty_speaking", "Difficulty speaking"]
];

const riskClasses: Record<Risk, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  urgent: "border-red-200 bg-red-50 text-red-700"
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("hypercare_token") ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [form, setForm] = useState({ systolic: "136", diastolic: "84", pulse: "78", context: "", symptoms: [] as string[] });

  useEffect(() => {
    if (!token) return;
    void loadSession(token);
  }, [token]);

  async function apiRequest<T>(path: string, options: RequestInit = {}, authToken = token): Promise<T> {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers
      }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? "Request failed");
    return payload as T;
  }

  async function loadSession(authToken: string) {
    setIsLoading(true);
    setError("");
    try {
      const currentUser = await apiRequest<User>("/me", {}, authToken);
      const apiReadings = await apiRequest<Reading[]>("/readings", {}, authToken);
      setUser(currentUser);
      setReadings(apiReadings);
    } catch (requestError) {
      localStorage.removeItem("hypercare_token");
      setToken("");
      setUser(null);
      setReadings([]);
      setError(requestError instanceof Error ? requestError.message : "Session expired");
    } finally {
      setIsLoading(false);
    }
  }

  function saveAuth(auth: AuthResponse) {
    localStorage.setItem("hypercare_token", auth.token);
    setToken(auth.token);
    setUser(auth.user);
    void loadSession(auth.token);
  }

  function logout() {
    localStorage.removeItem("hypercare_token");
    setToken("");
    setUser(null);
    setReadings([]);
    setError("");
  }

  async function submitReading(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const reading = await apiRequest<Reading>("/readings", {
        method: "POST",
        body: JSON.stringify({
          systolic: Number(form.systolic),
          diastolic: Number(form.diastolic),
          pulse: form.pulse ? Number(form.pulse) : undefined,
          takenAt: new Date().toISOString(),
          context: form.context,
          symptoms: form.symptoms
        })
      });
      setReadings((items) => [reading, ...items]);
      setForm((current) => ({ ...current, context: "", symptoms: [] }));
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save reading");
      return false;
    }
  }

  function toggleSymptom(value: string) {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(value) ? current.symptoms.filter((symptom) => symptom !== value) : [...current.symptoms, value]
    }));
  }

  function exportCsv() {
    const header = "date,systolic,diastolic,pulse,category,notes";
    const rows = readings.map((reading) => [
      new Date(reading.takenAt).toISOString(),
      reading.systolic,
      reading.diastolic,
      reading.pulse ?? "",
      reading.advice.label,
      `"${(reading.context ?? "").replace(/"/g, "\"\"")}"`
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "blood-pressure-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!token || !user) {
    return <AuthScreen error={error} isLoading={isLoading} onAuth={saveAuth} />;
  }

  return (
    <Dashboard
      error={error}
      form={form}
      isLoading={isLoading}
      readings={readings}
      user={user}
      onExport={exportCsv}
      onFormChange={setForm}
      onLogout={logout}
      onSubmit={submitReading}
      onToggleSymptom={toggleSymptom}
    />
  );
}

function AuthScreen({ error, isLoading, onAuth }: { error: string; isLoading: boolean; onAuth: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");

    if (mode === "register" && form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const body = mode === "register"
        ? form
        : { email: form.email, password: form.password };
      const response = await fetch(`${apiBase}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Authentication failed");
      onAuth(payload as AuthResponse);
    } catch (requestError) {
      setLocalError(requestError instanceof Error ? requestError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_12%_10%,_rgba(13,148,136,0.16),_transparent_32%),radial-gradient(circle_at_88%_20%,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef7f4_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex min-h-[560px] flex-col justify-between overflow-hidden rounded-lg border bg-white shadow-sm">
          <div>
            <div className="border-b bg-teal-50/70 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <HeartPulse className="h-7 w-7" />
              </div>
            </div>
            <div className="p-6">
              <Badge className={riskClasses.low}>Personal BP workspace</Badge>
              <h1 className="mt-4 text-4xl font-semibold tracking-normal text-slate-950">hyperCare</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Track home blood pressure readings, keep clinician-ready history, and receive safety-bounded guidance from the API after every saved reading.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Records</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">API only</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Guidance</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">Guarded</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 border-t bg-slate-50/80 p-6 text-sm text-slate-700">
            {["Authenticated patient accounts", "API-owned readings and advice", "Emergency-aware guidance rules"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{mode === "register" ? "Create Account" : "Welcome Back"}</CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mode === "register" ? "Create your private tracking space." : "Continue tracking with your saved records."}
                </p>
              </div>
              <Badge className={riskClasses.watch}>API required</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitAuth}>
              {mode === "register" && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Full name</span>
                  <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </label>
              )}
              <label className="block space-y-2">
                <span className="text-sm font-medium">Email</span>
                <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Password</span>
                <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
              </label>
              {mode === "register" && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Confirm password</span>
                  <Input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required minLength={8} />
                </label>
              )}
              {(localError || error) && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError || error}</p>}
              <Button className="w-full" type="submit" disabled={submitting || isLoading}>
                {submitting ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
              </Button>
            </form>
            <Button className="mt-4 w-full" type="button" variant="outline" onClick={() => setMode(mode === "register" ? "login" : "register")}>
              {mode === "register" ? "Use an existing account" : "Create a new account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Dashboard({
  error,
  form,
  isLoading,
  readings,
  user,
  onExport,
  onFormChange,
  onLogout,
  onSubmit,
  onToggleSymptom
}: {
  error: string;
  form: { systolic: string; diastolic: string; pulse: string; context: string; symptoms: string[] };
  isLoading: boolean;
  readings: Reading[];
  user: User;
  onExport: () => void;
  onFormChange: (form: { systolic: string; diastolic: string; pulse: string; context: string; symptoms: string[] }) => void;
  onLogout: () => void;
  onSubmit: (event: React.FormEvent) => Promise<boolean>;
  onToggleSymptom: (value: string) => void;
}) {
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const latest = readings[0];
  const average = useMemo(() => {
    if (readings.length === 0) return { systolic: 0, diastolic: 0 };
    return {
      systolic: Math.round(readings.reduce((sum, item) => sum + item.systolic, 0) / readings.length),
      diastolic: Math.round(readings.reduce((sum, item) => sum + item.diastolic, 0) / readings.length)
    };
  }, [readings]);
  const chartData = useMemo(() => [...readings].reverse().map((reading) => ({
    date: new Date(reading.takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    systolic: reading.systolic,
    diastolic: reading.diastolic
  })), [readings]);
  const highCount = readings.filter((reading) => reading.advice.riskLevel === "high" || reading.advice.riskLevel === "urgent").length;
  const hasReadings = readings.length > 0;

  function openLogModal() {
    setIsLogModalOpen(true);
  }

  async function submitAndClose(event: React.FormEvent) {
    const saved = await onSubmit(event);
    if (saved) setIsLogModalOpen(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,_rgba(13,148,136,0.12),_transparent_28%),radial-gradient(circle_at_95%_8%,_rgba(14,165,233,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef7f4_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 -mx-4 flex flex-col gap-4 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">hyperCare</h1>
              <p className="text-sm text-muted-foreground">{user.name} · {user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={riskClasses.low}>API synced</Badge>
            <Button onClick={openLogModal}><Plus className="h-4 w-4" />Log reading</Button>
            <Button variant="outline" onClick={onExport} disabled={readings.length === 0}><Download className="h-4 w-4" />Export CSV</Button>
            <Button variant="ghost" onClick={onLogout}><LogOut className="h-4 w-4" />Log out</Button>
          </div>
        </header>

        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!hasReadings && (
          <section className="grid gap-4 rounded-lg border border-teal-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2">
              <Badge className={riskClasses.watch}>First login</Badge>
              <h2 className="text-xl font-semibold tracking-normal text-slate-950">Start with your first blood pressure reading</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Your dashboard is ready. Add one reading to unlock the trend chart, recent history, and API-generated safety guidance.
              </p>
              <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-slate-50 px-2.5 py-1">Takes under 30 seconds</span>
                <span className="rounded-full border bg-slate-50 px-2.5 py-1">Saved to your account</span>
                <span className="rounded-full border bg-slate-50 px-2.5 py-1">Guidance appears instantly</span>
              </div>
            </div>
            <Button className="h-11 px-5" onClick={openLogModal}>
              <Plus className="h-4 w-4" />
              Log first reading
            </Button>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <Metric icon={Activity} label="Latest reading" value={latest ? `${latest.systolic}/${latest.diastolic}` : "--"} helper={latest?.advice.label ?? "No readings yet"} tone={latest?.advice.riskLevel ?? "watch"} />
          <Metric icon={CalendarDays} label="Average" value={readings.length ? `${average.systolic}/${average.diastolic}` : "--"} helper="Based on saved API readings" tone="low" />
          <Metric icon={AlertTriangle} label="High readings" value={String(highCount)} helper="Stage 2 or severe" tone={highCount > 0 ? "high" : "low"} />
          <Metric icon={ShieldCheck} label="Technique checks" value="6/6" helper="Before each measure" tone="watch" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader><CardTitle>Reading Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[60, 170]} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #dbe3ea" }} />
                      <Line type="monotone" dataKey="systolic" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="diastolic" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="No trend yet"
                    text="Save your first reading and the chart will start tracking systolic and diastolic changes."
                    actionLabel="Log first reading"
                    onAction={openLogModal}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border-2", latest ? riskClasses[latest.advice.riskLevel] : riskClasses.watch)}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Guidance</CardTitle>
                <Badge className={latest ? riskClasses[latest.advice.riskLevel] : riskClasses.watch}>{latest?.advice.label ?? "Awaiting reading"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latest ? (
                <>
                  <p className="text-sm leading-6 text-slate-700">{latest.advice.summary}</p>
                  <AdviceList title="Do" items={latest.advice.dos} positive />
                  <AdviceList title="Don't" items={latest.advice.donts} />
                  <div className="rounded-md border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">{latest.advice.seekCare}</div>
                </>
              ) : (
                <EmptyState
                  title="Guidance starts after logging"
                  text="The API classifies each saved reading and returns do's, don'ts, and care guidance."
                  actionLabel="Log reading"
                  onAction={openLogModal}
                />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Measurement Coach</CardTitle>
                <Button type="button" onClick={openLogModal}>
                  <Plus className="h-4 w-4" />
                  Log reading
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Rest 5 minutes", "Feet flat, legs uncrossed", "Arm supported at chest height", "Cuff on bare skin", "No talking", "Avoid caffeine, alcohol, smoking, or exercise 30 minutes before"].map((item) => (
                  <div key={item} className="flex min-h-14 items-center gap-3 rounded-md border bg-white p-3">
                    <CheckCircle2 className="h-5 w-5 flex-none text-primary" />
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" />Recent Readings</CardTitle></CardHeader>
          <CardContent>
            {readings.length === 0 ? (
              <EmptyState
                title="No readings saved yet"
                text="After you save a reading, it will appear here with its category, notes, and timestamp."
                actionLabel="Log first reading"
                onAction={openLogModal}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1fr_0.75fr_0.7fr] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500 sm:grid-cols-[1fr_0.75fr_0.7fr_1fr_1.3fr]">
                  <span>Date</span><span>BP</span><span>Pulse</span><span className="hidden sm:block">Status</span><span className="hidden sm:block">Notes</span>
                </div>
                {readings.map((reading) => (
                  <div key={reading.id} className="grid grid-cols-[1fr_0.75fr_0.7fr] items-center border-t bg-white px-4 py-3 text-sm sm:grid-cols-[1fr_0.75fr_0.7fr_1fr_1.3fr]">
                    <span className="font-medium">{new Date(reading.takenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    <span>{reading.systolic}/{reading.diastolic}</span>
                    <span>{reading.pulse ?? "-"}</span>
                    <span className="hidden sm:block"><Badge className={riskClasses[reading.advice.riskLevel]}>{reading.advice.label}</Badge></span>
                    <span className="hidden truncate text-muted-foreground sm:block">{reading.context || reading.advice.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={isLogModalOpen} title="Log Blood Pressure" onClose={() => setIsLogModalOpen(false)}>
        <form className="space-y-4" onSubmit={submitAndClose}>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Before measuring</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {["Rested 5 minutes", "Arm supported", "Feet flat", "Cuff on bare skin"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Systolic" value={form.systolic} onChange={(value) => onFormChange({ ...form, systolic: value })} emphasis />
            <Field label="Diastolic" value={form.diastolic} onChange={(value) => onFormChange({ ...form, diastolic: value })} emphasis />
            <Field label="Pulse" value={form.pulse} onChange={(value) => onFormChange({ ...form, pulse: value })} emphasis />
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Context</span>
            <Input value={form.context} onChange={(event) => onFormChange({ ...form, context: event.target.value })} placeholder="Stress, caffeine, sleep, medication..." />
          </label>
          <div className="space-y-3">
            <p className="text-sm font-medium">Symptoms</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {symptomOptions.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm">
                  <Checkbox checked={form.symptoms.includes(value)} onChange={() => onToggleSymptom(value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsLogModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}><Plus className="h-4 w-4" />Save reading through API</Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

function Metric({ icon: Icon, label, value, helper, tone }: { icon: typeof Activity; label: string; value: string; helper: string; tone: Risk }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-md border", riskClasses[tone])}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, emphasis = false }: { label: string; value: string; onChange: (value: string) => void; emphasis?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input className={cn(emphasis && "h-12 text-lg font-semibold")} inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function AdviceList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm text-slate-700">
            <span className={positive ? "text-primary" : "text-orange-600"}>*</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-white p-6 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
      {actionLabel && onAction && (
        <Button type="button" size="sm" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
