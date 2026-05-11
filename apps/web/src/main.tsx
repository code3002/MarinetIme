import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Anchor, ClipboardCheck, Flame, LogOut, ShipWheel, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, tokenStore } from "./api/client";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input, Select, Textarea } from "./components/ui/input";
import type { ComplianceSummary, MaintenanceTask, SafetyDrill, Ship, User } from "./types";
import "./styles.css";

type View = "dashboard" | "maintenance" | "drills" | "crew";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function isPast(value: string) {
  return new Date(value).getTime() < Date.now();
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<User>("/auth/me").then(setUser).catch(() => tokenStore.clear());
  }, []);

  if (!user) return <Login onLogin={setUser} error={error} setError={setError} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Anchor size={24} /> Maritime Ops</div>
        <Button variant="ghost" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><ShipWheel size={18} /> Dashboard</Button>
        <Button variant="ghost" className={view === "maintenance" ? "active" : ""} onClick={() => setView("maintenance")}><Wrench size={18} /> Maintenance</Button>
        <Button variant="ghost" className={view === "drills" ? "active" : ""} onClick={() => setView("drills")}><Flame size={18} /> Drills</Button>
        <Button variant="ghost" className={view === "crew" ? "active" : ""} onClick={() => setView("crew")}><ClipboardCheck size={18} /> Crew</Button>
        <Button variant="ghost" className="logout" onClick={() => { tokenStore.clear(); setUser(null); }}><LogOut size={18} /> Logout</Button>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user.role}</span>
            <h1>{view === "dashboard" ? "Compliance Dashboard" : view[0].toUpperCase() + view.slice(1)}</h1>
          </div>
          <Badge variant="secondary">{user.name}</Badge>
        </header>
        {view === "dashboard" && <Dashboard />}
        {view === "maintenance" && <Maintenance user={user} />}
        {view === "drills" && <Drills user={user} />}
        {view === "crew" && <CrewDashboard />}
      </section>
    </main>
  );
}

function Login({ onLogin, error, setError }: { onLogin: (user: User) => void; error: string; setError: (value: string) => void }) {
  const [email, setEmail] = useState("admin@maritime.test");
  const [password, setPassword] = useState("Admin123!");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      tokenStore.set(result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand large"><Anchor size={28} /> Maritime Ops</div>
        <h1>Operations & Compliance</h1>
        <label>Email<Input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <Button>Sign in</Button>
        <p className="hint">Seed users: admin@maritime.test / Admin123! or crew@maritime.test / Crew123!</p>
      </form>
    </main>
  );
}

function Dashboard() {
  const [data, setData] = useState<{ fleet: ComplianceSummary; ships: Array<{ ship: Ship; summary: ComplianceSummary }> } | null>(null);
  useEffect(() => { api<typeof data>("/compliance/dashboard").then(setData); }, []);
  if (!data) return <Card>Loading dashboard...</Card>;

  const chartData = data.ships.map(({ ship, summary }) => ({
    ship: ship.name,
    Maintenance: summary.maintenanceCompliance,
    Drills: summary.drillParticipation,
    Overall: summary.overallCompliance
  }));

  return (
    <>
      <div className="stat-grid">
        <Stat title="Overall compliance" value={`${data.fleet.overallCompliance}%`} tone={data.fleet.overallCompliance < 75 ? "risk" : "good"} />
        <Stat title="Overdue maintenance" value={data.fleet.overdueMaintenance} tone={data.fleet.overdueMaintenance ? "risk" : "good"} />
        <Stat title="Missed drills" value={data.fleet.missedDrills} tone={data.fleet.missedDrills ? "risk" : "good"} />
        <Stat title="Completed tasks" value={`${data.fleet.completedMaintenance}/${data.fleet.totalMaintenance}`} />
      </div>
      <Card className="chart-panel">
        <CardHeader><CardTitle>Ship compliance</CardTitle></CardHeader>
        <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ship" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="Maintenance" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Drills" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Overall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}

function Maintenance({ user }: { user: User }) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", shipId: "" });

  const load = () => api<MaintenanceTask[]>(`/maintenance${status ? `?status=${status}` : ""}`).then(setTasks);
  useEffect(() => { load(); api<Ship[]>("/ships").then(setShips); }, [status]);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    await api("/maintenance", { method: "POST", body: JSON.stringify({ ...form, dueDate: new Date(form.dueDate).toISOString() }) });
    setForm({ title: "", description: "", dueDate: "", shipId: "" });
    load();
  }

  async function updateStatus(id: string, nextStatus: string) {
    await api(`/maintenance/${id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    load();
  }

  return (
    <div className="two-column">
      <Card>
        <CardHeader className="panel-header"><CardTitle>Tasks</CardTitle><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option>PENDING</option><option>IN_PROGRESS</option><option>COMPLETED</option></Select></CardHeader>
        <CardContent>
        <div className="list">
          {tasks.map((task) => (
            <article className={`row-card ${task.status !== "COMPLETED" && isPast(task.dueDate) ? "danger" : ""}`} key={task.id}>
              <div><h3>{task.title}</h3><p>{task.ship.name} · Due {formatDate(task.dueDate)}</p></div>
              <Select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value)}>
                <option>PENDING</option><option>IN_PROGRESS</option><option>COMPLETED</option>
              </Select>
            </article>
          ))}
        </div>
        </CardContent>
      </Card>
      {user.role === "ADMIN" && (
        <form className="panel form-panel" onSubmit={createTask}>
          <h2>Create maintenance</h2>
          <Input placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
          <Select value={form.shipId} onChange={(e) => setForm({ ...form, shipId: e.target.value })} required>
            <option value="">Select ship</option>
            {ships.map((ship) => <option key={ship.id} value={ship.id}>{ship.name}</option>)}
          </Select>
          <Button>Create task</Button>
        </form>
      )}
    </div>
  );
}

function Drills({ user }: { user: User }) {
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [form, setForm] = useState({ title: "", type: "Fire Drill", scheduledDate: "", shipId: "" });
  const load = () => api<SafetyDrill[]>("/drills").then(setDrills);
  useEffect(() => { load(); api<Ship[]>("/ships").then(setShips); }, []);

  async function createDrill(event: React.FormEvent) {
    event.preventDefault();
    await api("/drills", { method: "POST", body: JSON.stringify({ ...form, scheduledDate: new Date(form.scheduledDate).toISOString() }) });
    setForm({ title: "", type: "Fire Drill", scheduledDate: "", shipId: "" });
    load();
  }

  async function attend(id: string) {
    await api(`/drills/${id}/attendance`, { method: "POST", body: JSON.stringify({ attended: true }) });
    load();
  }

  return (
    <div className="two-column">
      <Card>
        <CardHeader><CardTitle>Safety drills</CardTitle></CardHeader>
        <CardContent>
        <div className="list">
          {drills.map((drill) => (
            <article className={`row-card ${drill.status !== "COMPLETED" && isPast(drill.scheduledDate) ? "danger" : ""}`} key={drill.id}>
              <div><h3>{drill.title}</h3><p>{drill.ship.name} · {drill.type} · {formatDate(drill.scheduledDate)}</p></div>
              {user.role === "CREW" ? <Button variant="secondary" onClick={() => attend(drill.id)}>Attend</Button> : <Badge>{drill.status}</Badge>}
            </article>
          ))}
        </div>
        </CardContent>
      </Card>
      {user.role === "ADMIN" && (
        <form className="panel form-panel" onSubmit={createDrill}>
          <h2>Schedule drill</h2>
          <Input placeholder="Drill title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Fire Drill</option><option>Evacuation</option><option>Man Overboard</option></Select>
          <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required />
          <Select value={form.shipId} onChange={(e) => setForm({ ...form, shipId: e.target.value })} required>
            <option value="">Select ship</option>
            {ships.map((ship) => <option key={ship.id} value={ship.id}>{ship.name}</option>)}
          </Select>
          <Button>Schedule drill</Button>
        </form>
      )}
    </div>
  );
}

function CrewDashboard() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  useEffect(() => { api<MaintenanceTask[]>("/maintenance").then(setTasks); api<SafetyDrill[]>("/drills").then(setDrills); }, []);

  const overdue = useMemo(() => tasks.filter((task) => task.status !== "COMPLETED" && isPast(task.dueDate)), [tasks]);
  const upcoming = useMemo(() => drills.filter((drill) => !isPast(drill.scheduledDate)), [drills]);

  return (
    <div className="two-column">
      <Card><CardHeader><CardTitle>Assigned maintenance</CardTitle></CardHeader><CardContent>{tasks.map((task) => <p className="compact" key={task.id}>{task.title} · {task.status}</p>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Upcoming drills</CardTitle></CardHeader><CardContent>{upcoming.map((drill) => <p className="compact" key={drill.id}>{drill.title} · {formatDate(drill.scheduledDate)}</p>)}</CardContent></Card>
      {overdue.length > 0 && <Card className="alert"><AlertTriangle /> {overdue.length} overdue maintenance task(s) need attention.</Card>}
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string | number; tone?: "risk" | "good" }) {
  return <Card className={`stat ${tone ?? ""}`}><span>{title}</span><strong>{value}</strong></Card>;
}

createRoot(document.getElementById("root")!).render(<App />);
