"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

export function SalesChart({ data }: { data: Array<{ day: string; sales: number; profit: number }> }) {
  return <div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
    <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22a05a" stopOpacity={0.22} /><stop offset="95%" stopColor="#22a05a" stopOpacity={0.01} /></linearGradient><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a23c" stopOpacity={0.18} /><stop offset="95%" stopColor="#e6a23c" stopOpacity={0.01} /></linearGradient></defs>
    <CartesianGrid stroke="#e8eee9" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11, fill: "#829087" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: "#829087" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}m` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`} /><Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => `Date ${label}`} contentStyle={{ border: "1px solid #e4ebe5", borderRadius: 12, fontSize: 12 }} /><Area type="monotone" dataKey="sales" stroke="#187c45" strokeWidth={2.5} fill="url(#salesFill)" /><Area type="monotone" dataKey="profit" stroke="#d49b37" strokeWidth={2} fill="url(#profitFill)" />
  </AreaChart></ResponsiveContainer></div>;
}
