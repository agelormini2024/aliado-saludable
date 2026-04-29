/**
 * _PesoChartCoach — gráfico de evolución de peso para la vista de detalle del coach.
 *
 * Componente privado de la ruta (prefijo `_`). Se importa con dynamic({ ssr: false })
 * desde page.tsx para evitar errores de hidratación de Recharts con el DOM.
 *
 * Recibe los registros ya invertidos (del más antiguo al más reciente) para que
 * el eje X muestre la evolución cronológica de izquierda a derecha.
 *
 * Si hay menos de 2 puntos, renderiza un mensaje en lugar del gráfico.
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

export interface PesoPoint {
  fechaLabel: string; // "15 abr"
  fechaCompleta: string; // "15 de abril de 2026"
  peso: number;
}

/* ─── Tooltip ─────────────────────────────────────────────────────────────── */

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: PesoPoint }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-forest px-4 py-2.5 shadow-lg shadow-forest/20">
      <p className="mb-0.5 font-sans text-[11px] text-forest-light">
        {payload[0].payload.fechaCompleta}
      </p>
      <p className="font-heading italic text-xl leading-none text-cream">
        {payload[0].value}{" "}
        <span className="font-sans text-sm not-italic text-forest-light">kg</span>
      </p>
    </div>
  );
}

/* ─── Label del último punto ──────────────────────────────────────────────── */

interface UltimoLabelProps {
  viewBox?: { cx: number; cy: number };
  peso: number;
}

function UltimoLabel({ viewBox, peso }: UltimoLabelProps) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  if (!isFinite(cx) || !isFinite(cy)) return null;
  const width = 68;
  const height = 32;
  const cardY = cy - height - 12;

  return (
    <g>
      <rect x={cx - width / 2} y={cardY} width={width} height={height} rx={8} fill="#1E5631" />
      <polygon
        points={`${cx - 5},${cy - 12} ${cx + 5},${cy - 12} ${cx},${cy - 5}`}
        fill="#1E5631"
      />
      <text
        x={cx}
        y={cardY + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#F7F4EE"
        fontSize={14}
        fontStyle="italic"
        fontFamily="'Fraunces', Georgia, serif"
      >
        {peso}
        <tspan
          fontSize={10}
          fontStyle="normal"
          fontFamily="'DM Sans', sans-serif"
          fill="#a8c5af"
          dx={2}
        >
          kg
        </tspan>
      </text>
    </g>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────── */

export default function PesoChartCoach({ data }: { data: PesoPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-cream-dark/40">
        <p className="font-sans text-sm italic text-ink-muted">
          Se necesitan al menos 2 registros para mostrar el gráfico
        </p>
      </div>
    );
  }

  const lastPoint = data[data.length - 1];

  return (
    <ResponsiveContainer width="100%" height={220}>
      {/* top: 52 para que la tarjeta del último punto no quede cortada */}
      <AreaChart data={data} margin={{ top: 52, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="pesoGradientCoach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E5631" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#1E5631" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 4" stroke="#ede8dc" vertical={false} />

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
          fill="url(#pesoGradientCoach)"
          dot={false}
          activeDot={{ r: 5, fill: "#1E5631", stroke: "#f7f4ee", strokeWidth: 2 }}
        />

        {lastPoint && (
          <ReferenceDot
            x={lastPoint.fechaLabel}
            y={lastPoint.peso}
            r={5}
            fill="#C97D4B"
            stroke="#f7f4ee"
            strokeWidth={2}
            label={<UltimoLabel peso={lastPoint.peso} />}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
