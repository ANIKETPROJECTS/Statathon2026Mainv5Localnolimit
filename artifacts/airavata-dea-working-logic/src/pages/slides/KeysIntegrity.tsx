export default function KeysIntegrity() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f4f0e8] text-[#17324d]">
      <div className="px-[7vw] pt-[8vh]"><p className="font-body text-[1.5vw] font-bold uppercase tracking-[0.22em] text-[#0f766e]">05 / TRUST LAYER</p><h2 className="mt-[2vh] font-display text-[4.2vw] font-bold leading-none tracking-[-0.05em]">Keys, salt, and integrity</h2></div>
      <div className="mt-[7vh] grid grid-cols-3 gap-[1.5vw] px-[7vw]">
        <div className="rounded-[1.2vw] bg-[#17324d] p-[2.5vw] text-[#f4f0e8]"><p className="font-display text-[2.2vw] font-bold text-[#d99b45]">01</p><h3 className="mt-[4vh] font-display text-[2.2vw] font-bold">Key material</h3><p className="mt-[2vh] font-body text-[1.7vw] leading-snug text-[#d7e4e2]">Seed mode, PBKDF2 passphrase mode, or a 64-character raw hexadecimal key.</p></div>
        <div className="rounded-[1.2vw] border border-[#17324d]/15 bg-white/65 p-[2.5vw]"><p className="font-display text-[2.2vw] font-bold text-[#0f766e]">02</p><h3 className="mt-[4vh] font-display text-[2.2vw] font-bold">Fresh salt</h3><p className="mt-[2vh] font-body text-[1.7vw] leading-snug text-[#607286]">A cryptographically secure 128-bit export salt makes separate exports different.</p></div>
        <div className="rounded-[1.2vw] bg-[#0f766e] p-[2.5vw] text-[#f4f0e8]"><p className="font-display text-[2.2vw] font-bold text-[#d99b45]">03</p><h3 className="mt-[4vh] font-display text-[2.2vw] font-bold">Integrity seal</h3><p className="mt-[2vh] font-body text-[1.7vw] leading-snug text-[#d7e4e2]">HMAC-SHA-256 is checked before any value is decrypted.</p></div>
      </div>
      <div className="absolute bottom-[6vh] left-[7vw] font-mono text-[1.65vw] text-[#607286]">PBKDF2 / HMAC-SHA-256 / HKDF-SHA-256 / CSPRNG</div>
    </div>
  );
}