import type { Paragraph, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { allowlistedIframeFromHtml } from "./allowlisted-embed";

/**
 * Lift standalone allowlisted `<iframe>` HTML into an iframe element.
 *
 * remark-parse keeps raw HTML as `html` nodes; react-markdown drops them
 * unless rehype-raw is enabled. Replacing the node with `data.hName =
 * "iframe"` lets mdast-util-to-hast emit a real iframe without executing
 * arbitrary HTML.
 */
export const remarkAllowlistedIframes: Plugin<[], Root> = () => (tree) => {
  visit(tree, "html", (node, index, parent) => {
    if (index == null || !parent || !("children" in parent)) return;
    const embed = allowlistedIframeFromHtml(node.value);
    if (!embed) {
      // Strip unknown/unsafe iframe HTML so it never appears as prose.
      if (/^\s*<iframe\b/i.test(node.value)) {
        parent.children.splice(index, 1);
        return index;
      }
      return;
    }

    const next: Paragraph = {
      type: "paragraph",
      data: {
        hName: "iframe",
        hProperties: {
          src: embed.src,
          title: embed.title,
          allow: embed.allow,
          loading: "lazy",
          width: "100%",
          height: String(embed.height),
          allowFullScreen: true,
          referrerPolicy: "strict-origin-when-cross-origin",
          className: `p3-allowlisted-embed p3-allowlisted-embed--${embed.kind}`,
        },
      },
      children: [],
    };
    parent.children[index] = next;
    return;
  });
};

export default remarkAllowlistedIframes;
