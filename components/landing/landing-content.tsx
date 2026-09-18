import Link from "next/link";

export function LandingContent() {
  return (
    <div className="min-h-screen bg-[#171717] text-ink antialiased font-sans">
      {/* =========================================================
           HERO
      ========================================================== */}
      <section className="hero min-h-screen overflow-hidden">
        <header className="max-w-[1280px] mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[11px] bg-ink flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border border-orange relative">
                <span className="absolute w-1.5 h-1.5 bg-orange rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            <span className="font-semibold tracking-tight text-ink">
              AI Study Companion
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
            <a href="#experience" className="hover:text-black transition">
              Experience
            </a>
            <a href="#continue" className="hover:text-black transition">
              Continue learning
            </a>
            <Link href="/login" className="hover:text-black transition">
              Sign in
            </Link>
          </nav>

          <Link
            href="/signup"
            className="bg-ink text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-neutral-800 transition"
          >
            Get started
          </Link>
        </header>

        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="min-h-[calc(100vh-88px)] grid lg:grid-cols-12 items-center gap-8 py-12">
            {/* HERO COPY */}
            <div className="lg:col-span-5 relative z-10">
              <div className="fade-up flex items-center gap-3 mb-7">
                <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
                <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
                  A learning workspace
                </span>
              </div>

              <h1 className="fade-up delay-1 display text-[4rem] sm:text-[5rem] lg:text-[6.2rem] leading-[.9] text-ink">
                Learn with{" "}
                <em className="text-orange not-italic">context.</em>
                <br />
                Grow with <em>purpose.</em>
              </h1>

              <p className="fade-up delay-2 mt-8 text-lg md:text-xl leading-relaxed text-neutral-600 max-w-[500px]">
                A learning companion that understands what you&apos;re studying,
                remembers where you are, and helps you decide what to do next.
              </p>

              <div className="fade-up delay-3 mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-3 bg-ink text-white px-6 py-3.5 rounded-full font-medium hover:bg-neutral-800 transition"
                >
                  Start learning
                  <span>→</span>
                </Link>

                <a
                  href="#experience"
                  className="text-sm font-medium text-neutral-500 hover:text-black transition"
                >
                  See how it works ↓
                </a>
              </div>
            </div>

            {/* ROBOT */}
            <div className="lg:col-span-4 flex justify-center relative">
              <div className="absolute w-[360px] h-[360px] rounded-full bg-orange/10 blur-3xl pointer-events-none" />

              <div className="robot relative z-10">
                {/* antenna */}
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-orange border-[3px] border-orange/30" />
                  <div className="w-1.5 h-6 bg-neutral-800 rounded-full" />
                </div>

                {/* head */}
                <div className="relative w-[250px] sm:w-[290px] h-[175px] sm:h-[200px] bg-gradient-to-br from-[#FFAD45] via-[#F47720] to-[#D94B10] rounded-[48px] p-3 shadow-[0_30px_55px_rgba(217,75,16,.28)]">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-16 bg-neutral-800 rounded-l-xl" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-16 bg-neutral-800 rounded-r-xl" />

                  {/* face */}
                  <div className="w-full h-full rounded-[38px] bg-[#151515] border border-neutral-700 flex items-center justify-center shadow-[inset_0_5px_25px_rgba(0,0,0,.9)]">
                    <div className="flex flex-col items-center">
                      <div className="flex gap-10">
                        <div className="w-7 h-4 border-t-[4px] border-orange rounded-t-full" />
                        <div className="w-7 h-4 border-t-[4px] border-orange rounded-t-full" />
                      </div>
                      <div className="w-5 h-3 border-b-[4px] border-orange rounded-b-full mt-2" />
                    </div>
                  </div>
                </div>

                {/* neck */}
                <div className="w-16 h-5 mx-auto bg-neutral-800 rounded-md -mt-1" />

                {/* body */}
                <div className="w-[190px] sm:w-[215px] h-[135px] mx-auto bg-gradient-to-br from-[#FFAD45] via-[#F47720] to-[#C9430C] rounded-t-[38px] rounded-b-[24px] shadow-[0_25px_45px_rgba(201,67,12,.25)] flex flex-col items-center pt-5">
                  <div className="w-20 h-10 bg-[#171717] rounded-xl flex items-center justify-center">
                    <span className="text-[9px] text-white tracking-[.18em]">
                      LEARN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* HERO MESSAGE */}
            <div className="lg:col-span-3 lg:pl-8">
              <div className="border-t hairline pt-5">
                <span className="text-[10px] uppercase tracking-[.18em] text-neutral-400">
                  A different starting point
                </span>
              </div>

              <p className="mt-6 display text-3xl leading-tight text-ink">
                You shouldn&apos;t have to explain where you left off every time
                you learn.
              </p>

              <p className="mt-5 text-sm leading-relaxed text-neutral-500">
                Your materials, understanding, mistakes and progress stay
                connected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           THE IDEA
      ========================================================== */}
      <section id="experience" className="bg-white py-32 md:py-40 text-ink">
        <div className="max-w-[1100px] mx-auto px-6 md:px-10">
          <div className="max-w-[760px]">
            <span className="text-[10px] uppercase tracking-[.18em] text-orange font-semibold">
              The idea
            </span>

            <h2 className="display text-5xl md:text-7xl leading-[.93] mt-5">
              Learning shouldn&apos;t <em>reset.</em>
            </h2>

            <p className="mt-7 text-lg leading-relaxed text-neutral-500 max-w-[620px]">
              Start with the material you&apos;re already studying. Your
              companion builds the context around it and carries the important
              parts forward.
            </p>
          </div>

          {/* CONTEXT VISUAL */}
          <div className="mt-20 grid md:grid-cols-3 gap-px bg-neutral-200 border border-neutral-200 rounded-[24px] overflow-hidden product-shadow">
            <div className="bg-[#F5F3EE] p-8 md:p-10">
              <div className="text-[10px] uppercase tracking-[.16em] text-neutral-400">
                What you&apos;re learning
              </div>
              <div className="mt-12 display text-3xl">
                Computer Networks
              </div>
              <div className="mt-3 text-sm text-neutral-500">
                Network Security
              </div>
            </div>

            <div className="bg-white p-8 md:p-10">
              <div className="text-[10px] uppercase tracking-[.16em] text-neutral-400">
                What you understand
              </div>
              <div className="mt-12 text-4xl font-semibold">
                67%
              </div>
              <div className="mt-3 text-sm text-neutral-500">
                Overall concept mastery
              </div>
            </div>

            <div className="bg-[#F5F3EE] p-8 md:p-10">
              <div className="text-[10px] uppercase tracking-[.16em] text-neutral-400">
                Where you need attention
              </div>
              <div className="mt-12 display text-3xl">
                Authentication
              </div>
              <div className="mt-3 text-sm text-orange">
                Needs reinforcement
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           COMPANION
      ========================================================== */}
      <section className="bg-[#F5F3EE] py-32 md:py-40 text-ink">
        <div className="max-w-[1180px] mx-auto px-6 md:px-10">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-4">
              <span className="text-[10px] uppercase tracking-[.18em] text-orange font-semibold">
                Your companion
              </span>

              <h2 className="display text-5xl md:text-6xl leading-[.94] mt-5">
                It picks up <em>where you left off.</em>
              </h2>

              <p className="mt-7 text-lg leading-relaxed text-neutral-500">
                You don&apos;t need to repeat your goal, your recent progress or
                what confused you last time.
              </p>
            </div>

            {/* PRODUCT INTERACTION */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[26px] border border-black/10 product-shadow overflow-hidden">
                <div className="px-6 py-4 border-b hairline flex justify-between items-center">
                  <div>
                    <div className="text-sm font-semibold">
                      AI Study Companion
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Computer Networks
                    </div>
                  </div>
                  <div className="text-xs text-neutral-400">
                    Current session
                  </div>
                </div>

                <div className="p-7 md:p-10">
                  <div className="max-w-[610px]">
                    <div className="text-xs text-neutral-400 mb-3">
                      Companion
                    </div>

                    <div className="display text-3xl md:text-4xl leading-tight">
                      “Let&apos;s continue with Network Security.”
                    </div>

                    <p className="mt-5 text-sm md:text-base text-neutral-500 leading-relaxed">
                      You improved on the previous quiz, but your last three
                      attempts suggest that authentication still needs
                      reinforcement.
                    </p>

                    <div className="mt-8 grid sm:grid-cols-3 gap-3">
                      <div className="rounded-xl bg-[#F5F3EE] p-4">
                        <div className="text-[10px] uppercase tracking-[.12em] text-neutral-400">
                          Mastery
                        </div>
                        <div className="mt-2 font-semibold">
                          54%
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F5F3EE] p-4">
                        <div className="text-[10px] uppercase tracking-[.12em] text-neutral-400">
                          Recent score
                        </div>
                        <div className="mt-2 font-semibold">
                          62%
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F5F3EE] p-4">
                        <div className="text-[10px] uppercase tracking-[.12em] text-neutral-400">
                          Attention
                        </div>
                        <div className="mt-2 font-semibold">
                          Authentication
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-5 border-t hairline pt-6">
                      <div>
                        <div className="text-xs text-neutral-400">
                          Recommended
                        </div>
                        <div className="text-sm font-medium mt-1">
                          Practice Authentication
                        </div>
                      </div>

                      <Link
                        href="/signup"
                        className="bg-ink text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-800 transition"
                      >
                        Continue →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           NOTICE / LEARNING INSIGHT
      ========================================================== */}
      <section className="bg-white py-32 md:py-40 text-ink">
        <div className="max-w-[1050px] mx-auto px-6 md:px-10">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-[.18em] text-orange font-semibold">
              The difference
            </span>

            <h2 className="display text-5xl md:text-7xl leading-[.93] mt-5">
              It notices what <em>you might miss.</em>
            </h2>

            <p className="mt-7 text-lg text-neutral-500 max-w-[600px] mx-auto leading-relaxed">
              A wrong answer is not just a wrong answer. Patterns across your
              learning can reveal what needs attention.
            </p>
          </div>

          <div className="mt-16 max-w-[760px] mx-auto">
            <div className="rounded-[26px] bg-[#F5F3EE] p-7 md:p-10 subtle-shadow">
              <div className="flex gap-5">
                <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center flex-shrink-0">
                  <span className="w-2.5 h-2.5 bg-orange rounded-full" />
                </div>

                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[.16em] text-neutral-400">
                    I noticed a pattern
                  </div>

                  <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                    Safe vs unsafe states
                  </h3>

                  <p className="mt-4 text-sm md:text-base text-neutral-500 leading-relaxed">
                    Three recent answers point to the same misconception. You
                    understand deadlock detection, but you&apos;re treating an
                    unsafe state as if a deadlock has already occurred.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-neutral-400">
                          Concept mastery
                        </span>
                        <span className="font-medium">
                          42%
                        </span>
                      </div>

                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div className="h-full w-[42%] bg-orange rounded-full" />
                      </div>
                    </div>

                    <Link
                      href="/signup"
                      className="text-sm font-medium whitespace-nowrap hover:text-orange transition"
                    >
                      Work on this →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           THE LOOP
      ========================================================== */}
      <section className="bg-[#171717] text-white py-32 md:py-40">
        <div className="max-w-[1180px] mx-auto px-6 md:px-10">
          <div className="max-w-[650px]">
            <span className="text-[10px] uppercase tracking-[.18em] text-orange font-semibold">
              The learning loop
            </span>

            <h2 className="display text-5xl md:text-7xl leading-[.93] mt-5">
              Every answer changes <em>what comes next.</em>
            </h2>

            <p className="mt-7 text-lg text-neutral-400 leading-relaxed">
              Learning is not a straight line. Your performance changes the next
              question, the next explanation and the next recommendation.
            </p>
          </div>

          <div className="mt-20 border-y border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-5">
              <div className="p-7 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
                <div className="text-xs text-neutral-500">01</div>
                <div className="mt-12 display text-3xl">Learn</div>
                <div className="mt-3 text-sm text-neutral-500">
                  Understand the material
                </div>
              </div>

              <div className="p-7 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
                <div className="text-xs text-neutral-500">02</div>
                <div className="mt-12 display text-3xl">Practice</div>
                <div className="mt-3 text-sm text-neutral-500">
                  Test your understanding
                </div>
              </div>

              <div className="p-7 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
                <div className="text-xs text-neutral-500">03</div>
                <div className="mt-12 display text-3xl">Understand</div>
                <div className="mt-3 text-sm text-neutral-500">
                  Find what is missing
                </div>
              </div>

              <div className="p-7 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
                <div className="text-xs text-neutral-500">04</div>
                <div className="mt-12 display text-3xl">Master</div>
                <div className="mt-3 text-sm text-neutral-500">
                  Track meaningful progress
                </div>
              </div>

              <div className="p-7 md:p-10 col-span-2 md:col-span-1">
                <div className="text-xs text-neutral-500">05</div>
                <div className="mt-12 display text-3xl text-orange">
                  Continue
                </div>
                <div className="mt-3 text-sm text-neutral-500">
                  Take the next useful step
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           CONTINUITY
      ========================================================== */}
      <section id="continue" className="bg-[#F5F3EE] py-32 md:py-40 text-ink">
        <div className="max-w-[1000px] mx-auto px-6 md:px-10">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-[.18em] text-orange font-semibold">
              Continue
            </span>

            <h2 className="display text-5xl md:text-7xl leading-[.93] mt-5">
              You don&apos;t start from <em>zero every time.</em>
            </h2>

            <p className="mt-7 text-lg text-neutral-500 max-w-[580px] mx-auto leading-relaxed">
              Your next session starts with the context that matters.
            </p>
          </div>

          <div className="mt-16 max-w-[760px] mx-auto">
            <div className="bg-[#171717] text-white rounded-[28px] p-7 md:p-10 product-shadow">
              <div className="flex justify-between items-start gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[.16em] text-neutral-500">
                    Continue learning
                  </div>

                  <h3 className="display text-4xl mt-3">
                    Computer Networks
                  </h3>

                  <p className="text-sm text-neutral-500 mt-2">
                    Last studied · Network Security
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-semibold">67%</div>
                  <div className="text-xs text-neutral-500">mastery</div>
                </div>
              </div>

              <div className="mt-10">
                <div className="text-[10px] uppercase tracking-[.16em] text-neutral-500">
                  Your next step
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="font-medium">
                      Practice Authentication
                    </div>
                    <div className="text-sm text-neutral-500 mt-1">
                      12 min · Recommended from recent learning evidence
                    </div>
                  </div>

                  <Link
                    href="/signup"
                    className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-orange hover:text-white transition inline-block text-center"
                  >
                    Continue →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           FINAL CTA
      ========================================================== */}
      <section className="bg-white py-32 md:py-40 text-ink">
        <div className="max-w-[850px] mx-auto px-6 text-center">
          <div className="w-2.5 h-2.5 bg-orange rounded-full mx-auto mb-9" />

          <h2 className="display text-6xl md:text-8xl leading-[.88]">
            Keep learning.
            <br />
            <em>We&apos;ll remember where.</em>
          </h2>

          <p className="mt-8 text-lg text-neutral-500 max-w-[520px] mx-auto leading-relaxed">
            Start with what you&apos;re learning today and continue from there.
          </p>

          <Link
            href="/signup"
            className="inline-flex items-center gap-3 mt-9 bg-ink text-white px-7 py-3.5 rounded-full font-medium hover:bg-neutral-800 transition"
          >
            Get started
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* =========================================================
           FOOTER
      ========================================================== */}
      <footer className="bg-[#171717] text-white">
        <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-10">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
                <span className="font-semibold">AI Study Companion</span>
              </div>

              <p className="text-sm text-neutral-500 mt-4 max-w-[330px]">
                A contextual learning workspace built around your materials,
                progress and next step.
              </p>
            </div>

            <div className="flex gap-7 text-sm text-neutral-500 items-center">
              <Link href="/login" className="hover:text-white transition">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-white transition">
                Get started
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 text-xs text-neutral-600">
            © 2026 AI Study Companion
          </div>
        </div>
      </footer>
    </div>
  );
}
