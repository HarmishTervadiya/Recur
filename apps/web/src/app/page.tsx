import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { Hero } from "../components/sections/Hero";
import { TrustStrip } from "../components/sections/TrustStrip";
import { Problem } from "../components/sections/Problem";
import { HowItWorks } from "../components/sections/HowItWorks";
import { SDKPreview } from "../components/sections/SDKPreview";
import { DashboardPreview } from "../components/sections/DashboardPreview";
import { Pricing } from "../components/sections/Pricing";
import { VsStripe } from "../components/sections/VsStripe";
import { UseCases } from "../components/sections/UseCases";
import { FAQ } from "../components/sections/FAQ";
import { CTA } from "../components/sections/CTA";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <Problem />
        <HowItWorks />
        <SDKPreview />
        <DashboardPreview />
        <Pricing />
        <VsStripe />
        <UseCases />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
