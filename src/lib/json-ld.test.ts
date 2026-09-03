import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializeJsonLd, splitEmbeddedJsonLd } from "./json-ld.ts";

describe("serializeJsonLd", () => {
  it("escapes literal </script> so HTML parsers cannot close the script tag", () => {
    const payload = {
      "@type": "BlogPosting",
      headline: "Hello </script><script>alert(1)</script>",
    };
    const serialized = serializeJsonLd(payload);

    assert.equal(serialized.includes("</script>"), false);
    assert.equal(serialized.includes("</Script>"), false);
    assert.match(serialized, /\\u003c\/script>/i);
    assert.deepEqual(JSON.parse(serialized), payload);
  });

  it("escapes uppercase script closers (HTML end tags are case-insensitive)", () => {
    const serialized = serializeJsonLd({ headline: "x </SCRIPT> y" });
    assert.equal(/<\/script>/i.test(serialized), false);
    assert.deepEqual(JSON.parse(serialized), { headline: "x </SCRIPT> y" });
  });

  it("round-trips ordinary titles unchanged after parse", () => {
    const payload = { headline: "The Social Network", description: "a < b" };
    const serialized = serializeJsonLd(payload);
    assert.deepEqual(JSON.parse(serialized), payload);
  });
});

describe("splitEmbeddedJsonLd", () => {
  it("strips the machine layer and returns parsed graphs", () => {
    const md = `## Soundness\n\nProse stays.\n\n<script type="application/ld+json">\n{"@type":"schema:DefinedTerm","schema:name":"Carta"}\n</script>\n`;
    const { prose, graphs } = splitEmbeddedJsonLd(md);
    assert.equal(prose.includes("<script"), false);
    assert.match(prose, /Prose stays/);
    assert.equal(graphs.length, 1);
    assert.deepEqual(graphs[0], { "@type": "schema:DefinedTerm", "schema:name": "Carta" });
  });

  it("still strips invalid JSON so it never renders as text", () => {
    const { prose, graphs } = splitEmbeddedJsonLd(
      `Hello\n<script type="application/ld+json">{not json}</script>`
    );
    assert.equal(prose, "Hello");
    assert.equal(graphs.length, 0);
  });
});
