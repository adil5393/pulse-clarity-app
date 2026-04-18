import React from "react";
import { Link } from "react-router-dom";
import { Phone, Video, Shield, Zap, MessageCircle, Share2, Moon, Sun } from "lucide-react";
import { Button } from "../components/ui/button";
import { useTheme } from "../lib/theme";

export default function Landing() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground grid-bg">
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-9 h-9 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
            <span className="font-semibold text-lg tracking-tight">Pulse</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggle} data-testid="theme-toggle" className="p-2 rounded-lg hover:bg-muted transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Link to="/login"><Button variant="ghost" data-testid="nav-login">Login</Button></Link>
            <Link to="/register"><Button data-testid="nav-start" className="bg-primary hover:bg-primary/90">Start Free</Button></Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-28 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse"/>
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Live · Ultra low latency</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            Connect instantly.<br/>
            <span className="text-primary">Talk</span>, share, and <span className="text-[hsl(var(--accent))]">collaborate</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            A premium communication platform. HD video, crystal voice, secure file sharing — all in one frictionless workspace.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/register"><Button size="lg" data-testid="hero-start" className="bg-primary hover:bg-primary/90 h-12 px-8">Start Free</Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" data-testid="hero-login" className="h-12 px-8">Login</Button></Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full ring-2 ring-background bg-gradient-to-br from-primary to-[hsl(var(--accent))]"/>)}
            </div>
            <span>Trusted by 10k+ teams worldwide</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 to-[hsl(var(--accent))]/20 blur-3xl rounded-[32px]"/>
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="aspect-[4/5] relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--accent))] ripple relative"/>
                    <div className="mt-6 text-center text-white">
                      <div className="text-lg font-medium">Alex Morgan</div>
                      <div className="text-sm text-white/60 tabular-nums">00:42</div>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 inset-x-4 glass rounded-2xl p-3 flex justify-center gap-2">
                  <div className="w-11 h-11 rounded-full bg-white/10 grid place-items-center"><Phone className="w-4 h-4 text-white"/></div>
                  <div className="w-11 h-11 rounded-full bg-white/10 grid place-items-center"><Video className="w-4 h-4 text-white"/></div>
                  <div className="w-11 h-11 rounded-full bg-red-500 grid place-items-center"><Phone className="w-4 h-4 text-white rotate-[135deg]"/></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-12 gap-6">
        {[
          {icon: Phone, title: "Crystal voice calls", desc: "Studio-grade audio with noise suppression.", span: "md:col-span-5"},
          {icon: Video, title: "HD video meetings", desc: "1080p video, 60fps. No compromises.", span: "md:col-span-7"},
          {icon: Share2, title: "Share anything", desc: "Drag, drop, done.", span: "md:col-span-4"},
          {icon: Zap, title: "Cross-device sync", desc: "Pick up where you left off.", span: "md:col-span-4"},
          {icon: Shield, title: "End-to-end trust", desc: "Secure by default.", span: "md:col-span-4"},
        ].map((f, i) => (
          <div key={i} className={`${f.span} p-8 rounded-2xl border border-border bg-card hover:shadow-lg transition-all`}>
            <div className="w-11 h-11 rounded-xl bg-primary/10 grid place-items-center text-primary mb-5"><f.icon className="w-5 h-5"/></div>
            <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
            <p className="text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border mt-10">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap justify-between gap-4 text-sm text-muted-foreground">
          <div>© 2026 Pulse. Built for clarity.</div>
          <div className="flex gap-6"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></div>
        </div>
      </footer>
    </div>
  );
}
