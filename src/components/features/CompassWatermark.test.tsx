import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

import { CompassWatermark } from "./CompassWatermark.tsx";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("CompassWatermark", () => {
  it("renders the wheel as element-owned CSS instead of a hydratable child", () => {
    const markup = renderToStaticMarkup(<CompassWatermark />);

    assert.match(markup, /class="p3-compass-watermark"/);
    assert.match(
      markup,
      /--p3-compass-watermark-image:url\(&quot;\/visuals\/sundial_letters_outer\.svg&quot;\)/,
    );
    assert.doesNotMatch(markup, /<img/);
  });

  it("uses the wheel custom property as a contained background", () => {
    const css = readFileSync(join(repoRoot, "src/app/globals.css"), "utf8");

    assert.match(css, /background-image:\s*var\(--p3-compass-watermark-image\)/);
    assert.match(css, /background-size:\s*contain/);
  });
});
