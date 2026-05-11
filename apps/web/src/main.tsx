import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle, Anchor, Bell, CheckCircle2, ClipboardCheck,
  Flame, LogOut, MessageSquare, Plus, Send, ShipWheel, Wrench, X
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function statusColor(status: string): "default" | "secondary" | "destructive" | "success" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "secondary";
  if (status === "MISSED") return "destructive";
  return "default";
}

// ─── App Shell ──────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<User>("/auth/me").then(setUser).catch(() => tokenStore.clear());
  }, []);

  useEffect(() => {
    if (!user) return;
    api<MaintenanceTask[]>("/maintenance").then((tasks) => {
      setOverdueCount(tasks.filter((t) => t.status !== "COMPLETED" && isPast(t.dueDate)).length);
    });
  }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  const nav: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <ShipWheel size={18} /> },
    { id: "maintenance", label: "Maintenance", icon: <Wrench size={18} /> },
    { id: "drills", label: "Drills", icon: <Flame size={18} /> },
    { id: "crew", label: "Crew", icon: <ClipboardCheck size={18} /> },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Anchor size={22} /><span>Maritime Ops</span></div>
        <nav className="sidebar-nav">
          {nav.map(({ id, label, icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
              {icon}<span>{label}</span>
              {id === "maintenance" && overdueCount > 0 && (
                <span className="nav-badge">{overdueCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.name[0]}</div>
            <div className="user-info"><strong>{user.name}</strong><span>{user.role}</span></div>
          </div>
          <button className="logout-btn" onClick={() => { tokenStore.clear(); setUser(null); }} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">
              {view === "dashboard" && "Compliance Dashboard"}
              {view === "maintenance" && "Ship Maintenance"}
              {view === "drills" && "Safety Drills"}
              {view === "crew" && "Crew Dashboard"}
            </h1>
            <p className="page-sub">
              {view === "dashboard" && "Fleet-wide compliance overview"}
              {view === "maintenance" && "Manage and track maintenance tasks"}
              {view === "drills" && "Schedule and monitor safety drills"}
              {view === "crew" && "Your assignments and upcoming activities"}
            </p>
          </div>
          {overdueCount > 0 && (
            <div className="overdue-alert">
              <Bell size={15} />{overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
            </div>
          )}
        </header>

        {view === "dashboard" && <Dashboard />}
        {view === "maintenance" && <Maintenance user={user} />}
        {view === "drills" && <Drills user={user} />}
        {view === "crew" && <CrewDashboard user={user} />}
      </section>
    </main>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@maritime.test");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      tokenStore.set(result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand"><Anchor size={32} /><span>Maritime Ops</span></div>
        <h1 className="login-title">Operations & Compliance</h1>
        <p className="login-sub">Sign in to manage your fleet</p>
        <form onSubmit={submit} className="login-form">
          <label className="field-label">Email
            <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field-label">Password
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div className="error-box"><AlertTriangle size={15} />{error}</div>}
          <Button disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
        </form>
        <div className="login-hint">
          <p><strong>Admin:</strong> admin@maritime.test / Admin123!</p>
          <p><strong>Crew:</strong> crew@maritime.test / Crew123!</p>
        </div>
      </div>
    </main>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard() {
  const [data, setData] = useState<{ fleet: ComplianceSummary; ships: Array<{ ship: Ship; summary: ComplianceSummary }> } | null>(null);

  useEffect(() => { api<typeof data>("/compliance/dashboard").then(setData); }, []);

  if (!data) return <LoadingState label="Loading dashboard…" />;

  const { fleet, ships } = data;
  const barData = ships.map(({ ship, summary }) => ({
    ship: ship.name.replace("MV ", ""),
    Maintenance: summary.maintenanceCompliance,
    Drills: summary.drillParticipation,
    Overall: summary.overallCompliance,
  }));

  const pieData = [
    { name: "Completed", value: fleet.completedMaintenance, color: "#0f766e" },
    { name: "In Progress / Pending", value: fleet.totalMaintenance - fleet.completedMaintenance, color: "#e2e8f0" },
  ];

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <StatCard title="Overall Compliance" value={`${fleet.overallCompliance}%`} tone={fleet.overallCompliance < 75 ? "risk" : "good"} sub="Fleet-wide average" />
        <StatCard title="Overdue Maintenance" value={fleet.overdueMaintenance} tone={fleet.overdueMaintenance > 0 ? "risk" : "good"} sub="Tasks past due date" />
        <StatCard title="Missed Drills" value={fleet.missedDrills} tone={fleet.missedDrills > 0 ? "risk" : "good"} sub="Drills not completed" />
        <StatCard title="Tasks Completed" value={`${fleet.completedMaintenance}/${fleet.totalMaintenance}`} tone="neutral" sub={`${fleet.maintenanceCompliance}% completion rate`} />
      </div>

      {(fleet.overdueMaintenance > 0 || fleet.missedDrills > 0) && (
        <div className="risk-banner">
          <AlertTriangle size={18} />
          <span>
            Compliance risk detected —{" "}
            {fleet.overdueMaintenance > 0 && <strong>{fleet.overdueMaintenance} overdue maintenance task{fleet.overdueMaintenance > 1 ? "s" : ""}</strong>}
            {fleet.overdueMaintenance > 0 && fleet.missedDrills > 0 && " and "}
            {fleet.missedDrills > 0 && <strong>{fleet.missedDrills} missed drill{fleet.missedDrills > 1 ? "s" : ""}</strong>}
            {" "}require immediate attention.
          </span>
        </div>
      )}

      <div className="charts-row">
        <Card className="chart-card">
          <CardHeader><CardTitle>Ship Compliance Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis dataKey="ship" tick={{ fontSize: 12, fill: "#607086" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#607086" }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="Maintenance" fill="#0f766e" radius={[4, 4, 0, 0]} name="Maintenance" />
                <Bar dataKey="Drills" fill="#2563eb" radius={[4, 4, 0, 0]} name="Drills" />
                <Bar dataKey="Overall" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Overall" />
              </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span className="legend-item" style={{ "--color": "#0f766e" } as React.CSSProperties}>Maintenance</span>
              <span className="legend-item" style={{ "--color": "#2563eb" } as React.CSSProperties}>Drills</span>
              <span className="legend-item" style={{ "--color": "#f59e0b" } as React.CSSProperties}>Overall</span>
            </div>
          </CardContent>
        </Card>

        <Card className="chart-card">
          <CardHeader><CardTitle>Maintenance Completion</CardTitle></CardHeader>
          <CardContent className="pie-content">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => v} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center-label">
              <strong>{fleet.maintenanceCompliance}%</strong>
              <span>completion</span>
            </div>
            <div className="pie-legend">
              {pieData.map((d) => (
                <div key={d.name} className="pie-legend-item">
                  <span className="pie-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <strong>{d.value}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Per-Ship Summary</CardTitle></CardHeader>
        <CardContent>
          <table className="summary-table">
            <thead>
              <tr><th>Ship</th><th>Maintenance</th><th>Drills</th><th>Overall</th><th>Overdue</th><th>Missed</th></tr>
            </thead>
            <tbody>
              {ships.map(({ ship, summary }) => (
                <tr key={ship.id}>
                  <td><strong>{ship.name}</strong><div className="ship-imo">{ship.imoNumber}</div></td>
                  <td><CompliancePill value={summary.maintenanceCompliance} /></td>
                  <td><CompliancePill value={summary.drillParticipation} /></td>
                  <td><CompliancePill value={summary.overallCompliance} /></td>
                  <td>{summary.overdueMaintenance > 0 ? <span className="risk-text">{summary.overdueMaintenance}</span> : <span className="ok-text">0</span>}</td>
                  <td>{summary.missedDrills > 0 ? <span className="risk-text">{summary.missedDrills}</span> : <span className="ok-text">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CompliancePill({ value }: { value: number }) {
  const tone = value >= 80 ? "good" : value >= 60 ? "warn" : "risk";
  return <span className={`compliance-pill ${tone}`}>{value}%</span>;
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

function Maintenance({ user }: { user: User }) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [crew, setCrew] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [shipFilter, setShipFilter] = useState("");
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", shipId: "", assignedToId: "" });
  const [saving, setSaving] = useState(false);

  const load = () => api<MaintenanceTask[]>(`/maintenance${buildQuery({ status: statusFilter, shipId: shipFilter })}`).then(setTasks);

  useEffect(() => {
    load();
    api<Ship[]>("/ships").then(setShips);
    api<User[]>("/auth/crew").then(setCrew).catch(() => {});
  }, [statusFilter, shipFilter]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/maintenance", {
        method: "POST",
        body: JSON.stringify({ ...form, dueDate: new Date(form.dueDate).toISOString(), assignedToId: form.assignedToId || undefined }),
      });
      setForm({ title: "", description: "", dueDate: "", shipId: "", assignedToId: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await api(`/maintenance/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
    if (selectedTask?.id === id) setSelectedTask((t) => t ? { ...t, status: status as any } : t);
  }

  const overdueCount = tasks.filter((t) => t.status !== "COMPLETED" && isPast(t.dueDate)).length;

  return (
    <div className="page-layout">
      <div className="main-col">
        <div className="filter-bar">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </Select>
          <Select value={shipFilter} onChange={(e) => setShipFilter(e.target.value)}>
            <option value="">All ships</option>
            {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          {overdueCount > 0 && <div className="filter-alert"><AlertTriangle size={14} />{overdueCount} overdue</div>}
        </div>

        <div className="item-list">
          {tasks.length === 0 && <EmptyState icon={<Wrench size={32} />} label="No maintenance tasks found" />}
          {tasks.map((task) => {
            const overdue = task.status !== "COMPLETED" && isPast(task.dueDate);
            return (
              <div key={task.id} className={`item-card ${overdue ? "danger" : ""} ${selectedTask?.id === task.id ? "selected" : ""}`} onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}>
                <div className="item-card-main">
                  <div className="item-card-header">
                    <h3>{task.title}</h3>
                    <Badge variant={statusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="item-meta">{task.ship.name}{task.assignedTo ? ` · ${task.assignedTo.name}` : ""} · Due {formatDate(task.dueDate)}</p>
                  {overdue && <span className="overdue-tag"><AlertTriangle size={12} />Overdue</span>}
                </div>
                <Select value={task.status} onChange={(e) => { e.stopPropagation(); updateStatus(task.id, e.target.value); }} onClick={(e) => e.stopPropagation()}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-col">
        {selectedTask ? (
          <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} onStatusChange={updateStatus} />
        ) : user.role === "ADMIN" ? (
          <Card>
            <CardHeader><CardTitle><Plus size={16} />New Task</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createTask} className="form-grid">
                <label className="field-label">Title<Input placeholder="e.g. Inspect lifeboat davits" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
                <label className="field-label">Description<Textarea placeholder="Describe the task…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
                <label className="field-label">Due date<Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></label>
                <label className="field-label">Ship
                  <Select value={form.shipId} onChange={(e) => setForm({ ...form, shipId: e.target.value })} required>
                    <option value="">Select ship…</option>
                    {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </label>
                <label className="field-label">Assign to crew
                  <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </label>
                <Button disabled={saving}>{saving ? "Creating…" : "Create task"}</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent><p className="muted-text">Click a task to view details and add comments.</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}

function TaskDetail({ task, onClose, onStatusChange }: { task: MaintenanceTask; onClose: () => void; onStatusChange: (id: string, status: string) => void }) {
  const [comments, setComments] = useState<Array<{ id: string; body: string; author: { name: string }; createdAt: string }>>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<typeof comments>(`/maintenance/${task.id}/comments`).then(setComments).catch(() => {});
  }, [task.id]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/maintenance/${task.id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      api<typeof comments>(`/maintenance/${task.id}/comments`).then(setComments);
    } finally {
      setSending(false);
    }
  }

  const overdue = task.status !== "COMPLETED" && isPast(task.dueDate);

  return (
    <Card className={overdue ? "detail-card danger-border" : "detail-card"}>
      <CardHeader>
        <CardTitle style={{ fontSize: 16 }}>{task.title}</CardTitle>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
      </CardHeader>
      <CardContent>
        <div className="detail-meta">
          <span><strong>Ship:</strong> {task.ship.name}</span>
          <span><strong>Due:</strong> {formatDate(task.dueDate)}</span>
          {task.assignedTo && <span><strong>Assigned:</strong> {task.assignedTo.name}</span>}
          <Badge variant={statusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
          {overdue && <span className="overdue-tag"><AlertTriangle size={12} />Overdue</span>}
        </div>
        <p className="detail-desc">{task.description}</p>

        <label className="field-label" style={{ marginBottom: 16 }}>Update status
          <Select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        </label>

        <div className="comments-section">
          <h4 className="comments-title"><MessageSquare size={14} />Notes & Comments</h4>
          <div className="comments-list">
            {comments.length === 0 && <p className="muted-text">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-author">{c.author.name} <span className="comment-time">{formatDate(c.createdAt)}</span></div>
                <p className="comment-body">{c.body}</p>
              </div>
            ))}
          </div>
          <form onSubmit={postComment} className="comment-form">
            <Textarea placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} />
            <Button type="submit" disabled={sending || !body.trim()} variant="secondary">
              <Send size={14} />{sending ? "Posting…" : "Post"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Drills ──────────────────────────────────────────────────────────────────

function Drills({ user }: { user: User }) {
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [shipFilter, setShipFilter] = useState("");
  const [form, setForm] = useState({ title: "", type: "Fire Drill", scheduledDate: "", shipId: "" });
  const [saving, setSaving] = useState(false);

  const load = () => api<SafetyDrill[]>(`/drills${buildQuery({ status: statusFilter, shipId: shipFilter })}`).then(setDrills);

  useEffect(() => { load(); api<Ship[]>("/ships").then(setShips); }, [statusFilter, shipFilter]);

  async function createDrill(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/drills", { method: "POST", body: JSON.stringify({ ...form, scheduledDate: new Date(form.scheduledDate).toISOString() }) });
      setForm({ title: "", type: "Fire Drill", scheduledDate: "", shipId: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function attend(id: string) {
    await api(`/drills/${id}/attendance`, { method: "POST", body: JSON.stringify({ attended: true }) });
    load();
  }

  async function completeDrill(id: string) {
    await api(`/drills/${id}/complete`, { method: "POST" });
    load();
  }

  return (
    <div className="page-layout">
      <div className="main-col">
        <div className="filter-bar">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="MISSED">Missed</option>
          </Select>
          <Select value={shipFilter} onChange={(e) => setShipFilter(e.target.value)}>
            <option value="">All ships</option>
            {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>

        <div className="item-list">
          {drills.length === 0 && <EmptyState icon={<Flame size={32} />} label="No drills found" />}
          {drills.map((drill) => {
            const overdue = drill.status !== "COMPLETED" && isPast(drill.scheduledDate);
            const attended = drill.attendances.some((a) => a.attended);
            return (
              <div key={drill.id} className={`item-card ${overdue ? "danger" : ""}`}>
                <div className="item-card-main">
                  <div className="item-card-header">
                    <h3>{drill.title}</h3>
                    <Badge variant={statusColor(drill.status)}>{drill.status}</Badge>
                  </div>
                  <p className="item-meta">{drill.ship.name} · {drill.type} · {formatDate(drill.scheduledDate)}</p>
                  {overdue && <span className="overdue-tag"><AlertTriangle size={12} />Missed</span>}
                  {user.role === "ADMIN" && (
                    <p className="item-meta">
                      {drill.attendances.filter((a) => a.attended).length}/{drill.attendances.length} attended
                    </p>
                  )}
                </div>
                <div className="item-actions">
                  {user.role === "CREW" && drill.status === "SCHEDULED" && (
                    attended
                      ? <Badge variant="success"><CheckCircle2 size={13} />Attended</Badge>
                      : <Button variant="secondary" onClick={() => attend(drill.id)}>Mark attended</Button>
                  )}
                  {user.role === "ADMIN" && drill.status === "SCHEDULED" && (
                    <Button variant="secondary" onClick={() => completeDrill(drill.id)}>
                      <CheckCircle2 size={14} />Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-col">
        {user.role === "ADMIN" ? (
          <Card>
            <CardHeader><CardTitle><Plus size={16} />Schedule Drill</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createDrill} className="form-grid">
                <label className="field-label">Title<Input placeholder="e.g. Monthly fire response" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
                <label className="field-label">Type
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option>Fire Drill</option>
                    <option>Evacuation</option>
                    <option>Man Overboard</option>
                    <option>Medical Emergency</option>
                  </Select>
                </label>
                <label className="field-label">Date<Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required /></label>
                <label className="field-label">Ship
                  <Select value={form.shipId} onChange={(e) => setForm({ ...form, shipId: e.target.value })} required>
                    <option value="">Select ship…</option>
                    {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </label>
                <Button disabled={saving}>{saving ? "Scheduling…" : "Schedule drill"}</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent><p className="muted-text">Use "Mark attended" to log your participation in a drill.</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ─── Crew Dashboard ──────────────────────────────────────────────────────────

function CrewDashboard({ user }: { user: User }) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);

  const load = () => {
    api<MaintenanceTask[]>("/maintenance").then(setTasks);
    api<SafetyDrill[]>("/drills").then(setDrills);
  };

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await api(`/maintenance/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function attend(id: string) {
    await api(`/drills/${id}/attendance`, { method: "POST", body: JSON.stringify({ attended: true }) });
    load();
  }

  const overdue = useMemo(() => tasks.filter((t) => t.status !== "COMPLETED" && isPast(t.dueDate)), [tasks]);
  const upcoming = useMemo(() => drills.filter((d) => !isPast(d.scheduledDate)), [drills]);
  const myAttended = useMemo(() => drills.filter((d) => d.attendances.some((a) => a.crew.id === user.id && a.attended)), [drills, user.id]);

  return (
    <div className="crew-dashboard">
      {overdue.length > 0 && (
        <div className="risk-banner">
          <AlertTriangle size={18} />
          <strong>{overdue.length} overdue task{overdue.length > 1 ? "s" : ""}</strong> — please update these as soon as possible.
        </div>
      )}

      <div className="crew-stats">
        <MiniStat label="My tasks" value={tasks.length} />
        <MiniStat label="Overdue" value={overdue.length} tone={overdue.length > 0 ? "risk" : "good"} />
        <MiniStat label="Upcoming drills" value={upcoming.length} />
        <MiniStat label="Drills attended" value={myAttended.length} tone="good" />
      </div>

      <div className="crew-cols">
        <Card>
          <CardHeader><CardTitle><Wrench size={16} />My Maintenance Tasks</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 && <EmptyState icon={<Wrench size={28} />} label="No tasks assigned" />}
            <div className="item-list">
              {tasks.map((task) => {
                const isOverdue = task.status !== "COMPLETED" && isPast(task.dueDate);
                return (
                  <div key={task.id} className={`item-card ${isOverdue ? "danger" : ""}`}>
                    <div className="item-card-main">
                      <div className="item-card-header">
                        <h3>{task.title}</h3>
                        <Badge variant={statusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="item-meta">{task.ship.name} · Due {formatDate(task.dueDate)}</p>
                      {isOverdue && <span className="overdue-tag"><AlertTriangle size={12} />Overdue</span>}
                    </div>
                    <Select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value)}>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                    </Select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><Flame size={16} />Safety Drills</CardTitle></CardHeader>
          <CardContent>
            {drills.length === 0 && <EmptyState icon={<Flame size={28} />} label="No drills scheduled" />}
            <div className="item-list">
              {drills.map((drill) => {
                const attended = drill.attendances.some((a) => a.crew.id === user.id && a.attended);
                const overdueDrill = drill.status !== "COMPLETED" && isPast(drill.scheduledDate);
                return (
                  <div key={drill.id} className={`item-card ${overdueDrill ? "danger" : ""}`}>
                    <div className="item-card-main">
                      <div className="item-card-header">
                        <h3>{drill.title}</h3>
                        <Badge variant={statusColor(drill.status)}>{drill.status}</Badge>
                      </div>
                      <p className="item-meta">{drill.ship.name} · {drill.type} · {formatDate(drill.scheduledDate)}</p>
                    </div>
                    {drill.status === "SCHEDULED" && (
                      attended
                        ? <Badge variant="success"><CheckCircle2 size={13} />Attended</Badge>
                        : <Button variant="secondary" onClick={() => attend(drill.id)}>Attend</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function StatCard({ title, value, tone, sub }: { title: string; value: string | number; tone: "risk" | "good" | "neutral"; sub?: string }) {
  return (
    <Card className={`stat-card ${tone}`}>
      <span className="stat-label">{title}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "risk" | "good" }) {
  return (
    <div className={`mini-stat ${tone ?? ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p>{label}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const s = q.toString();
  return s ? `?${s}` : "";
}

createRoot(document.getElementById("root")!).render(<App />);
