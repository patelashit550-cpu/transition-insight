import {
  ENGAGEMENTS,
  TIMELINE_RANGE,
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  type Domain,
} from "@/data/trajectory";

/**
 * Single-row career ribbon. Tooltips carry full org / role text.
 */

function toYear(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y + (m - 1) / 12;
}

export function TrajectoryTimeline() {
  const lane = 0;
  const numLanes = 1;

  const width = 960;
  const marginL = 52;
  const marginR = 20;
  const marginT = 40;
  const chartW = width - marginL - marginR;
  const laneH = 32;
  const pillH = 26;

  const { startYear, endYear } = TIMELINE_RANGE;
  const span = Math.max(1, endYear - startYear);

  const xOf = (yr: number) =>
    marginL + ((yr - startYear) / span) * chartW;

  const tickStep = 5;
  const tickYears: number[] = [];
  const firstTick = Math.ceil(startYear / tickStep) * tickStep;
  for (let y = firstTick; y <= endYear; y += tickStep) {
    tickYears.push(y);
  }

  const chartH = numLanes * laneH;
  const height = marginT + chartH + 24;

  const domainsUsed = Array.from(
    new Set(ENGAGEMENTS.map((e) => e.domain))
  ) as Domain[];

  return (
    <figure className="p3-trajectory-timeline" aria-label="Career trajectory timeline">
      <div className="p3-trajectory-timeline__scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          role="img"
          preserveAspectRatio="xMinYMin meet"
        >
          <g>
            <line
              x1={marginL}
              y1={marginT - 4}
              x2={width - marginR}
              y2={marginT - 4}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            {tickYears.map((yr) => (
              <g key={yr}>
                <line
                  x1={xOf(yr)}
                  y1={marginT - 4}
                  x2={xOf(yr)}
                  y2={marginT + chartH}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={xOf(yr)}
                  y={marginT - 12}
                  fill="rgba(255,255,255,0.55)"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="inherit"
                  letterSpacing="0.08em"
                >
                  {yr}
                </text>
              </g>
            ))}
          </g>

          <g>
            {ENGAGEMENTS.map((e) => {
              const x1 = xOf(toYear(e.start));
              const x2 = xOf(toYear(e.end));
              const w = Math.max(4, x2 - x1);
              const y = marginT + lane * laneH + (laneH - pillH) / 2;
              const color = DOMAIN_COLORS[e.domain];

              const labelFits = w >= 48;
              const maxChars = Math.max(0, Math.floor((w - 10) / 6.2));
              const label =
                e.short.length > maxChars
                  ? e.short.slice(0, Math.max(1, maxChars - 1)) + "…"
                  : e.short;

              const startY = e.start.slice(0, 4);
              const endY = e.end.slice(0, 4);
              const period = startY === endY ? startY : `${startY}–${endY}`;
              const tip = `${e.org} · ${e.role} (${period})`;

              return (
                <g key={e.id}>
                  <rect
                    x={x1}
                    y={y}
                    width={w}
                    height={pillH}
                    rx={3}
                    ry={3}
                    fill={color}
                    fillOpacity={0.92}
                  >
                    <title>{tip}</title>
                  </rect>
                  {labelFits && (
                    <text
                      x={x1 + w / 2}
                      y={y + pillH / 2 + 4}
                      fill="#ffffff"
                      fontSize="11"
                      textAnchor="middle"
                      fontFamily="inherit"
                      pointerEvents="none"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <figcaption className="p3-trajectory-legend">
        {domainsUsed.map((d) => (
          <span key={d} className="p3-trajectory-legend__item">
            <span
              className="p3-trajectory-legend__swatch"
              style={{ backgroundColor: DOMAIN_COLORS[d] }}
              aria-hidden="true"
            />
            {DOMAIN_LABELS[d]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
