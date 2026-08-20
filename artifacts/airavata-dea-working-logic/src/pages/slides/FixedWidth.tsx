export default function FixedWidth() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="absolute right-[-8vw] top-[-12vh] h-[42vh] w-[42vh] rounded-full border-[1.5vh] border-[#d99b45]/30" />
      <div className="px-[7vw] pt-[8vh]">
        <p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">01 / INPUT → STRUCTURE</p>
        <h2 className="mt-[2vh] max-w-[70vw] font-display text-[4.2vw] font-bold leading-[0.98] tracking-[-0.05em]">From fixed-width text to usable data</h2>
      </div>
      <div className="mt-[7vh] grid grid-cols-[1fr_0.16fr_1fr] items-center gap-[2vw] px-[7vw]">
        <div className="rounded-[1.4vw] bg-[#17324d] p-[3vw] text-[#f4f0e8]">
          <p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.16em] text-[#b9d5cf]">Raw record</p>
          <p className="mt-[4vh] font-mono text-[2.1vw] leading-[1.7] text-[#d99b45]">00001234ANIKET<br />SHARMA&nbsp;&nbsp;&nbsp;&nbsp;411001M</p>
          <p className="mt-[4vh] font-body text-[1.7vw] leading-snug text-[#d7e4e2]">The layout file tells the application where each field begins and ends.</p>
        </div>
        <div className="text-center font-display text-[4vw] text-[#d99b45]">→</div>
        <div className="rounded-[1.4vw] border-[0.15vw] border-[#0f766e]/30 bg-white/60 p-[3vw]">
          <p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.16em] text-[#0f766e]">Readable CSV</p>
          <div className="mt-[3vh] overflow-hidden rounded-[0.8vw] border border-[#17324d]/15 bg-[#fffdf8]">
            <div className="grid grid-cols-2 bg-[#0f766e] px-[1.4vw] py-[1.3vh] font-body text-[1.35vw] font-bold text-white"><span>customer_id</span><span>postcode</span></div>
            <div className="grid grid-cols-2 px-[1.4vw] py-[1.7vh] font-mono text-[1.5vw]"><span>00001234</span><span>411001</span></div>
            <div className="grid grid-cols-2 border-t border-[#17324d]/10 px-[1.4vw] py-[1.7vh] font-mono text-[1.5vw]"><span>00001235</span><span>411002</span></div>
          </div>
          <p className="mt-[4vh] font-body text-[1.7vw] leading-snug text-[#607286]">Excel/CSV layouts and TXT, DAT, FWF, or DATA records are supported.</p>
        </div>
      </div>
      <div className="absolute bottom-[5vh] left-[7vw] font-body text-[1.4vw] text-[#607286]">Field length = end − start + 1</div>
    </div>
  );
}