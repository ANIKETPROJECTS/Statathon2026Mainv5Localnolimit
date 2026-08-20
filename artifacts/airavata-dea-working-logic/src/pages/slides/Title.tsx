const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#17324d] text-[#f4f0e8]">
      <img src={`${base}hero-data-flow.png`} crossOrigin="anonymous" alt="Abstract data stream becoming structured columns" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#17324d] via-[#17324d]/90 to-[#17324d]/25" />
      <div className="absolute left-[7vw] top-[9vh] h-[0.6vh] w-[9vw] bg-[#d99b45]" />
      <div className="relative z-10 flex h-full flex-col justify-between px-[7vw] py-[8vh]">
        <p className="font-body text-[1.7vw] font-medium uppercase tracking-[0.28em] text-[#b9d5cf]">AIRAVATA DEA / SOFTWARE WALKTHROUGH</p>
        <div className="max-w-[70vw]">
          <h1 className="font-display text-[7vw] font-bold leading-[0.93] tracking-[-0.06em]">AIRAVATA DEA</h1>
          <p className="mt-[3vh] max-w-[48vw] font-body text-[2.3vw] leading-tight text-[#f4f0e8]">Convert legacy data. Protect selected fields. Measure privacy risk.</p>
          <p className="mt-[5vh] font-body text-[1.7vw] text-[#b9d5cf]">A concise walkthrough of the frontend and processing logic.</p>
        </div>
        <div className="flex items-center gap-[1.4vw] font-body text-[1.4vw] uppercase tracking-[0.18em] text-[#b9d5cf]">
          <span className="h-[1.2vh] w-[1.2vh] rounded-full bg-[#d99b45]" />
          <span>Working / Logic / Privacy</span>
        </div>
      </div>
    </div>
  );
}