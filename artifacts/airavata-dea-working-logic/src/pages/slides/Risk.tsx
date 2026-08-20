export default function Risk() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#17324d] text-[#f4f0e8]">
      <div className="absolute right-[7vw] top-[10vh] font-display text-[12vw] font-bold leading-none text-[#0f766e]/40">1/k</div>
      <div className="relative px-[7vw] pt-[8vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#b9d5cf]">06 / RISK ASSESSMENT</p><h2 className="mt-[2vh] max-w-[65vw] font-display text-[4.2vw] font-bold leading-[0.98] tracking-[-0.05em]">Risk assessment: the prosecutor attack</h2></div>
      <div className="relative mt-[7vh] grid grid-cols-[1.1fr_0.9fr] gap-[6vw] px-[7vw]">
        <div className="space-y-[2vh] font-body text-[2vw] leading-snug text-[#d7e4e2]"><p>Select quasi-identifiers such as age, postcode, and gender.</p><p>Equal combinations form equivalence classes.</p><p>Small classes are easier for an attacker to isolate.</p></div>
        <div className="rounded-[1.4vw] bg-[#f4f0e8] p-[3vw] text-[#17324d]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.16em] text-[#0f766e]">Link score</p><p className="mt-[2vh] font-mono text-[3.4vw] font-bold text-[#17324d]">1 / |EC|</p><div className="mt-[4vh] grid grid-cols-2 gap-[1vw] font-body text-[1.7vw]"><div className="rounded-[0.8vw] bg-[#e7d7bf] p-[1.5vw]">1 record<br /><strong className="font-display text-[2.6vw]">1.00</strong></div><div className="rounded-[0.8vw] bg-[#d2e2df] p-[1.5vw]">5 records<br /><strong className="font-display text-[2.6vw]">0.20</strong></div></div></div>
      </div>
      <div className="absolute bottom-[6vh] left-[7vw] flex gap-[2.5vw] font-body text-[1.5vw] text-[#b9d5cf]"><span>min-k</span><span>unique records</span><span>high-risk rate</span><span>recommendations</span></div>
    </div>
  );
}