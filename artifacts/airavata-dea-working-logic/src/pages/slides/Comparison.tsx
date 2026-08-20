export default function Comparison() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="px-[7vw] pt-[8vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">08 / VALIDATION</p><h2 className="mt-[2vh] max-w-[80vw] font-display text-[4.2vw] font-bold leading-[0.98] tracking-[-0.05em]">Original vs anonymised: prove the improvement</h2></div>
      <div className="mt-[7vh] grid grid-cols-[1fr_0.18fr_1fr] items-center gap-[1.4vw] px-[7vw]">
        <div className="rounded-[1.2vw] border-[0.15vw] border-[#17324d]/15 bg-white/65 p-[2.5vw]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.16em] text-[#17324d]">Original file</p><p className="mt-[4vh] font-display text-[4.8vw] font-bold text-[#b5523d]">42.9%</p><p className="mt-[1vh] font-body text-[1.6vw] text-[#607286]">Re-identification risk</p><div className="mt-[4vh] h-[1.5vh] rounded-full bg-[#ead9d4]"><div className="h-full w-[72%] rounded-full bg-[#b5523d]" /></div></div>
        <div className="text-center font-display text-[3vw] text-[#d99b45]">→</div>
        <div className="rounded-[1.2vw] bg-[#0f766e] p-[2.5vw] text-[#f4f0e8]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.16em] text-[#d7e4e2]">Anonymised file</p><p className="mt-[4vh] font-display text-[4.8vw] font-bold text-[#f4f0e8]">8.3%</p><p className="mt-[1vh] font-body text-[1.6vw] text-[#d7e4e2]">Re-identification risk</p><div className="mt-[4vh] h-[1.5vh] rounded-full bg-[#b9d5cf]/30"><div className="h-full w-[22%] rounded-full bg-[#d99b45]" /></div></div>
      </div>
      <div className="absolute bottom-[5vh] left-[7vw] flex gap-[2.2vw] font-body text-[1.5vw] text-[#607286]"><span>risk metrics</span><span>changed cells</span><span>preserved values</span><span>recommendations</span></div>
      <p className="absolute bottom-[5vh] right-[7vw] font-body text-[1.35vw] italic text-[#607286]">Illustrative comparison values</p>
    </div>
  );
}