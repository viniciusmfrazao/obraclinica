export default function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-blueprint-grid border-b border-line bg-card px-6 md:px-10 py-8 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs tracking-[0.2em] text-blueprint font-mono uppercase mb-1">
          {eyebrow}
        </p>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-ink">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
