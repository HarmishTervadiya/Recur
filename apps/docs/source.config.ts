import { defineCollections, defineConfig, frontmatterSchema } from "fumadocs-mdx/config";

export const docs = defineCollections({
  type: "doc",
  dir: "content/docs",
  schema: frontmatterSchema,
});

export default defineConfig({
  mdxOptions: {
    // Enable GitHub-flavored markdown tables, etc.
  },
});
