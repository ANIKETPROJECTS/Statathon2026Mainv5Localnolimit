export default function Diversity() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="px-[7vw] pt-[7vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">07 / PRIVACY METRICS</p><h2 className="mt-[2vh] font-display text-[4.2vw] font-bold leading-none tracking-[-0.05em]">Beyond k-anonymity</h2></div>
      <div className="mt-[6vh] grid grid-cols-2 gap-[2vw] px-[7vw]">
        <div className="rounded-[1.4vw] bg-[#17324d] p-[3vw] text-[#f4f0e8]"><p className="font-display text-[2.8vw] font-bold text-[#d99b45]">l-diversity</p><p className="mt-[3vh] font-body text-[2vw] leading-snug text-[#d7e4e2]">Counts distinct sensitive values inside every equivalence class.</p><div className="mt-[5vh] flex gap-[0.8vw] font-body text-[1.5vw]"><span className="rounded-full bg-[#0f766e] px-[1.2vw] py-[1vh]">Diabetes</span><span className="rounded-full bg-[#0f766e] px-[1.2vw] py-[1vh]">Asthma</span><span className="rounded-full bg-[#0f766e] px-[1.2vw] py-[1vh]">Healthy</span></div></div>
        <div className="rounded-[1.4vw] border border-[#17324d]/15 bg-white/65 p-[3vw]"><p className="font-display text-[2.8vw] font-bold text-[#0f766e]">t-closeness</p><p className="mt-[3vh] font-body text-[2vw] leading-snug text-[#607286]">Compares local and global sensitive-value distributions.</p><p className="mt-[4vh] font-mono text-[2.5vw] text-[#17324d]">TVD = 0.5 × Σ |local − global|</p><p className="mt-[3vh] font-body text-[1.8vw] text-[#607286]">Example: <strong className="text-[#17324d]">0.30</strong> fails a threshold of <strong className="text-[#17324d]">0.20</strong>.</p></div>
      </div>
      <p className="absolute bottom-[6vh] left-[7vw] font-body text-[1.7vw] text-[#607286]">These checks expose sensitive-value concentration and attribute-inference risk.</p>
    </div>
  );
}