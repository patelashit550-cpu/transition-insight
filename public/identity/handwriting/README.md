# Handwriting: Ashit Milne

An identity marker for this site, alongside the signing key, DID and ENS/SNS names: samples of my own
handwriting, the font made from them, and the hand-lettered homepage line. Every file here is listed with its
SHA-256 in `MANIFEST.json`.

## Samples (`samples/`)

Phone photos of my handwriting, taken 8 October 2026.

| File | What it is |
|---|---|
| `2026-10-08-homepage-line-notebook.jpg` | First draft of the homepage sentence, on lined notebook paper |
| `2026-10-08-homepage-line-rewrite.jpg` | Clean rewrite of the homepage sentence, three lines, plain paper |
| `2026-10-08-practice-sheet.jpg` | Practice sheet: lower- and upper-case pangrams, two more pangrams, digits 0–9, dash, `& ? ' " ( ) : ; / @ # %` |

The copies here are 2000 px on the long edge and carry no metadata: no EXIF, no location, no camera data.
The full-size originals are kept off-site. They have also had their camera metadata removed, losslessly
(`jpegtran -copy none`; the practice sheet was rotated upright). Their fingerprints:

| Original (full size, not published) | Pixels | Bytes | SHA-256 |
|---|---|---|---|
| `2026-10-08-homepage-line-notebook.jpg` | 4000×3000 | 3,531,062 | `b1c6aa8d6cadcd5ad8847cf37964e0d37c38011b00d051f9d66149c385ef8087` |
| `2026-10-08-homepage-line-rewrite.jpg` | 4000×1170 | 1,275,750 | `63259c8c5ebc6f13a101562d4b2b38929dd064a3c8a5b64d351c36884ac0c3c7` |
| `2026-10-08-practice-sheet.jpg` | 2992×4000 | 3,075,915 | `d6c895c8c75632e11e2ec6576d971e9223371ce049ccccfe5018621b0bb704c7` |

## Font (`font/`): Ashit Hand 0.1

- `AshitHand-Regular.woff2` (web), `.otf` (CFF), `.ttf` (TrueType)
- Licence: SIL Open Font License 1.1 (`font/OFL.txt`). Copyright (c) 2026 Ashit Milne.
- Coverage: A–Z, a–z, 0–9, `. , : ; ' " ( ) / & ? @ # % !`, em dash, typographic quotes (mapped to the
  straight forms), space and no-break space.
- How it was made, with free tools only (OpenCV, scikit-image, potrace, FontForge):
  1. The page was flattened and the ink thresholded.
  2. Each letter was skeletonised to its pen path.
  3. All letters were put on shared metrics: x-height, cap height, ascender, descender and baseline.
  4. They were re-stroked at one even pen width with round ends.
  5. The measured 3.7° slant was evened to 4°.
  6. Outlines were traced with potrace and built with FontForge.
  7. Kerning was generated automatically, plus a hand-set `n`→`t` pair.
- Sources per glyph are in `glyph-sources.json`:
  - Capitals, digits and marks come from the practice sheet.
  - b f j k x z come from the sheet's pangrams.
  - The other lowercase letters come from the clean rewrite.
- Not from the page:
  - `!` was built from my own `i` stroke and full stop, because the sheet has no `!`.
  - `r` is a print form rebuilt from my strokes, because my joined `r` was misread.
- `specimen.png` shows every glyph, the pangrams and the homepage sentence.

## Homepage line

- `homepage-line.svg`: the homepage sentence in my hand, two lines. It is used on the homepage at desktop widths.
- `homepage-line-mobile.svg`: the same sentence in four lines, for narrow screens.

The page keeps the sentence as real (visually hidden) text, and the drawing takes the lede's colour.

## Verify

```
sha256sum -c <(jq -r '.files[] | "\(.sha256)  \(.path)"' MANIFEST.json)
```
