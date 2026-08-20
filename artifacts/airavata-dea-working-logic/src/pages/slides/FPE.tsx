export default function FPE() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#17324d] text-[#f4f0e8]">
      <div className="absolute bottom-[-20vh] right-[-4vw] h-[65vh] w-[65vh] rounded-full border-[1.5vh] border-[#0f766e]/70" />
      <div className="px-[7vw] pt-[8vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#b9d5cf]">03 / PROTECTION</p><h2 className="mt-[2vh] max-w-[70vw] font-display text-[4.2vw] font-bold leading-[0.98] tracking-[-0.05em]">Format-preserving anonymisation</h2></div>
      <div className="mt-[9vh] grid grid-cols-[1.1fr_0.9fr] gap-[7vw] px-[7vw]">
        <div>
          <p className="font-mono text-[4.8vw] font-bold tracking-[0.08em] text-[#d99b45]">AB-123 → QX-804</p>
          <p className="mt-[4vh] max-w-[47vw] font-body text-[2vw] leading-snug text-[#d7e4e2]">The value changes, but the data remains usable: letters stay letters, digits stay digits, and length stays the same.</p>
        </div>
        <div className="space-y-[2.2vh] border-l-[0.2vw] border-[#b9d5cf]/30 pl-[3vw] font-body text-[1.8vw] leading-snug text-[#d7e4e2]">
          <p>Selected non-empty cells pass through four reversible rounds.</p>
          <p>Unselected columns are copied unchanged.</p>
          <p className="text-[#d99b45]">Custom format-preserving transformation — not AES-GCM.</p>
        </div>
      </div>
      <div className="absolute bottom-[6vh] left-[7vw] flex gap-[1vw] font-body text-[1.4vw] uppercase tracking-[0.16em] text-[#b9d5cf]"><span className="rounded-full border border-[#b9d5cf]/40 px-[1.2vw] py-[1vh]">same length</span><span className="rounded-full border border-[#b9d5cf]/40 px-[1.2vw] py-[1vh]">same class</span><span className="rounded-full border border-[#b9d5cf]/40 px-[1.2vw] py-[1vh]">reversible</span></div>
    </div>
  );
}