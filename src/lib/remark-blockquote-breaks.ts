import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * CommonMark collapses newlines inside a single blockquote paragraph into spaces.
 * For verse / epigraph blockquotes, preserve author line breaks as `<br>`.
 */
export const remarkBlockquoteBreaks: Plugin<[], Root> = () => (tree) => {
  visit(tree, "blockquote", (blockquote) => {
    visit(blockquote, "text", (node, index, parent) => {
      if (index == null || !parent || !("children" in parent)) return;
      const value = node.value;
      if (!value.includes("\n")) return;

      const children: Array<{ type: "text"; value: string } | { type: "break" }> = [];
      const parts = value.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] !== "") children.push({ type: "text", value: parts[i]! });
        if (i < parts.length - 1) children.push({ type: "break" });
      }

      parent.children.splice(index, 1, ...children);
    });
  });
};

export default remarkBlockquoteBreaks;
