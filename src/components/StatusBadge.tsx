import { ActivityStatus, STATUS_LABELS } from "@/lib/types";

const STYLES: Record<ActivityStatus, string> = {
  planejado: "bg-line/40 text-ink-soft border-line",
  em_andamento: "bg-safety/10 text-safety border-safety/40",
  concluido: "bg-success/10 text-success border-success/40",
};

export default function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}
