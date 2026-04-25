import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

export const docsOptions: DocsLayoutProps = {
  tree: source.pageTree,
  nav: {
    title: (
      <span className="font-semibold tracking-tight">
        <span className="text-fd-primary">Recur</span>{" "}
        <span className="text-fd-muted-foreground font-normal">Docs</span>
      </span>
    ),
    url: "/docs",
  },
  links: [
    {
      text: "Protocol",
      url: "https://github.com/HarmishTervadiya/Recur",
      external: true,
    },
  ],
};
