"use client";

import { Check, Copy, Download, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { A } from "@/lib/admin";
import { inp } from "./Crud";

const when = (s?: string) => (s || "").slice(0, 16).replace("T", " ");
const Empty = ({ cols, text }: { cols: number; text: string }) => <tr><td colSpan={cols} className="p-6 text-center text-slate-500">{text}</td></tr>;

export function ApprovalsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => A.pendingUsers().then(setRows).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); load(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div className="space-y-3">
      <div><h2 className="text-xl font-bold text-white">Approvals</h2>
        <p className="text-sm text-slate-400">New sign-ups wait here when <b>Settings → Require admin approval</b> is on. Approve to let them log in, or delete the request.</p></div>
      {msg && <p className="text-sm text-rose-300">{msg}</p>}
      <div className="panel overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Name</th><th>Email</th><th>Mobile</th><th>Requested</th><th className="text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((u) => (
          <tr key={u.id}><td className="p-2 text-slate-200">{u.name || "—"}</td><td>{u.email || "—"}</td><td className="font-mono">{u.phone || "—"}</td>
            <td className="text-slate-500">{when(u.created_at)}</td>
            <td className="space-x-2 whitespace-nowrap p-2 text-right">
              <button className="inline-flex items-center gap-1 rounded bg-emerald-400 px-2 py-1 font-semibold text-black" onClick={() => act(() => A.approveUser(u.id))}><Check size={14} />Approve</button>
              <button className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-1 text-rose-200" onClick={() => confirm(`Delete ${u.email || u.phone}?`) && act(() => A.deleteUser(u.id))}><Trash2 size={14} />Delete</button>
            </td></tr>))}
          {!rows.length && <Empty cols={5} text="No pending requests." />}</tbody></table></div>
    </div>
  );
}

export function OrdersPanel() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => A.orders(status).then(setRows).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>) => { setMsg(""); try { await fn(); load(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div className="space-y-3">
      <div><h2 className="text-xl font-bold text-white">Membership orders</h2>
        <p className="text-sm text-slate-400">Manual UPI orders. Each has an order code (PH-…). Match the customer&apos;s UTR / reference with your bank or UPI app, then <b>Approve</b> — Premium starts instantly. Razorpay/Stripe payments activate automatically and appear under Payments.</p></div>
      <div className="flex gap-1">{["pending", "approved", "rejected"].map((s) => (
        <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-sm capitalize ${status === s ? "bg-white/15 text-white" : "text-slate-400"}`}>{s}</button>))}</div>
      {msg && <p className="text-sm text-rose-300">{msg}</p>}
      <div className="panel overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Order code</th><th>Customer</th><th>Plan</th><th>Amount</th><th>UTR / reference</th><th>Date</th><th className="text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((o) => (
          <tr key={o.id}><td className="p-2 font-mono text-cyan-200">{o.order_code}</td>
            <td>{o.name || ""} <span className="text-slate-400">{o.email && !o.email.endsWith("@phone.problemhunt") ? o.email : ""} {o.phone}</span></td>
            <td>{o.plan_id}</td><td className="font-mono">{o.currency === "INR" ? "₹" : "$"}{o.amount}</td>
            <td className="font-mono">{o.payer_ref || <span className="text-slate-500">not given yet</span>}</td>
            <td className="text-slate-500">{when(o.created_at)}</td>
            <td className="space-x-2 whitespace-nowrap p-2 text-right">
              {o.status === "pending" && <>
                <button className="inline-flex items-center gap-1 rounded bg-emerald-400 px-2 py-1 font-semibold text-black" onClick={() => act(() => A.orderAction(o.id, "approve"))}><Check size={14} />Approve</button>
                <button className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1" onClick={() => act(() => A.orderAction(o.id, "reject"))}><X size={14} />Reject</button></>}
              <button className="text-rose-300" title="Delete" onClick={() => confirm(`Delete order ${o.order_code}?`) && act(() => A.deleteOrder(o.id))}><Trash2 size={14} /></button>
            </td></tr>))}
          {!rows.length && <Empty cols={7} text={`No ${status} orders.`} />}</tbody></table></div>
    </div>
  );
}

export function CodesPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [f, setF] = useState({ plan_id: "", count: 10, days: 0, max_uses: 1, expires_at: "", prefix: "PH", note: "" });
  const [fresh, setFresh] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => A.codes().then(setRows).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
    A.list("plans").then((p) => { setPlans(p); if (p[0]) setF((x) => ({ ...x, plan_id: x.plan_id || p[0].id })); }).catch(() => {});
  }, []);
  const gen = async () => {
    setMsg("");
    try { const r = await A.generateCodes({ ...f, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : "" }); setFresh(r.codes); load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const csv = () => {
    const lines = ["code,plan,days,uses,max_uses,expires,note,active", ...rows.map((c) => [c.code, c.plan_id, c.days, c.uses, c.max_uses, c.expires_at, `"${(c.note || "").replace(/"/g, "'")}"`, c.active].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "problemhunt-codes.csv"; a.click();
  };
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v });
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold text-white">Membership codes</h2>
        <p className="text-sm text-slate-400">Generate gift / partner / campaign codes. Users enter them on the Premium page (&quot;Have a code?&quot;). Use them for schools, government drives, corporate tie-ups, offline sales or giveaways.</p></div>
      <section className="panel grid gap-3 p-4 sm:grid-cols-4">
        <label className="text-[13px] text-slate-300">Plan<select className={inp} value={f.plan_id} onChange={(e) => set("plan_id", e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-[13px] text-slate-300">How many codes<input type="number" min={1} max={500} className={inp} value={f.count} onChange={(e) => set("count", Number(e.target.value))} /></label>
        <label className="text-[13px] text-slate-300">Days (0 = plan default)<input type="number" min={0} className={inp} value={f.days} onChange={(e) => set("days", Number(e.target.value))} /></label>
        <label className="text-[13px] text-slate-300">Uses per code<input type="number" min={1} className={inp} value={f.max_uses} onChange={(e) => set("max_uses", Number(e.target.value))} /></label>
        <label className="text-[13px] text-slate-300">Prefix<input className={inp} value={f.prefix} maxLength={8} onChange={(e) => set("prefix", e.target.value.toUpperCase())} /></label>
        <label className="text-[13px] text-slate-300">Expires (optional)<input type="date" className={inp} value={f.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></label>
        <label className="text-[13px] text-slate-300 sm:col-span-2">Note (who is it for?)<input className={inp} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Govt school drive, Pune" /></label>
        <div className="flex items-center gap-3 sm:col-span-4"><button onClick={gen} className="rounded-lg bg-cyan-400 px-5 py-2 font-bold text-black">Generate codes</button>{msg && <span className="text-sm text-rose-300">{msg}</span>}</div>
        {fresh.length > 0 && <div className="sm:col-span-4"><div className="mb-1 flex items-center gap-3 text-sm text-emerald-300">{fresh.length} new codes
          <button className="inline-flex items-center gap-1 text-cyan-300" onClick={() => navigator.clipboard.writeText(fresh.join("\n"))}><Copy size={13} />Copy all</button></div>
          <textarea readOnly className={inp + " h-28 font-mono"} value={fresh.join("\n")} /></div>}
      </section>
      <div className="flex justify-end"><button onClick={csv} className="btn-ghost"><Download size={14} />Export CSV</button></div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Code</th><th>Plan</th><th>Used</th><th>Expires</th><th>Note</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((c) => (
          <tr key={c.id}><td className="p-2 font-mono text-cyan-200">{c.code}</td><td>{c.plan_id}{c.days ? ` · ${c.days}d` : ""}</td>
            <td>{c.uses}/{c.max_uses}</td><td className="text-slate-500">{(c.expires_at || "").slice(0, 10) || "never"}</td>
            <td className="max-w-[200px] truncate text-slate-400">{c.note}</td>
            <td>{c.active ? <span className="text-emerald-300">active</span> : <span className="text-slate-500">off</span>}</td>
            <td className="space-x-2 whitespace-nowrap p-2 text-right">
              <button className="text-cyan-300" onClick={() => navigator.clipboard.writeText(c.code)}><Copy size={14} /></button>
              <button className="text-amber-300" onClick={async () => { await A.toggleCode(c.id); load(); }}>{c.active ? "Disable" : "Enable"}</button>
              <button className="text-rose-300" onClick={async () => { if (confirm(`Delete ${c.code}?`)) { await A.deleteCode(c.id); load(); } }}><Trash2 size={14} /></button>
            </td></tr>))}
          {!rows.length && <Empty cols={7} text="No codes yet." />}</tbody></table></div>
    </div>
  );
}

export function RegistrationsPanel() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { A.list("programs").then((p) => { setPrograms(p); if (p[0]) setPid(p[0].id); }).catch(() => {}); }, []);
  useEffect(() => { if (pid) A.registrations(pid).then(setRows).catch(() => {}); }, [pid]);
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-white">Registrations</h3>
      <select className={inp + " max-w-md"} value={pid} onChange={(e) => setPid(e.target.value)}>{programs.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.registrations || 0})</option>)}</select>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Name</th><th>Contact</th><th>City</th><th>Date</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((r) => <tr key={r.id}><td className="p-2">{r.name}</td><td className="font-mono">{r.contact}</td><td>{r.city}</td><td className="text-slate-500">{when(r.created_at)}</td></tr>)}
          {!rows.length && <Empty cols={4} text="No registrations yet." />}</tbody></table></div>
    </div>
  );
}

export function SosPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { A.sos().then(setRows).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <div><h2 className="text-xl font-bold text-white">SOS log</h2>
        <p className="text-sm text-slate-400">For monitoring only. To protect users, locations and messages are visible only to the user&apos;s own family and contacts — never to admins.</p></div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Time</th><th>User</th><th>Type</th><th>Notified</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((e) => (
          <tr key={e.id}><td className="p-2 text-slate-400">{when(e.created_at)}</td><td>{e.email && !e.email.endsWith("@phone.problemhunt") ? e.email : e.phone}</td>
            <td className={e.kind === "safety" ? "text-rose-300" : e.kind === "medical" ? "text-amber-300" : "text-cyan-300"}>{e.kind}</td><td>{e.notified}</td><td>{e.status}</td></tr>))}
          {!rows.length && <Empty cols={5} text="No SOS events." />}</tbody></table></div>
    </div>
  );
}

export function OrgsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => A.orgs().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      <div><h2 className="text-xl font-bold text-white">Organisations (Workplace)</h2>
        <p className="text-sm text-slate-400">Schools, offices and banks using Workplace. Set their plan and seats after payment or a signed order.</p></div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Organisation</th><th>Domain</th><th>Members</th><th>Seats</th><th>Plan</th><th>Created</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((o) => (
          <tr key={o.id}><td className="p-2 text-white">{o.name}</td><td className="text-slate-400">{o.domain || "—"}</td><td>{o.members}</td>
            <td><input type="number" className={inp + " w-24"} defaultValue={o.seats} onBlur={async (e) => { await A.orgUpdate(o.id, { seats: Number(e.target.value) }); load(); }} /></td>
            <td><select className={inp + " w-32"} value={o.plan} onChange={async (e) => { await A.orgUpdate(o.id, { plan: e.target.value }); load(); }}>
              {["trial", "workplace", "enterprise", "government", "partner"].map((p) => <option key={p}>{p}</option>)}</select></td>
            <td className="text-slate-500">{when(o.created_at)}</td></tr>))}
          {!rows.length && <Empty cols={6} text="No organisations yet." />}</tbody></table></div>
    </div>
  );
}
