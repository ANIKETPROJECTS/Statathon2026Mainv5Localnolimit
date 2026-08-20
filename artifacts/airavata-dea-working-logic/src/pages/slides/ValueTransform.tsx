export default function ValueTransform() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="px-[7vw] pt-[7vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">04 / TRANSFORMATION</p><h2 className="mt-[2vh] font-display text-[4.2vw] font-bold leading-none tracking-[-0.05em]">How one value is transformed</h2></div>
      <div className="mt-[6vh] flex items-center justify-between px-[7vw]">
        <div className="w-[18vw] rounded-[1.2vw] bg-[#17324d] p-[2.3vw] text-center text-[#f4f0e8]"><p className="font-body text-[1.4vw] uppercase tracking-[0.16em] text-[#b9d5cf]">Input</p><p className="mt-[3vh] font-mono text-[3.4vw] text-[#d99b45]">AB-123</p></div>
        <div className="font-display text-[3vw] text-[#d99b45]">→</div>
        <div className="w-[35vw] rounded-[1.2vw] border border-[#17324d]/15 bg-white/65 p-[2vw]"><p className="font-body text-[1.4vw] uppercase tracking-[0.16em] text-[#0f766e]">Per character</p><div className="mt-[2.5vh] grid grid-cols-4 gap-[0.7vw] text-center font-body text-[1.5vw] font-bold"><div className="rounded-[0.8vw] bg-[#e7d7bf] p-[1.5vh]">ADD</div><div className="rounded-[0.8vw] bg-[#d2e2df] p-[1.5vh]">SUBTRACT</div><div className="rounded-[0.8vw] bg-[#e7d7bf] p-[1.5vh]">MULTIPLY</div><div className="rounded-[0.8vw] bg-[#d2e2df] p-[1.5vh]">FLIP</div></div><p className="mt-[2.5vh] font-mono text-[1.6vw] text-[#607286]">operation = keystream byte mod 4</p><p className="mt-[1.5vh] font-body text-[1.6vw] text-[#607286]">Five bytes are consumed by each character.</p></div>
        <div className="font-display text-[3vw] text-[#d99b45]">→</div>
        <div className="w-[18vw] rounded-[1.2vw] bg-[#0f766e] p-[2.3vw] text-center text-[#f4f0e8]"><p className="font-body text-[1.4vw] uppercase tracking-[0.16em] text-[#d7e4e2]">Output</p><p className="mt-[3vh] font-mono text-[3.4vw] text-[#f4f0e8]">QX-804</p></div>
      </div>
      <div className="mt-[8vh] px-[7vw]"><div className="flex items-center justify-between rounded-[1vw] bg-[#17324d] px-[3vw] py-[2.5vh] font-display text-[2.2vw] text-[#f4f0e8]"><span>Round 1</span><span className="text-[#d99b45]">→</span><span>Round 2</span><span className="text-[#d99b45]">→</span><span>Round 3</span><span className="text-[#d99b45]">→</span><span>Round 4</span></div><p className="mt-[2vh] font-body text-[1.6vw] text-[#607286]">Decryption uses inverse operations and applies the rounds in reverse order.</p></div>
    </div>
  );
}