import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { RPAEngine } from "@/components/landing/rpa-engine";
import { RemoteCommand } from "@/components/landing/remote-command";
import { AIEngine } from "@/components/landing/ai-engine";
import { AllModules } from "@/components/landing/all-modules";
import { Architecture } from "@/components/landing/architecture";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <RPAEngine />
        <RemoteCommand />
        <AIEngine />
        <AllModules />
        <Architecture />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
