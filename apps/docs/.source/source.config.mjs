// source.config.ts
import { defineCollections, defineConfig, frontmatterSchema } from "fumadocs-mdx/config";
var docs = defineCollections({
  type: "doc",
  dir: "content/docs",
  schema: frontmatterSchema
});
var source_config_default = defineConfig({
  mdxOptions: {
    // Enable GitHub-flavored markdown tables, etc.
  }
});
export {
  source_config_default as default,
  docs
};
