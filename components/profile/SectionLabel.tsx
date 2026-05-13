export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
      {children}
    </p>
  );
}
