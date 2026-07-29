import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DataProfile } from "@/lib/csv-profiler";

interface Props {
  profile: DataProfile;
}

const PAGE_SIZE = 25;

export function DataPreviewTable({ profile }: Props) {
  const [page, setPage] = useState(0);

  const rows = profile.previewRows;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Data Preview</p>
        <p className="text-xs text-muted-foreground">
          Showing first {Math.min(100, profile.totalRows).toLocaleString()} rows
          {profile.totalRows > 100 && ` of ${profile.totalRows.toLocaleString()} total`}
        </p>
      </div>

      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground border-b border-border w-10">#</th>
              {profile.columns.map((col) => (
                <th
                  key={col.srlNo}
                  className="px-3 py-2.5 text-left font-medium text-foreground border-b border-border whitespace-nowrap"
                >
                  {col.name}
                  <span className="ml-1 text-muted-foreground/60 font-normal text-[10px]">{col.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                <td className="px-3 py-2 text-center text-muted-foreground font-mono">
                  {page * PAGE_SIZE + rowIdx + 1}
                </td>
                {profile.columns.map((col) => {
                  const val = row[col.name];
                  return (
                    <td key={col.srlNo} className="px-3 py-2 font-mono text-foreground max-w-[200px]">
                      {val === "" || val === null || val === undefined ? (
                        <span className="text-muted-foreground/40 italic">null</span>
                      ) : (
                        <span className="truncate block" title={val}>{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
              .map((i, idx, arr) => (
                <span key={i}>
                  {idx > 0 && arr[idx - 1] !== i - 1 && (
                    <span className="text-muted-foreground px-1">…</span>
                  )}
                  <button
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                      i === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
