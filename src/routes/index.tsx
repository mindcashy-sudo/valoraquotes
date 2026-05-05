import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mic, FileText, Zap, Clock, Users, CheckCircle2 } from "lucide-react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VALORA — Preventivi professionali in pochi minuti" },
      {
        name: "description",
        content:
          "Trasforma una richiesta cliente in un preventivo strutturato e professionale. Pensato per architetti e professionisti.",
      },
    ],
  }),
  component: LandingPage,
});

const easeOut = [0.22, 1, 0.36, 1] as const;

function ScrollNav() {
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const bgOpacity = useTransform(scrollY, [0, 80], [0.6, 0.9]);
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 1]);
  const blurPx = useTransform(scrollY, [0, 80], reduce ? [8, 8] : [10, 20]);
  const blur = useTransform(blurPx, (v) => `blur(${v}px) saturate(180%)`);
  const height = useTransform(scrollY, [0, 80], [104, 76]);
  const logoScale = useTransform(scrollY, [0, 80], [1, 0.92]);
  const shadowOpacity = useTransform(scrollY, [0, 80], [0, 0.06]);
  const shadow = useTransform(shadowOpacity, (o) => `0 1px 0 0 rgb(0 0 0 / ${o}), 0 8px 24px -16px rgb(0 0 0 / ${o * 2})`);

  return (
    <motion.nav
      style={{
        backdropFilter: blur,
        WebkitBackdropFilter: blur,
        boxShadow: shadow,
      }}
      className="fixed top-0 inset-x-0 z-50"
    >
      {/* Background layer with animated opacity */}
      <motion.div
        aria-hidden
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-background pointer-events-none"
      />
      {/* Border layer with animated opacity */}
      <motion.div
        aria-hidden
        style={{ opacity: borderOpacity }}
        className="absolute inset-x-0 bottom-0 h-px bg-border pointer-events-none"
      />
      <motion.div
        style={{ height }}
        className="relative max-w-6xl mx-auto flex items-center justify-between px-6"
      >
        <motion.div style={{ scale: logoScale }} className="flex items-center gap-3 origin-left">
          <img src={valoraLogo} alt="Valora" className="h-28 md:h-32 w-auto" />
        </motion.div>
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            Prova Valora
          </Link>
        </div>
      </motion.div>
    </motion.nav>
  );
}

function LandingPage() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], reduce ? [0, 0] : [0, -40]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.6]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollNav />

      {/* Hero */}
      <section className="pt-36 md:pt-48 pb-20 md:pb-32 px-6">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-valora-green"
              animate={reduce ? {} : { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            Pensato per architetti e professionisti
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easeOut, delay: 0.1 }}
            className="text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.1] tracking-tight text-foreground"
          >
            Crea preventivi professionali
            <br />
            <span className="text-muted-foreground">in pochi minuti</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOut, delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Trasforma una richiesta cliente in un preventivo strutturato, dettagliato e pronto da inviare. Senza perdere tempo.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOut, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/app"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-lg shadow-primary/10"
            >
              Prova Valora gratis
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <span className="text-sm text-muted-foreground">
              Nessun login richiesto · 3 preventivi gratuiti
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem */}
      <section className="py-20 md:py-28 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">Il problema</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Fare preventivi è lento e ripetitivo
            </h2>
          </Reveal>
          <RevealStagger className="grid md:grid-cols-3 gap-8" stagger={0.12}>
            {[
              {
                icon: Clock,
                title: "Ore di lavoro",
                desc: "Ogni preventivo richiede ricerca, calcolo e formattazione. Tempo sottratto al progetto.",
              },
              {
                icon: FileText,
                title: "Struttura inconsistente",
                desc: "Senza un formato standard, ogni preventivo è diverso. Meno credibilità professionale.",
              },
              {
                icon: Users,
                title: "Clienti che aspettano",
                desc: "Più tempo per rispondere significa più rischio di perdere il lavoro a un concorrente più veloce.",
              },
            ].map((item) => (
              <RevealItem key={item.title} className="space-y-3 group">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center transition-all duration-300 group-hover:bg-valora-green/10 group-hover:scale-105">
                  <item.icon className="w-5 h-5 text-muted-foreground transition-colors duration-300 group-hover:text-valora-green" />
                </div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 px-6 bg-secondary/50 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">Come funziona</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Tre passaggi. Un preventivo.
            </h2>
          </Reveal>
          <RevealStagger className="grid md:grid-cols-3 gap-12" stagger={0.14}>
            {[
              {
                step: "01",
                icon: Mic,
                title: "Descrivi il progetto",
                desc: "Registra un memo vocale o scrivi la richiesta del cliente. Anche poche frasi bastano.",
              },
              {
                step: "02",
                icon: Zap,
                title: "Valora analizza",
                desc: "Il sistema interpreta la richiesta e genera un preventivo strutturato per sezioni con prezzi realistici.",
              },
              {
                step: "03",
                icon: FileText,
                title: "Preventivo pronto",
                desc: "Rivedi, copia o stampa. Un documento professionale che puoi inviare direttamente al cliente.",
              },
            ].map((item) => (
              <RevealItem key={item.step} className="text-center space-y-4 group">
                <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto shadow-sm transition-all duration-500 group-hover:shadow-lg group-hover:shadow-primary/10 group-hover:-translate-y-1 group-hover:border-valora-green/40">
                  <item.icon className="w-6 h-6 text-foreground transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div>
                  <span className="text-xs font-bold text-valora-green">{item.step}</span>
                  <h3 className="text-lg font-semibold mt-1">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Output preview */}
      <section className="py-20 md:py-28 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">Esempio di output</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Un preventivo che parla per te
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
              Ogni preventivo generato è strutturato come un documento professionale reale, pronto per il cliente.
            </p>
          </Reveal>

          <Reveal y={28}>
            <motion.div
              whileHover={reduce ? {} : { y: -4 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-primary/5 max-w-2xl mx-auto transition-shadow duration-500 hover:shadow-2xl hover:shadow-primary/10"
            >
              {/* Mock header */}
              <div className="bg-primary px-8 py-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/40 mb-2">
                  Preventivo di massima
                </p>
                <h3 className="text-base font-bold text-primary-foreground">
                  Ristrutturazione appartamento 85 mq — Milano, zona Isola
                </h3>
                <p className="text-sm text-primary-foreground/50 mt-1">
                  Ristrutturazione completa con rifacimento impianti e finiture di fascia media
                </p>
              </div>

              <div className="px-8 py-6 space-y-5">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Durata</span>
                    <p className="text-sm font-medium mt-0.5">12–14 settimane</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Finiture</span>
                    <p className="text-sm font-medium mt-0.5">Fascia media</p>
                  </div>
                </div>

                <RevealStagger stagger={0.1} className="space-y-5">
                  {[
                    { num: "01", name: "OPERE EDILI", items: ["Demolizioni e smaltimento", "Nuove tramezzature in laterizio"], sub: "€ 12.450,00" },
                    { num: "02", name: "IMPIANTI", items: ["Nuovo impianto elettrico (punti luce e prese)", "Impianto idrico-sanitario completo"], sub: "€ 18.280,00" },
                    { num: "03", name: "FINITURE INTERNE", items: ["Pavimentazione in gres porcellanato (fornitura e posa)", "Tinteggiatura pareti e soffitti"], sub: "€ 14.650,00" },
                  ].map((s) => (
                    <RevealItem key={s.num} className="space-y-2" y={10}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-valora-green">{s.num}</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{s.name}</span>
                        <div className="flex-1 border-b border-border/30" />
                      </div>
                      {s.items.map((item) => (
                        <div key={item} className="flex justify-between ml-6">
                          <span className="text-[13px] text-card-foreground/80">{item}</span>
                          <span className="text-[13px] text-muted-foreground">—</span>
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <span className="text-sm font-semibold tabular-nums">{s.sub}</span>
                      </div>
                    </RevealItem>
                  ))}
                </RevealStagger>

                {/* Total */}
                <div className="border-t-2 border-valora-green/30 pt-4 flex justify-between items-center">
                  <span className="text-base font-bold">Totale Preventivo</span>
                  <span className="text-xl font-bold text-valora-green tabular-nums">€ 68.780,00</span>
                </div>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 md:py-28 px-6 bg-secondary/50 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">I vantaggi</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Perché scegliere Valora
            </h2>
          </Reveal>
          <RevealStagger className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto" stagger={0.1}>
            {[
              { title: "Risparmi ore di lavoro", desc: "Quello che richiedeva mezza giornata ora si fa in pochi minuti." },
              { title: "Rispondi più velocemente", desc: "Invia preventivi prima dei tuoi concorrenti. La velocità fa la differenza." },
              { title: "Immagine professionale", desc: "Documenti strutturati e curati che comunicano competenza e serietà." },
              { title: "Nessun errore di struttura", desc: "Sezioni standard, voci dettagliate, totali coerenti. Sempre." },
            ].map((item) => (
              <RevealItem key={item.title} className="flex gap-4 group" y={12}>
                <CheckCircle2 className="w-5 h-5 text-valora-green mt-0.5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 px-6 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">Prezzo</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Un solo piano. Tutto incluso.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Prezzo bloccato per i primi 100 architetti.
            </p>
          </Reveal>
          <Reveal>
            <div className="bg-card border-2 border-valora-green/40 rounded-3xl p-8 md:p-10 shadow-xl shadow-valora-green/5 max-w-md mx-auto">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight">€29</span>
                <span className="text-muted-foreground">/mese</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Early Access · cancelli quando vuoi</p>
              <ul className="mt-7 space-y-3">
                {[
                  "Preventivi illimitati",
                  "PDF brandizzati con il tuo logo",
                  "Archivio clienti e progetti",
                  "Onboarding studio in 2 minuti",
                  "Supporto via email",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-valora-green mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/app"
                className="mt-8 group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
              >
                Inizia con 3 preventivi gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 px-6 bg-secondary/40 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-valora-green mb-3">Domande frequenti</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tutto chiaro</h2>
          </Reveal>
          <RevealStagger className="space-y-4" stagger={0.08}>
            {[
              { q: "I prezzi dei preventivi sono affidabili?", a: "Valora usa benchmark di mercato italiani aggiornati (€/mq, impianti, opere edili) e li adatta alla tua zona di lavoro. Restano sempre modificabili prima dell'invio." },
              { q: "Posso usare il mio logo e i miei dati nei PDF?", a: "Sì. In Impostazioni studio carichi logo, P.IVA, IBAN e condizioni standard una volta sola: compaiono automaticamente in ogni PDF generato." },
              { q: "Devo installare qualcosa?", a: "No. Valora funziona nel browser, da desktop e mobile. I dati restano nel tuo account." },
              { q: "Posso cancellare l'abbonamento?", a: "In qualsiasi momento, dal tuo account. Senza penali, senza vincoli." },
            ].map((f) => (
              <RevealItem key={f.q} className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28 px-6 border-t border-border/40">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Il tuo prossimo preventivo, in 2 minuti.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Prova Valora gratis. 3 preventivi inclusi, nessuna carta richiesta.
          </p>
          <Link
            to="/app"
            className="group mt-10 inline-flex items-center gap-2.5 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-lg shadow-primary/10"
          >
            Inizia ora
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={valoraLogo} alt="Valora" className="h-6 w-auto opacity-50 transition-opacity duration-300 hover:opacity-80" />
          </div>
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} Valora · Preventivi intelligenti per professionisti
          </p>
        </div>
      </footer>
    </div>
  );
}
