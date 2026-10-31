"use client";

import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { A } from "@/lib/admin";
import { asset } from "@/lib/product";

export type Field = {
  key: string; label: string; type?: "text" | "textarea" | "number" | "bool" | "select" | "url" | "image" | "datetime" | "list";
  options?: [string, string][]; help?: string; required?: boolean; wide?: boolean;
};

export const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50";

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const [up, setUp] = useState(false);
  switch (f.type) {
    case "textarea": return <textarea rows={6} className={inp} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number": return <input type="number" step="any" className={inp} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />;
    case "bool": return (
      <button type="button" onClick={() => onChange(value ? 0 : 1)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${value ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-300"}`}>
        {value ? "Yes" : "No"}</button>);
    case "select": return (
      <select className={inp} value={value ?? f.options?.[0]?.[0]} onChange={(e) => onChange(e.target.value)}>
        {f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>);
    case "datetime": return <input type="datetime-local" className={inp} value={value ? String(value).slice(0, 16) : ""}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")} />;
    case "list": return <textarea rows={5} className={inp} placeholder="One per line" value={(Array.isArray(value) ? value : []).join("\n")}
      onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />;
    case "image": return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className={inp} placeholder="https://… or upload" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
          <label className="btn-ghost cursor-pointer whitespace-nowrap"><Upload size={14} />{up ? "…" : "Upload"}
            <input type="file" hidden accept="image/*,video/mp4" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUp(true);
              const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
              try { const r = await A.upload(file.name, data); onChange(r.url); } catch (err) { alert((err as Error).message); }
              setUp(false);
            }} /></label>
        </div>
        {value && /\.(png|jpe?g|webp|gif)(\?|$)|^\/uploads\//i.test(value) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset(value)} alt="" className="h-20 rounded-lg object-cover" />
        )}
      </div>);
    default: return <input className={inp} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function Crud({ entity, title, fields, columns, defaults, intro }: {
  entity: string; title: string; fields: Field[]; columns: [string, string][]; defaults: Record<string, any>; intro?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<Record<string, any> | null>(null);
  const [err, setErr] = useState("");
  const load = () => A.list(entity).then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setErr("");
    try {
      if (edit?.id && rows.some((r) => r.id === edit.id)) await A.update(entity, edit.id, edit);
      else await A.create(entity, edit);
      setEdit(null); load();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-bold text-white">{title}</h2>{intro && <p className="text-sm text-slate-400">{intro}</p>}</div>
        <button onClick={() => setEdit({ ...defaults })} className="inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-black"><Plus size={16} />Add new</button>
      </div>
      {err && <p className="rounded-lg bg-rose-500/15 p-2 text-sm text-rose-200">{err}</p>}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr>{columns.map(([k, l]) => <th key={k} className="px-3 py-2">{l}</th>)}<th className="px-3 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-slate-500">Nothing yet — click “Add new”.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                {columns.map(([k]) => (
                  <td key={k} className="max-w-[260px] truncate px-3 py-2 text-slate-200">
                    {typeof r[k] === "number" && (k === "active" || k === "published" || k === "pinned" || k === "highlight")
                      ? (r[k] ? <span className="text-emerald-300">● on</span> : <span className="text-slate-500">○ off</span>)
                      : Array.isArray(r[k]) ? r[k].length + " items" : String(r[k] ?? "")}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => setEdit({ ...r })} className="mr-2 text-cyan-300" aria-label="edit"><Pencil size={15} /></button>
                  <button onClick={async () => { if (confirm("Delete this item?")) { await A.remove(entity, r.id).catch((e) => setErr(e.message)); load(); } }}
                    className="text-rose-300" aria-label="delete"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="panel my-8 w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{rows.some((r) => r.id === edit.id) ? "Edit" : "New"} — {title}</h3>
              <button onClick={() => setEdit(null)}><X /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className={`block text-[13px] text-slate-300 ${f.wide || f.type === "textarea" || f.type === "image" || f.type === "list" ? "sm:col-span-2" : ""}`}>
                  <span className="mb-1 block">{f.label}{f.required && " *"}</span>
                  <FieldInput f={f} value={edit[f.key]} onChange={(v) => setEdit({ ...edit, [f.key]: v })} />
                  {f.help && <span className="mt-0.5 block text-[11px] text-slate-500">{f.help}</span>}
                </label>
              ))}
            </div>
            {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} className="rounded-lg bg-cyan-400 px-5 py-2 font-bold text-black">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
