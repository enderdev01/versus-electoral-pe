export const ANALYTICS_EVENTS = {
  comparisonStarted: "comparison_started",
  comparisonCompleted: "comparison_completed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsGtag = (...args: unknown[]) => void;

export type AnalyticsPagePath =
  | "/"
  | "/alcaldes"
  | "/alcaldes/versus"
  | "/alcaldes/[slug]"
  | "/alcaldes/distrito/[distrito]"
  | "/candidato/[slug]"
  | "/versus"
  | "/other";

export interface AnalyticsPageContext {
  page_path: AnalyticsPagePath;
  page_location: string;
  page_title: "Versus Electoral";
  page_referrer: "";
}

interface AnalyticsEventMap {
  comparison_started: AnalyticsEventInput;
  comparison_completed: AnalyticsEventInput;
}

export interface AnalyticsEventInput {
  pathname: string;
  siteOrigin: string;
}

const EVENT_ALLOWLIST = new Set<AnalyticsEventName>(
  Object.values(ANALYTICS_EVENTS),
);

const STATIC_PAGE_PATHS = new Set<AnalyticsPagePath>([
  "/",
  "/alcaldes",
  "/alcaldes/versus",
  "/versus",
]);

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  if (pathOnly === "/") return pathOnly;
  return pathOnly.replace(/\/+$/, "") || "/";
}

export function toAnalyticsPagePath(pathname: string): AnalyticsPagePath {
  const path = normalizePathname(pathname);

  if (STATIC_PAGE_PATHS.has(path as AnalyticsPagePath)) {
    return path as AnalyticsPagePath;
  }
  if (/^\/alcaldes\/distrito\/[^/]+$/.test(path)) {
    return "/alcaldes/distrito/[distrito]";
  }
  if (/^\/alcaldes\/[^/]+$/.test(path)) return "/alcaldes/[slug]";
  if (/^\/candidato\/[^/]+$/.test(path)) return "/candidato/[slug]";

  return "/other";
}

export function createAnalyticsPageContext(
  pathname: string,
  siteOrigin: string,
): AnalyticsPageContext {
  const pagePath = toAnalyticsPagePath(pathname);
  return {
    page_path: pagePath,
    page_location: `${siteOrigin.replace(/\/$/, "")}${pagePath}`,
    page_title: "Versus Electoral",
    page_referrer: "",
  };
}

export function createAnalyticsConfig(pathname: string, siteOrigin: string) {
  return {
    ...createAnalyticsPageContext(pathname, siteOrigin),
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  } as const;
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function createAnalyticsInitScript(
  gaId: string,
  pathname: string,
  siteOrigin: string,
): string {
  const context = createAnalyticsPageContext(pathname, siteOrigin);
  const config = createAnalyticsConfig(pathname, siteOrigin);
  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('set', ${serializeForInlineScript(context)});
    gtag('config', ${serializeForInlineScript(gaId)}, ${serializeForInlineScript(config)});
  `;
}

export function dispatchAnalyticsEvent<EventName extends AnalyticsEventName>(
  gtag: AnalyticsGtag | undefined,
  eventName: EventName,
  input: AnalyticsEventMap[EventName],
): boolean {
  if (!gtag || !EVENT_ALLOWLIST.has(eventName)) return false;

  try {
    const context = createAnalyticsPageContext(input.pathname, input.siteOrigin);
    gtag("event", eventName, context);
    return true;
  } catch {
    return false;
  }
}

export function trackEvent(eventName: AnalyticsEventName): boolean {
  if (typeof window === "undefined") return false;
  return dispatchAnalyticsEvent(window.gtag, eventName, {
    pathname: window.location.pathname,
    siteOrigin: window.location.origin,
  });
}

export function createPageViewTracker(
  gtag: AnalyticsGtag,
  siteOrigin: string,
): (pathname: string) => boolean {
  let previousPathname: string | undefined;

  return (pathname: string) => {
    const normalizedPathname = normalizePathname(pathname);
    if (normalizedPathname === previousPathname) return false;

    const context = createAnalyticsPageContext(normalizedPathname, siteOrigin);
    try {
      gtag("set", context);
      gtag("event", "page_view", context);
      previousPathname = normalizedPathname;
      return true;
    } catch {
      return false;
    }
  };
}

export function isProductionAnalyticsEnvironment(environment: {
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
}): boolean {
  return (
    environment.nodeEnv === "production" &&
    environment.vercelEnv === "production"
  );
}

declare global {
  interface Window {
    gtag?: AnalyticsGtag;
    dataLayer?: unknown[];
  }
}
