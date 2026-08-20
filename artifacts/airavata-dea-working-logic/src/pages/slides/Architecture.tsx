export default function Architecture() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#17324d] text-[#f4f0e8]">
      <div className="px-[7vw] pt-[7vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#b9d5cf]">09 / DELIVERY</p><h2 className="mt-[2vh] max-w-[75vw] font-display text-[4.2vw] font-bold leading-[0.98] tracking-[-0.05em]">Local-first architecture and key takeaway</h2></div>
      <div className="mt-[6vh] grid grid-cols-[1.1fr_0.9fr] gap-[5vw] px-[7vw]">
        <div className="space-y-[1.2vh]">
          <div className="rounded-[1vw] bg-[#f4f0e8] px-[2.5vw] py-[2vh] font-display text-[2.1vw] font-bold text-[#17324d]">React / Vite interface</div>
          <div className="ml-[3vw] text-[2vw] text-[#d99b45]">↓</div>
          <div className="rounded-[1vw] bg-[#0f766e] px-[2.5vw] py-[2vh] font-display text-[2.1vw] font-bold text-[#f4f0e8]">Local processing libraries</div>
          <div className="ml-[3vw] text-[2vw] text-[#d99b45]">↓</div>
          <div className="rounded-[1vw] bg-[#f4f0e8] px-[2.5vw] py-[2vh] font-display text-[2.1vw] font-bold text-[#17324d]">Browser / Electron APIs</div>
          <div className="ml-[3vw] text-[2vw] text-[#d99b45]">↓</div>
          <div className="rounded-[1vw] bg-[#0f766e] px-[2.5vw] py-[2vh] font-display text-[2.1vw] font-bold text-[#f4f0e8]">CSV, Blob, download</div>
        </div>
        <div className="border-l-[0.2vw] border-[#b9d5cf]/30 pl-[3vw]"><p className="font-display text-[2.6vw] font-bold text-[#d99b45]">The takeaway</p><p className="mt-[3vh] font-body text-[2vw] leading-snug text-[#d7e4e2]">AIRAVATA DEA converts, protects, verifies, and measures — while retaining clear security limitations.</p><p className="mt-[4vh] font-body text-[1.7vw] leading-snug text-[#b9d5cf]">Approximately 50,000-row chunks keep progress visible while larger files are processed.</p><p className="mt-[4vh] font-body text-[1.6vw] leading-snug text-[#b9d5cf]">Electron packages the same application for desktop use.</p></div>
      </div>
      <div className="absolute bottom-[5vh] left-[7vw] font-body text-[1.35vw] uppercase tracking-[0.18em] text-[#b9d5cf]">Local-first / Reversible / Measurable</div>
    </div>
  );
}