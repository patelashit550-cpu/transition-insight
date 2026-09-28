import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const SVG_PATH = "public/visuals/sundial_letters_outer.svg";
const LANDING_PAGE = "src/app/(landing)/page.tsx";
const WATERMARK_COMPONENT = "src/components/features/CompassWatermark.tsx";
const GLOBALS_CSS = "src/app/globals.css";

function firstRuleBlock(css: string, selector: string): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle);
  assert.ok(start >= 0, `missing ${selector} rule in ${GLOBALS_CSS}`);
  const brace = css.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(brace + 1, i);
    }
  }
  assert.fail(`unclosed ${selector} rule`);
}

test("landing home mounts CompassWatermark", () => {
  const page = readFileSync(LANDING_PAGE, "utf8");
  assert.match(page, /import\s+\{\s*CompassWatermark\s*\}\s+from\s+"@\/components\/features\/CompassWatermark"/);
  assert.match(page, /<CompassWatermark\s*\/>/);
});

test("CompassWatermark uses useEffect and the sundial SVG via withBasePath", () => {
  const source = readFileSync(WATERMARK_COMPONENT, "utf8");
  assert.match(source, /useEffect\s*\(/);
  assert.doesNotMatch(source, /<script[\s>]/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(
    source,
    /<img\s+src=\{withBasePath\("\/visuals\/sundial_letters_outer\.svg"\)\}/,
  );
});

test("sundial SVG remains in the public tree", () => {
  assert.equal(existsSync(SVG_PATH), true, `${SVG_PATH} must remain committed`);
  const svg = readFileSync(SVG_PATH, "utf8");
  assert.match(svg, /<svg[\s>]/i);
  assert.ok(svg.length > 500, "sundial SVG looks empty");
});

test("compass CSS keeps the wheel visible (ghost opacity, not hidden)", () => {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const block = firstRuleBlock(css, ".p3-compass-watermark");
  assert.doesNotMatch(block, /display\s*:\s*none/);
  assert.doesNotMatch(block, /visibility\s*:\s*hidden/);
  const opacity = block.match(/opacity\s*:\s*([0-9.]+)/);
  assert.ok(opacity, "base .p3-compass-watermark must set opacity");
  assert.ok(Number(opacity[1]) > 0, "base opacity must not be 0 — proximity reveal may raise it");
  assert.match(css, /\.p3-compass-watermark\.is-revealed\s*\{/);
});
