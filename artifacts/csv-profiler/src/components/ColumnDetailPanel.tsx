import { X, Hash, Type, Calendar, ToggleLeft, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ColumnLayout } from "@/lib/csv-profiler";
import { formatNumber } from "@/lib/csv-profiler";

interface Props {
  column: ColumnLayout;
  onClose: () => void;
}

const TYPE_ICONS = {
  numeric: Hash,
  text: Type,
  date: Calendar,
  boolean: ToggleLeft,
  mixed: Layers,
};

const CHART_COLORS = [
  "#3b82f6","#6366f1","#8b5cf6","#a78bfa","#c4b5fd",
  "#818cf8","#93c5fd","#60a5fa","#7c3aed","#4f46e5",
];

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function ColumnDetailPanel({ column, onClose }: Props) {
  const Icon = TYPE_ICONS[column.type] ?? Layers;
  const chartData = column.topValues.slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-fit sticky top-4">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{column.name}</p>
            <p className="text-xs text-muted-foreground">
              Srl. {column.srlNo} &bull; {column.type} &bull; {column.length} bytes
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[80vh]">
        {/* Layout info */}
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Layout</p>
          <StatRow label="Field length" value={column.length} />
          <StatRow label="Byte start" value={column.byteStart} />
          <StatRow label="Byte end" value={column.byteEnd} />
          {column.remarks && (
            <StatRow label="Remarks" value={column.remarks} />
          )}
          {column.qSec && <StatRow label="Questionnaire Sec" value={column.qSec} />}
          {column.qItem && <StatRow label="Questionnaire Item" value={column.qItem} />}
          {column.qCol && <StatRow label="Questionnaire Col" value={column.qCol} />}
        </div>

        {/* Data quality */}
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Data Quality</p>
          <StatRow label="Total count" value={column.totalCount} />
          <StatRow label="Non-null" value={column.nonNullCount} />
          <StatRow label="Null / missing" value={column.nullCount} />
          <StatRow label="Fill rate" value={`${column.fillRate.toFixed(2)}%`} />
          <StatRow label="Unique values" value={column.uniqueCount} />
        </div>

        {/* Numeric stats */}
        {column.type === "numeric" && column.min !== undefined && (
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Statistics</p>
            <StatRow label="Minimum" value={formatNumber(column.min, 4)} />
            <StatRow label="Maximum" value={formatNumber(column.max!, 4)} />
            <StatRow label="Mean" value={formatNumber(column.mean!, 4)} />
            <StatRow label="Median" value={formatNumber(column.median!, 4)} />
          </div>
        )}

        {/* Top values chart */}
        {chartData.length > 0 && (
          <div className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Top Values ({Math.min(10, column.uniqueCount)} of {column.uniqueCount})
            </p>
            {column.uniqueCount <= 20 ? (
              <ResponsiveContainer width="100%" height={Math.min(chartData.length * 28, 260)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="value"
                    width={80}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) =>
                      String(v).length > 12 ? String(v).slice(0, 12) + "…" : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(v: number, _: string, props: { payload?: { value: string; percent: number } }) => [
                      `${v.toLocaleString()} (${props.payload?.percent?.toFixed(1)}%)`,
                      "Count",
                    ]}
                    contentStyle={{
                      fontSize: 11,
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="space-y-1.5">
                {chartData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-xs font-mono text-foreground truncate">{item.value}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
