import type { DataProfile } from "@/lib/csv-profiler";

interface Props {
  profile: DataProfile;
}

export function SummaryCards({ profile }: Props) {
  const numericCols = profile.columns.filter((c) => c.type === "numeric").length;
  const textCols = profile.columns.filter((c) => c.type === "text").length;
  const otherCols = profile.columns.length - numericCols - textCols;
  const avgFillRate =
    profile.columns.reduce((acc, c) => acc + c.fillRate, 0) / profile.columns.length;
  const colsWithNulls = profile.columns.filter((c) => c.nullCount > 0).length;

  const cards = [
    {
      label: "Total Rows",
      value: profile.totalRows.toLocaleString(),
      sub: "records in file",
      color: "bg-blue-50 text-blue-700 border-blue-100",
      dot: "bg-blue-500",
    },
    {
      label: "Columns",
      value: profile.totalColumns.toString(),
      sub: `${numericCols} numeric · ${textCols} text · ${otherCols} other`,
      color: "bg-violet-50 text-violet-700 border-violet-100",
      dot: "bg-violet-500",
    },
    {
      label: "Record Length",
      value: `${profile.totalRecordLength}`,
      sub: "total bytes per record",
      color: "bg-amber-50 text-amber-700 border-amber-100",
      dot: "bg-amber-500",
    },
    {
      label: "Avg Fill Rate",
      value: `${avgFillRate.toFixed(1)}%`,
      sub: colsWithNulls > 0 ? `${colsWithNulls} cols have missing values` : "No missing values",
      color:
        avgFillRate > 95
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-rose-50 text-rose-700 border-rose-100",
      dot: avgFillRate > 95 ? "bg-emerald-500" : "bg-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border px-4 py-3.5 ${card.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${card.dot}`} />
            <span className="text-xs font-medium opacity-70">{card.label}</span>
          </div>
          <div className="text-2xl font-bold tracking-tight">{card.value}</div>
          <div className="text-xs opacity-60 mt-0.5 truncate">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
