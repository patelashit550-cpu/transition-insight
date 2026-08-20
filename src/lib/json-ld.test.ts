import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializeJsonLd } from "./json-ld.ts";

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
