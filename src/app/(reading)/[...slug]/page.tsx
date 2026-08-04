import type { ReactNode } from "react";
import type { Metadata } from "next";
import ReactMarkdown, { type Components } from "react-markdown";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isStageIncludedInBuild, normalizeStage } from "@/lib/content-tier";
import { sortEssayStubsChronological } from "@/lib/essay-date";
import {
  getProfileData,
  getEssayInTopic,
  isTopicFolder,
  listEssaysForBuild,
  listEssaysBySeriesForBuild,
  listEssaysInTopicFolderForBuild,
  pickLatestEssaySlug,
  type EssayData,
  type EssayStub,
} from "@/lib/markdown";
import {
  resolveContentRoute,
  listContentHubStaticParams,
  listBentoLegacyStaticParams,
  type ContentHubConfig,
  type ContentHubRoute,
} from "@/lib/content-routes";
import { getSovereignIdentity } from "@/lib/sovereign";
import { withBasePath } from "@/lib/base-path";
import { SiteIdentity } from "@/config/site";
import { ConnexionContactPanel } from "@/components/features/ConnexionContactPanel";
import { TrajectoryTimeline } from "@/components/features/TrajectoryTimeline";

const LEAD_IMAGE_FEATURE_CLASS: Record<string, string> = {
  half: "p3-inline-image--feature-half",
  "pct-80": "p3-inline-image--feature-pct-80",
};

function leadImageFeatureModifier(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return LEAD_IMAGE_FEATURE_CLASS[raw.trim().toLowerCase()];
}

const NO_PUBLIC_ONTOLOGY_PATH = ["__p3", "no_public_routes"] as const;

export async function generateStaticParams() {
  return [
    { slug: [...NO_PUBLIC_ONTOLOGY_PATH] },
    ...listContentHubStaticParams(
      (topicPath, seriesSlug) => listEssaysInTopicFolderForBuild(topicPath, { series: seriesSlug }),
      (seriesName) => listEssaysBySeriesForBuild(seriesName)
    ),
    ...listBentoLegacyStaticParams(
      () => listEssaysForBuild(["me"]),
      (parts) => getProfileData([parts[parts.length - 1]!]),
      (stage) => isStageIncludedInBuild(normalizeStage(stage))
    ),
  ];
}

export const dynamicParams = false;

function resolveTopicMapping(rawPath: string[]): { path: string[]; active: string } {
  const target = rawPath[rawPath.length - 1];
  return { path: rawPath.slice(0, rawPath.length - 1), active: target };
}

const AUTHOR_NAME_DEFAULT = "Ashit Milne";

/** Frontmatter `tags` normalized to a trimmed string[] (SEO keywords). */
function frontmatterTags(fm: Record<string, unknown>): string[] {
  const raw = fm.tags;
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" && raw.trim() ? [raw] : [];
  return arr.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function authorName(fm: Record<string, unknown>): string {
  return typeof fm.jurisdiction === "string" && fm.jurisdiction.trim() ? fm.jurisdiction.trim() : AUTHOR_NAME_DEFAULT;
}

function publishedIso(fm: Record<string, unknown>): string | undefined {
  const raw = fm.publishedAt;
  if (raw == null) return undefined;
  if (raw instanceof Date) return raw.toISOString();
  const t = typeof raw === "number" ? raw : typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function sectionName(fm: Record<string, unknown>): string | undefined {
  const s = fm.series;
  if (typeof s === "string" && s.trim()) return s.trim();
  if (Array.isArray(s)) {
    const first = s.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") return first.trim();
  }
  return undefined;
}

/** Resolve a public path or bare URL to an absolute canonical URL. */
function toAbsUrl(pathOrUrl: string | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  try {
    return new URL(pathOrUrl.startsWith("/") ? withBasePath(pathOrUrl) : pathOrUrl, SiteIdentity.url).toString();
  } catch {
    return undefined;
  }
}

function canonicalPath(slug: string[]): string {
  return `/${slug.filter(Boolean).join("/")}/`;
}

/** Plain-text excerpt for meta description when no explicit subtitle exists. */
function plainExcerpt(markdown: string, max = 160): string | undefined {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[>#*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trim()}…`;
}

function essayDescription(fm: Record<string, unknown>, content: string): string | undefined {
  if (typeof fm.subtitle === "string" && fm.subtitle.trim()) return fm.subtitle.trim();
  return plainExcerpt(content) ?? SiteIdentity.description;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  if (!rawSlug) return {};

  const slug = rawSlug.filter(Boolean);
  if (slug.length < 2) return {};

  const { active: targetSlug } = resolveTopicMapping(slug);
  const essay = getProfileData([targetSlug]);

  if (!essay) return {};

  const { frontmatter, content } = essay;
  const { did } = getSovereignIdentity();
  const other: Record<string, string> = {};
  if (did) other["author-did"] = did;

  const title = typeof frontmatter.title === "string" ? frontmatter.title : undefined;
  const description = essayDescription(frontmatter, content);
  const tags = frontmatterTags(frontmatter);
  const path = canonicalPath(slug);
  const published = publishedIso(frontmatter);
  const imageAbs = toAbsUrl(typeof frontmatter.image === "string" ? frontmatter.image : undefined);
  const imageAlt =
    (typeof frontmatter.imageAlt === "string" && frontmatter.imageAlt.trim()) || title || SiteIdentity.name;
  const images = imageAbs ? [{ url: imageAbs, alt: imageAlt }] : undefined;

  return {
    title,
    description,
    keywords: tags.length ? tags : undefined,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      siteName: SiteIdentity.name,
      publishedTime: published,
      authors: [authorName(frontmatter)],
      tags: tags.length ? tags : undefined,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: imageAbs ? [imageAbs] : undefined,
    },
    other,
  };
}

function contentJsonLd(
  frontmatter: EssayData["frontmatter"],
  did: string | null | undefined,
  url?: string
): string {
  const tags = frontmatterTags(frontmatter);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontmatter.title ?? "",
  };
  if (typeof frontmatter.subtitle === "string" && frontmatter.subtitle.trim()) {
    ld.description = frontmatter.subtitle.trim();
  }
  if (url) {
    ld.url = url;
    ld.mainEntityOfPage = url;
  }
  if (tags.length) ld.keywords = tags.join(", ");
  const section = sectionName(frontmatter);
  if (section) ld.articleSection = section;
  const published = publishedIso(frontmatter);
  if (published) {
    ld.datePublished = published;
    ld.dateModified = published;
  }
  const author: Record<string, unknown> = { "@type": "Person", name: authorName(frontmatter), url: SiteIdentity.url };
  if (did) author.identifier = did;
  ld.author = author;
  ld.publisher = { "@type": "Organization", name: SiteIdentity.name, url: SiteIdentity.url };
  const img = toAbsUrl(typeof frontmatter.image === "string" ? frontmatter.image : undefined);
  if (img) ld.image = img;
  return JSON.stringify(ld);
}

/** inset | figure | plate → centred editorial plate above essay body (after page title) */
function assetSrc(src: string): string {
  return src.startsWith("/") ? withBasePath(src) : src;
}

function isPlateImageRole(imageRole?: string): boolean {
  return imageRole === "inset" || imageRole === "figure" || imageRole === "plate";
}

function EditorialPlateFigure({
  image,
  imageAlt,
  imagePosition,
  imageClip,
  imagePlate,
}: {
  image: string;
  imageAlt: string;
  imagePosition?: string;
  imageClip?: string;
  imagePlate?: string;
}) {
  const isWidePlate = imagePlate?.trim().toLowerCase() === "wide";
  return (
    <figure
      className={[
        "p3-narrative-figure p3-narrative-figure--plate",
        isWidePlate ? "p3-narrative-figure--plate-wide" : "",
        imageClip === "circle" ? "p3-narrative-figure--plate-circle" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        src={assetSrc(image)}
        alt={imageAlt}
        loading="eager"
        className={[
          "p3-narrative-figure__img p3-narrative-figure__img--plate",
          imageClip === "circle" ? "p3-narrative-figure__img--plate-circle" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={imagePosition ? { objectPosition: imagePosition } : undefined}
      />
    </figure>
  );
}

function createMarkdownComponents(leadFeatureClass?: string): Components {
  let leadImageAssigned = false;
  return {
    table: ({ children, ...props }) => (
      <div className="p3-table-scroll">
        <table {...props}>{children}</table>
      </div>
    ),
    img: ({ src, alt, ...props }) => {
      if (typeof src !== "string" || src.trim() === "") return null;
      const isLeadImage = !leadImageAssigned;
      if (isLeadImage) leadImageAssigned = true;
      const className = [
        typeof props.className === "string" ? props.className : "",
        isLeadImage ? "p3-inline-image--feature" : "",
        isLeadImage && leadFeatureClass ? leadFeatureClass : "",
      ]
        .filter(Boolean)
        .join(" ");
      return <img src={assetSrc(src)} alt={alt ?? ""} {...props} className={className} />;
    },
  };
}

function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map((c) => (typeof c === "string" ? c : "")).join("");
  }
  return "";
}

function headingAnchor(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function glossaryTerms(content: string): { title: string; anchor: string }[] {
  return [...content.matchAll(/^##\s+(.+?)\s*$/gm)]
    .map((match) => match[1]?.trim())
    .filter((title): title is string => Boolean(title))
    .map((title) => ({ title, anchor: headingAnchor(title) }))
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
}

type ConnexionLinks = {
  voiceUrl?: string;
  messageUrl?: string;
  email?: string;
};

/** Default: blockquotes clear inset floats. Exception: `blockquoteInset: flow` in frontmatter. */
function blockquoteInsetFlows(frontmatter: Record<string, unknown>): boolean {
  const v = frontmatter.blockquoteInset;
  return v === "flow" || v === "beside";
}

function NarrativeEssayBody({
  image,
  imageAlt,
  imageRole = "figure",
  imagePosition,
  imageClip,
  imagePlate,
  blockquoteFlow = false,
  content,
  components,
  connexionFit = false,
  connexionLinks,
}: {
  image?: string;
  imageAlt: string;
  imageRole?: string;
  imagePosition?: string;
  imageClip?: string;
  imagePlate?: string;
  blockquoteFlow?: boolean;
  content: string;
  components: Components;
  connexionFit?: boolean;
  connexionLinks?: ConnexionLinks;
}) {
  const isOverlayFigure = Boolean(image && imageRole === "overlay");
  const isPlateFigure = Boolean(image && isPlateImageRole(imageRole));
  const hasBody = Boolean(content.trim()) || connexionFit;

  if (!hasBody && !image) return null;

  const plateFigure =
    isPlateFigure && image ? (
      <EditorialPlateFigure
        image={image}
        imageAlt={imageAlt}
        imagePosition={imagePosition}
        imageClip={imageClip}
        imagePlate={imagePlate}
      />
    ) : null;

  return (
    <div
      className={
        isOverlayFigure ? "p3-narrative-layout p3-narrative-layout--overlay-figure" : "p3-narrative-layout"
      }
    >
      {isOverlayFigure && image && (
        <figure className="p3-narrative-figure p3-narrative-figure--overlay">
          <img
            src={assetSrc(image)}
            alt={imageAlt}
            loading="eager"
            className="p3-narrative-figure__img p3-narrative-figure__img--overlay"
          />
        </figure>
      )}
      {hasBody && (
        <section
          className={[
            "p3-narrative-body",
            isPlateFigure ? "p3-narrative-body--with-plate" : "",
            isPlateFigure && blockquoteFlow ? "p3-narrative-body--blockquote-flow" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isPlateFigure && plateFigure}
          {connexionFit && connexionLinks ? (
            <ConnexionContactPanel
              voiceUrl={connexionLinks.voiceUrl}
              messageUrl={connexionLinks.messageUrl}
              email={connexionLinks.email}
            />
          ) : (
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
          )}
        </section>
      )}
    </div>
  );
}

function buildConnexionComponents(
  visual: string | undefined,
  leadFeatureClass?: string
): Components {
  const markdownComponents = createMarkdownComponents(leadFeatureClass);
  if (visual === "trajectory-timeline") {
    return {
      ...markdownComponents,
      h2: ({ children, ...props }) => {
        const text = headingText(children).trim().toLowerCase();
        if (text === "timeline") return <TrajectoryTimeline />;
        return <h2 {...props}>{children}</h2>;
      },
    };
  }
  return markdownComponents;
}

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function OntologyArchive({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  if (!rawSlug) return notFound();

  const slug = rawSlug.filter(Boolean);
  if (slug.length < 2) return notFound();

  const canonicalUrl = toAbsUrl(canonicalPath(slug));

  const route = resolveContentRoute(slug);
  if (!route) return notFound();

  if (route.kind === "content-hub") {
    return renderContentHub(route);
  }

  const { topicPath, activeSlug, isMeRoute } = route;

  const single = getProfileData([activeSlug]);

  if (single) {
    const st = normalizeStage((single.frontmatter as Record<string, unknown>).stage);
    if (!isStageIncludedInBuild(st)) return notFound();

    const essays = listEssaysForBuild(topicPath);

    if (isMeRoute) {
      return <SingleArticle data={single} canonicalUrl={canonicalUrl} />;
    }

    if (essays.length > 0) {
      return (
        <TopicLayout
          topicPath={slug.slice(0, slug.length - 1)}
          essays={essays}
          activeSlug={activeSlug}
          activeEssay={single}
        />
      );
    }

    return <SingleArticle data={single} canonicalUrl={canonicalUrl} />;
  }

  if (!isTopicFolder(topicPath)) return notFound();

  const essays = listEssaysForBuild(topicPath);
  if (essays.length === 0) return notFound();

  return (
    <TopicLayout
      topicPath={slug.slice(0, slug.length - 1)}
      essays={essays}
      activeSlug={activeSlug}
      activeEssay={essays[0] as unknown as EssayData}
    />
  );
}

function listHubEssays(config: ContentHubConfig): EssayStub[] {
  const essays =
    config.mode === "folder"
      ? listEssaysInTopicFolderForBuild([...config.ontologyTopicPath], {
          series: config.seriesSlug,
        })
      : listEssaysBySeriesForBuild(config.seriesName);

  return config.navChronological ? sortEssayStubsChronological(essays) : essays;
}

function renderContentHub(route: ContentHubRoute) {
  const { config, essaySlug: routeEssaySlug } = route;
  const publicTopicPath = [...config.publicBase];

  const essays = listHubEssays(config);
  const latestSlug = pickLatestEssaySlug(essays);
  const topicPath = config.mode === "folder" ? [...config.ontologyTopicPath] : [];

  const landerEssay =
    config.mode === "folder" ? getEssayInTopic(topicPath, config.landerSlug) : null;
  // Prefer latest when opted in; else lander overview; else sequential first; else latest.
  const hubIndexSlug =
    config.hubLanding === "latest"
      ? latestSlug
      : config.hubLanding === "first" || config.sequentialNav
        ? essays[0]?.slug ?? null
        : landerEssay
          ? config.landerSlug
          : latestSlug;

  const essaySlug =
    routeEssaySlug === null || routeEssaySlug === config.landerSlug
      ? hubIndexSlug
      : routeEssaySlug;

  if (!essaySlug) return notFound();

  let activeEssay: EssayData | null = null;
  if (config.mode === "folder") {
    activeEssay = getEssayInTopic(topicPath, essaySlug);
  }
  if (!activeEssay) {
    activeEssay = getProfileData([essaySlug]);
  }

  if (!activeEssay) return notFound();

  const st = normalizeStage((activeEssay.frontmatter as Record<string, unknown>).stage);
  if (!isStageIncludedInBuild(st)) return notFound();

  if (routeEssaySlug && essays.length > 0 && !essays.some((e) => e.slug === routeEssaySlug)) {
    if (routeEssaySlug !== config.landerSlug) return notFound();
  }

  return (
    <TopicLayout
      topicPath={publicTopicPath}
      navKicker={config.navKicker}
      showNavIndex={config.sequentialNav === true}
      showNavDate={config.showNavDate === true}
      essays={essays}
      activeSlug={essaySlug}
      activeEssay={activeEssay}
    />
  );
}

function SingleArticle({ data, canonicalUrl }: { data: EssayData; canonicalUrl?: string }) {
  const { frontmatter, content } = data;
  const { did } = getSovereignIdentity();
  const image = typeof frontmatter.image === "string" ? frontmatter.image : undefined;
  const imageRole =
    typeof frontmatter.imageRole === "string" ? frontmatter.imageRole : "inset";
  const imageAlt = (typeof frontmatter.imageAlt === "string" && frontmatter.imageAlt) || frontmatter.title || "";
  const imagePosition =
    typeof frontmatter.imagePosition === "string" ? frontmatter.imagePosition : undefined;
  const imageClip = typeof frontmatter.imageClip === "string" ? frontmatter.imageClip : undefined;
  const imagePlate = typeof frontmatter.imagePlate === "string" ? frontmatter.imagePlate : undefined;
  const visual = typeof frontmatter.visual === "string" ? frontmatter.visual : undefined;

  const connexionFit = visual === "connexion-contact";
  const connexionLinks: ConnexionLinks | undefined = connexionFit
    ? {
        voiceUrl:
          typeof frontmatter.contact_voice_url === "string" ? frontmatter.contact_voice_url : undefined,
        messageUrl:
          typeof frontmatter.contact_message_url === "string" ? frontmatter.contact_message_url : undefined,
        email: typeof frontmatter.contact_email === "string" ? frontmatter.contact_email : undefined,
      }
    : undefined;

  const leadFeatureClass = leadImageFeatureModifier((frontmatter as Record<string, unknown>).image_feature);
  const components = buildConnexionComponents(visual, leadFeatureClass);

  return (
    <div className={`p3-narrative-canvas${connexionFit ? " p3-narrative-canvas--connexion-fit" : ""}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: contentJsonLd(frontmatter, did, canonicalUrl) }} />

      <article className={`p3-narrative-article${connexionFit ? " p3-narrative-article--connexion-fit" : ""}`}>
        <header className="p3-narrative-article__header">
          <h1 className="p3-narrative-article__title">{frontmatter.title}</h1>
          <span className="p3-narrative-article__rule" aria-hidden="true" />
        </header>

        <NarrativeEssayBody
          image={connexionFit ? undefined : image}
          imageAlt={imageAlt}
          imageRole={connexionFit ? undefined : imageRole}
          imagePosition={connexionFit ? undefined : imagePosition}
          imageClip={connexionFit ? undefined : imageClip}
          imagePlate={connexionFit ? undefined : imagePlate}
          blockquoteFlow={blockquoteInsetFlows(frontmatter as Record<string, unknown>)}
          content={content}
          components={components}
          connexionFit={connexionFit}
          connexionLinks={connexionLinks}
        />
      </article>
    </div>
  );
}

function TopicLayout({
  topicPath,
  navKicker,
  showNavIndex = false,
  showNavDate = false,
  essays,
  activeSlug,
  activeEssay,
}: {
  topicPath: string[];
  navKicker?: string;
  showNavIndex?: boolean;
  showNavDate?: boolean;
  essays: EssayStub[];
  activeSlug: string;
  activeEssay: EssayData;
}) {
  const basePath = `/${topicPath.join("/")}`;
  const { frontmatter, content } = activeEssay;
  const { did } = getSovereignIdentity();
  const canonicalUrl = toAbsUrl(`${basePath}/${activeSlug}/`);
  const fallbackTitle = essays.find((e) => e.slug === activeSlug)?.title ?? "";
  const title = (frontmatter.title as string) || fallbackTitle;
  const subtitle =
    typeof frontmatter.subtitle === "string"
      ? frontmatter.subtitle
      : typeof frontmatter.label === "string"
        ? frontmatter.label
        : null;
  const image = typeof frontmatter.image === "string" ? frontmatter.image : undefined;
  const imageRole = typeof frontmatter.imageRole === "string" ? frontmatter.imageRole : "figure";
  const isTitleIcon = Boolean(image && imageRole === "icon");
  const isTitleMark = Boolean(image && imageRole === "mark");
  const isTitleBesideImage = isTitleIcon || isTitleMark;
  const bodyImageRole = isTitleBesideImage ? undefined : imageRole;
  const imageAlt = (typeof frontmatter.imageAlt === "string" && frontmatter.imageAlt) || title;
  const imagePosition =
    typeof frontmatter.imagePosition === "string" ? frontmatter.imagePosition : undefined;
  const imageClip = typeof frontmatter.imageClip === "string" ? frontmatter.imageClip : undefined;
  const imagePlate = typeof frontmatter.imagePlate === "string" ? frontmatter.imagePlate : undefined;
  const visual = typeof frontmatter.visual === "string" ? frontmatter.visual : undefined;

  const leadFeatureClass = leadImageFeatureModifier((frontmatter as Record<string, unknown>).image_feature);
  const isGlossary =
    (activeSlug === "canonical" || activeSlug === "canon") &&
    frontmatter.type === "reference";
  const terms = isGlossary ? glossaryTerms(content) : [];
  const baseComponents = buildConnexionComponents(visual, leadFeatureClass);
  const components: Components = isGlossary
    ? {
        ...baseComponents,
        h2: ({ children, ...props }) => (
          <h2 {...props} id={headingAnchor(headingText(children))}>
            {children}
          </h2>
        ),
      }
    : baseComponents;

  const activeKickerLabel = isGlossary
    ? "GLOSSARY"
    : navKicker ?? topicPath[topicPath.length - 1]?.toUpperCase() ?? "INDEX";

  return (
    <div className="p3-topic-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: contentJsonLd(frontmatter, did, canonicalUrl) }} />
      <nav
        className={`p3-topic-nav${showNavIndex ? " p3-topic-nav--sequential" : ""}${showNavDate ? " p3-topic-nav--temporal" : ""}${isGlossary ? " p3-topic-nav--glossary" : ""}`}
        aria-label={isGlossary ? "Glossary terms" : "Essays in this topic"}
      >
        <div className="p3-topic-nav__sticky">
          <p className="p3-topic-nav__kicker">{activeKickerLabel}</p>
          {showNavIndex && (
            <p className="p3-topic-nav__seq-note" aria-hidden="true">
              Read in order
            </p>
          )}
          {showNavDate && (
            <p className="p3-topic-nav__temporal-note" aria-hidden="true">
              Ça va ?
            </p>
          )}
          <ul className="p3-topic-nav__list">
            {isGlossary
              ? terms.map((term) => (
                  <li key={term.anchor}>
                    <a href={`#${term.anchor}`} className="p3-topic-nav__link">
                      {term.title}
                    </a>
                  </li>
                ))
              : essays.map((e, index) => {
                  const isActive = e.slug === activeSlug;
                  const indexLabel = String(index);
                  const dateLabel = showNavDate ? e.dateLabel : undefined;
                  return (
                    <li key={e.slug}>
                      <Link
                        href={`${basePath}/${e.slug}`}
                        className={`p3-topic-nav__link${isActive ? " is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={
                          showNavIndex
                            ? `Part ${index}: ${e.title}`
                            : dateLabel
                              ? `${e.title}, ${dateLabel}`
                              : e.title
                        }
                      >
                        {showNavIndex && (
                          <span className="p3-topic-nav__index" aria-hidden="true">
                            {indexLabel}
                          </span>
                        )}
                        <span className="p3-topic-nav__label">
                          <span className="p3-topic-nav__title">{e.title}</span>
                          {dateLabel && e.dateIso && (
                            <time className="p3-topic-nav__date" dateTime={e.dateIso}>
                              {dateLabel}
                            </time>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </nav>

      <div className="p3-topic-separator" aria-hidden="true" />

      <article className="p3-topic-article p3-narrative-article">
        <header className="p3-narrative-article__header">
          {isTitleBesideImage ? (
            <div className="p3-topic-article__title-row">
              <img
                src={assetSrc(image!)}
                alt=""
                className={isTitleMark ? "p3-topic-article__title-mark" : "p3-topic-article__title-icon"}
                aria-hidden="true"
              />
              <h1 className="p3-narrative-article__title">{title}</h1>
            </div>
          ) : (
            <h1 className="p3-narrative-article__title">{title}</h1>
          )}
          {subtitle && <p className="p3-topic-article__subtitle">{subtitle}</p>}
          <span className="p3-narrative-article__rule" aria-hidden="true" />
        </header>
        <NarrativeEssayBody
          image={isTitleBesideImage ? undefined : image}
          imageAlt={imageAlt}
          imageRole={bodyImageRole}
          imagePosition={imagePosition}
          imageClip={imageClip}
          imagePlate={imagePlate}
          blockquoteFlow={blockquoteInsetFlows(frontmatter as Record<string, unknown>)}
          content={content}
          components={components}
        />
      </article>
    </div>
  );
}
