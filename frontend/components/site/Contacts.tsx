"use client";

import { Phone, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, type Contact } from "@/lib/product";

const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-400/50";

export default function Contacts({ onChange }: { onChange?: (c: Contact[]) => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Contact[]>([]);
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [err, setErr] = useState("");
  const load = () => P.contacts().then((r) => { setRows(r); onChange?.(r); }).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    setErr("");
    try { await P.addContact(f); setF({ name: "", phone: "", email: "" }); load(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <div className="min-w-0 flex-1"><div className="font-semibold text-white">{c.name}</div>
              <div className="truncate text-[12px] text-slate-400">{[c.phone, c.email].filter(Boolean).join(" · ")}</div></div>
            {c.phone && <a href={`tel:${c.phone}`} className="text-emerald-300" aria-label="call"><Phone size={16} /></a>}
            <button onClick={async () => { await P.delContact(c.id); load(); }} className="text-slate-500 hover:text-rose-300" aria-label="delete"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      {rows.length < 5 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input className={inp} placeholder={t("name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={inp} placeholder="+91 98xxxxxxx" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className={inp} placeholder={t("email")} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <button onClick={add} disabled={!f.name || (!f.phone && !f.email)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
            <UserPlus size={15} />{t("add_contact")}</button>
        </div>
      )}
      {err && <p className="text-sm text-rose-300">{err}</p>}
    </div>
  );
}
