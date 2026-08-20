export default function Frontend() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="px-[7vw] pt-[8vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">02 / USER JOURNEY</p><h2 className="mt-[2vh] font-display text-[4.2vw] font-bold leading-none tracking-[-0.05em]">The frontend workflow</h2></div>
      <div className="mt-[8vh] grid grid-cols-5 gap-[1vw] px-[7vw]">
        <div className="relative h-[33vh] rounded-[1.2vw] bg-[#17324d] p-[2vw] text-[#f4f0e8]"><span className="font-display text-[4vw] text-[#d99b45]">01</span><p className="mt-[5vh] font-display text-[2.1vw] font-bold">Choose</p><p className="mt-[1.5vh] font-body text-[1.6vw] leading-snug text-[#c5d5d3]">Layout and data file</p></div>
        <div className="relative h-[33vh] rounded-[1.2vw] border border-[#17324d]/15 bg-white/65 p-[2vw]"><span className="font-display text-[4vw] text-[#0f766e]">02</span><p className="mt-[5vh] font-display text-[2.1vw] font-bold">Preview</p><p className="mt-[1.5vh] font-body text-[1.6vw] leading-snug text-[#607286]">Keep the interface responsive</p></div>
        <div className="relative h-[33vh] rounded-[1.2vw] border border-[#17324d]/15 bg-white/65 p-[2vw]"><span className="font-display text-[4vw] text-[#0f766e]">03</span><p className="mt-[5vh] font-display text-[2.1vw] font-bold">Select</p><p className="mt-[1.5vh] font-body text-[1.6vw] leading-snug text-[#607286]">Only columns needing protection</p></div>
        <div className="relative h-[33vh] rounded-[1.2vw] border border-[#17324d]/15 bg-white/65 p-[2vw]"><span className="font-display text-[4vw] text-[#0f766e]">04</span><p className="mt-[5vh] font-display text-[2.1vw] font-bold">Process</p><p className="mt-[1.5vh] font-body text-[1.6vw] leading-snug text-[#607286]">Keys, modes, and progress</p></div>
        <div className="relative h-[33vh] rounded-[1.2vw] bg-[#0f766e] p-[2vw] text-[#f4f0e8]"><span className="font-display text-[4vw] text-[#d99b45]">05</span><p className="mt-[5vh] font-display text-[2.1vw] font-bold">Review</p><p className="mt-[1.5vh] font-body text-[1.6vw] leading-snug text-[#d7e4e2]">Compare and download</p></div>
      </div>
      <p className="absolute bottom-[6vh] left-[7vw] font-body text-[1.7vw] text-[#607286]">The preview is limited for rendering safety; full-file processing is chunked separately.</p>
    </div>
  );
}