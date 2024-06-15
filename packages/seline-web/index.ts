type SelineOptions = {
  token?: string | null;
  apiHost?: string | null;
  autoPageView?: boolean | null;
  skipPatterns?: string[];
  maskPatterns?: string[];
};

type SelineCustomEvent = {
  name: string;
  data?: Record<string, unknown> | null;
};

type SelinePageViewEvent = {
  pathname: string;
  referrer?: string | null;
};

type SelineUserData = Record<string, unknown>;

const isBrowser = typeof window !== "undefined";

let userData: SelineUserData = {};

const options: SelineOptions = {};

type QueueEvent =
  | { name: "event"; args: SelineCustomEvent | SelinePageViewEvent }
  | { name: "user"; args: SelineUserData };

let inited = false;
let lastPage: string | null = null;

const beforeInitQueue: QueueEvent[] = [];

function processPathname(
  pathname: string,
  maskPatterns: string[],
  skipPatterns: string[],
): string | null | undefined {
  const regexSkipPatterns = skipPatterns.map(
    (pattern) => new RegExp(`^${pattern.replace(/\*/g, "[^/]+")}$`),
  );
  const regexMaskPatterns = maskPatterns.map(
    (pattern) => new RegExp(`^${pattern.replace(/\*/g, "[^/]+")}$`),
  );

  if (regexSkipPatterns.some((regex) => regex.test(pathname))) {
    return null;
  }

  for (let i = 0; i < maskPatterns.length; i++) {
    if (regexMaskPatterns[i]?.test(pathname)) {
      return maskPatterns[i];
    }
  }
  return pathname;
}

export function init(initOptions: SelineOptions = {}) {
  if (!isBrowser || inited) return;

  options.token = initOptions.token;
  options.apiHost = initOptions.apiHost ?? "https://api.seline.so";
  options.autoPageView = initOptions.autoPageView ?? true;
  options.skipPatterns = initOptions.skipPatterns ?? [];
  options.maskPatterns = initOptions.maskPatterns ?? [];

  inited = true;

  if (beforeInitQueue.length > 0) {
    for (const { name, args } of beforeInitQueue) {
      if (name === "event") {
        createEvent(args);
      } else if (name === "user") {
        setUser(args);
      }
    }
  }

  if (options.autoPageView) {
    const pushState = history.pushState;
    history.pushState = function (...args) {
      pushState.apply(this, args);
      page();
    };

    addEventListener("popstate", page);

    page();
  }
}

function send(url: string, data: Record<string, unknown>): void {
  try {
    const payload = data;
    if (userData.userId) payload.visitorId = userData.userId;

    navigator.sendBeacon(url, JSON.stringify(data));
  } catch (error) {
    console.error(error);
  }
}

function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
  send(`${options.apiHost}/s/e`, { token: options.token, ...event });
}

export function track(
  name: string,
  data?: Record<string, unknown> | null,
): void {
  if (!inited) {
    beforeInitQueue.push({ name: "event", args: { name, data } });
    return;
  }
  createEvent({ name, data });
}

export function page() {
  if (lastPage === window.location.pathname) return;
  lastPage = window.location.pathname;

  let referrer: string | null = document.referrer;
  const pathname = processPathname(
    window.location.pathname,
    options.maskPatterns ?? [],
    options.skipPatterns ?? [],
  );
  if (!pathname) return;

  if (!referrer || referrer.includes(location.hostname)) {
    referrer = null;
  }

  const args = {
    pathname: pathname + window.location.search,
    referrer,
  };

  if (!inited) {
    beforeInitQueue.push({ name: "event", args });
    return;
  }

  createEvent(args);
}

export function setUser(data: SelineUserData) {
  userData = { ...userData, ...data };

  if (!inited) {
    beforeInitQueue.push({ name: "user", args: userData });
    return;
  }

  send(`${options.apiHost}/s/su`, { token: options.token, fields: userData });
}
