/**
 * PesoChart — gráfico de área para el historial de peso.
 *
 * Este componente se importa con dynamic({ ssr: false }) en el dashboard
 * para evitar problemas de hidratación de Recharts (usa APIs del DOM).
 *
 * Diseño:
 * - Línea bosque (#1E5631) sobre área con gradiente ultra-sutil
 * - Sin dots en los puntos intermedios — solo el último en ámbar
 * - Grilla horizontal con líneas de guión muy suaves
 * - Tooltip personalizado con fondo bosque
 * - Cursor de hover como línea punteada vertical
 */
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

export interface ChartDataPoint {
  fechaLabel: string; // "15 abr"
  peso: number;
}

/* ─── Tooltip personalizado ───────────────────────────────────────────────── */

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-forest px-4 py-2.5 shadow-lg shadow-forest/20">
      <p className="mb-0.5 font-sans text-[11px] text-forest-light">
        {payload[0].payload.fechaLabel}
      </p>
      <p className="font-heading italic text-xl leading-none text-cream">
        {payload[0].value}{" "}
        <span className="font-sans text-sm not-italic text-forest-light">kg</span>
      </p>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────── */

export function PesoChart({ data }: { data: ChartDataPoint[] }) {
  const lastPoint = data[data.length - 1];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="pesoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E5631" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#1E5631" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#ede8dc"
          vertical={false}
        />

        <XAxis
          dataKey="fechaLabel"
          tick={{ fontSize: 11, fill: "#5c5c5c" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          tick={{ fontSize: 11, fill: "#5c5c5c" }}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => `${v}`}
          width={36}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "#1E5631", strokeWidth: 1, strokeDasharray: "4 4" }}
        />

        <Area
          type="monotone"
          dataKey="peso"
          stroke="#1E5631"
          strokeWidth={2}
          fill="url(#pesoGradient)"
          dot={false}
          activeDot={{ r: 5, fill: "#1E5631", stroke: "#f7f4ee", strokeWidth: 2 }}
        />

        {/* Último punto marcado en ámbar */}
        {lastPoint && (
          <ReferenceDot
            x={lastPoint.fechaLabel}
            y={lastPoint.peso}
            r={5}
            fill="#C97D4B"
            stroke="#f7f4ee"
            strokeWidth={2}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
