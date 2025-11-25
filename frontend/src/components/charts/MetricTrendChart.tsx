'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type MetricTrendDatum = {
  label: string;
  reconstruction: number | null;
  latent: number | null;
  combined: number | null;
  threshold: number;
};

type MetricTrendChartProps = {
  data: MetricTrendDatum[];
  threshold: number;
};

const formatValue = (value: number | null) =>
  value === null || Number.isNaN(value) ? '—' : Number(value).toFixed(3);

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--tg-color-bg)]/95 px-4 py-3 shadow-xl">
      <p className="heading-font text-xs uppercase tracking-[0.35em] text-slate-400">{label}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-200 body-font">
        {payload.map(entry => (
          <div key={entry.dataKey as string} className="flex items-center justify-between gap-6">
            <span className="text-slate-400">{entry.name}</span>
            <span className="font-semibold text-white">{formatValue(Number(entry.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function MetricTrendChart({ data, threshold }: MetricTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400 body-font">
        Metrics will appear once analyses complete.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 20, right: 12, left: -20, bottom: 10 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'var(--tg-font-body)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={40}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--tg-font-body)' }}
          tickFormatter={(value: number) => value.toFixed(2)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.2)' }} />
        <Line
          type="monotone"
          dataKey="combined"
          name="Combined"
          stroke="#a855f7"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="reconstruction"
          name="Reconstruction"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="latent"
          name="Latent"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
        <Line type="monotone" dataKey="threshold" name="Threshold" stroke="#f97316" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type { MetricTrendDatum };
