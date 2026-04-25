import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{
        title: (
          <span className="font-semibold tracking-tight">
            <span className="text-fd-primary">Recur</span>{" "}
            <span className="text-fd-muted-foreground font-normal">Docs</span>
          </span>
        ),
        url: "/",
      }}
      links={[
        { text: "Docs", url: "/docs" },
        {
          text: "GitHub",
          url: "https://github.com/HarmishTervadiya/Recur",
          external: true,
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
