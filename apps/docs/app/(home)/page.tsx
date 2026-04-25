import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-4 py-1.5 text-sm text-fd-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-fd-primary" />
          Developer Documentation
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">
          Build with{" "}
          <span className="text-fd-primary">Recur</span>
        </h1>

        <p className="mb-8 text-lg text-fd-muted-foreground leading-relaxed">
          Non-custodial recurring payments on Solana. Integrate subscription
          billing into your app with a few lines of code.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/docs/sdk/quickstart"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-fd-border bg-fd-card px-6 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            SDK Quickstart
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "SDK Reference",
              desc: "TypeScript SDK for subscribers and merchants.",
              href: "/docs/sdk/quickstart",
            },
            {
              title: "API Reference",
              desc: "REST API for plans, subscriptions, and webhooks.",
              href: "/docs/api/authentication",
            },
            {
              title: "Protocol",
              desc: "On-chain architecture, PDAs, and fee structure.",
              href: "/docs/protocol/architecture",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-lg border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/50"
            >
              <h3 className="mb-1.5 text-sm font-semibold text-fd-foreground group-hover:text-fd-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-fd-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
