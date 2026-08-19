/**
 * Resolve the essay a reading URL should render — shared by the page and
 * generateMetadata so hub indexes / topic-scoped slugs do not diverge.
 */
import { isStageIncludedInBuild, normalizeStage } from "@/lib/content-tier";
import { sortEssayStubsChronological } from "@/lib/essay-date";
import {
  getEssayInTopic,
  getProfileData,
  listEssaysBySeriesForBuild,
  listEssaysInTopicFolderForBuild,
  pickLatestEssaySlug,
  type EssayData,
  type EssayStub,
} from "@/lib/markdown";
import {
  resolveContentRoute,
  type ContentHubConfig,
  type ContentHubRoute,
  type ContentRoute,
  type LegacyContentRoute,
} from "@/lib/content-routes";

export type ResolvedReadingEssay = {
  readonly route: ContentRoute;
  readonly essaySlug: string;
  readonly essay: EssayData;
};

function listHubEssays(config: ContentHubConfig): EssayStub[] {
  const essays =
    config.mode === "folder"
      ? listEssaysInTopicFolderForBuild([...config.ontologyTopicPath], {
          series: config.seriesSlug,
        })
      : listEssaysBySeriesForBuild(config.seriesName);
  return config.navChronological ? sortEssayStubsChronological(essays) : essays;
}

function hubIndexSlug(config: ContentHubConfig, essays: EssayStub[]): string | null {
  const latestSlug = pickLatestEssaySlug(essays);
  const topicPath = config.mode === "folder" ? [...config.ontologyTopicPath] : [];
  const landerEssay =
    config.mode === "folder" ? getEssayInTopic(topicPath, config.landerSlug) : null;

  if (config.hubLanding === "latest") return latestSlug;
  if (config.hubLanding === "first" || config.sequentialNav) {
    return essays[0]?.slug ?? null;
  }
  return landerEssay ? config.landerSlug : latestSlug;
}

function loadHubEssay(config: ContentHubConfig, essaySlug: string): EssayData | null {
  if (config.mode === "folder") {
    const inTopic = getEssayInTopic([...config.ontologyTopicPath], essaySlug);
    if (inTopic) return inTopic;
  }
  return getProfileData([essaySlug]);
}

function stageAllowed(essay: EssayData): boolean {
  const st = normalizeStage((essay.frontmatter as Record<string, unknown>).stage);
  return isStageIncludedInBuild(st);
}

/**
 * Resolve the active essay for a content-hub route (index or essay leaf).
 */
export function resolveContentHubEssay(route: ContentHubRoute): ResolvedReadingEssay | null {
  const essays = listHubEssays(route.config);
  const indexSlug = hubIndexSlug(route.config, essays);
  const essaySlug =
    route.essaySlug === null || route.essaySlug === route.config.landerSlug
      ? indexSlug
      : route.essaySlug;

  if (!essaySlug) return null;

  if (route.essaySlug && essays.length > 0 && !essays.some((e) => e.slug === route.essaySlug)) {
    if (route.essaySlug !== route.config.landerSlug) return null;
  }

  const essay = loadHubEssay(route.config, essaySlug);
  if (!essay || !stageAllowed(essay)) return null;

  return { route, essaySlug, essay };
}

/**
 * Resolve a legacy topic+slug route. Prefer the topic folder so
 * `/governance/carta` does not pick a root-level `Carta.mdx` over
 * `ontology/governance/Carta.md`.
 */
export function resolveLegacyEssay(route: LegacyContentRoute): ResolvedReadingEssay | null {
  const inTopic = getEssayInTopic(route.topicPath, route.activeSlug);
  if (inTopic && stageAllowed(inTopic)) {
    return { route, essaySlug: route.activeSlug, essay: inTopic };
  }

  const profile = getProfileData([route.activeSlug]);
  if (profile && stageAllowed(profile)) {
    return { route, essaySlug: route.activeSlug, essay: profile };
  }

  return null;
}

/**
 * Resolve the essay that should back both the page body and generateMetadata.
 */
export function resolveReadingEssay(slug: string[]): ResolvedReadingEssay | null {
  const route = resolveContentRoute(slug);
  if (!route) return null;
  if (route.kind === "content-hub") {
    return resolveContentHubEssay(route);
  }
  return resolveLegacyEssay(route);
}
