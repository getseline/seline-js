type SelineOptions = {
	token?: string | null;
	apiHost?: string | null;
	autoPageView?: boolean | null;
	maskPatterns?: string[] | null;
	skipPatterns?: string[] | null;
	cookieOnIdentify?: boolean | null;
};

type SelineCustomEvent = {
	name: string;
	pathname: string;
	data?: Record<string, unknown> | null;
};

type SelinePageViewEvent = {
	pathname: string;
	referrer?: string | null;
};

type SelineUserData = Record<string, unknown>;

export type Seline = {
	track: (name: string, data?: Record<string, unknown> | null) => void;
	page: (customPathname?: string) => void;
	setUser: (data: SelineUserData) => void;
	enableAutoPageView: () => void;
	doNotTrack: () => void;
};

declare global {
	interface Window {
		seline: Seline;
	}
}

export function Seline(options: SelineOptions) {
	const STORAGE_KEY = 'seline_vid';

	const token = options.token;
	const apiHost = options.apiHost ?? "https://api.seline.so";
	const maskPatterns = options.maskPatterns ?? [];
	const skipPatterns = options.skipPatterns ?? [];
  const cookieOnIdentify = options.cookieOnIdentify ?? false;
  let visitorId = localStorage.getItem(STORAGE_KEY) as string | null;
	let userData: SelineUserData = {};
	let lastPage: string | null = null;
	const referrerSent = sessionStorage.getItem("seline:referrer");
	let referrer: string | null = referrerSent ? "" : document.referrer;

	function isTrackingDisabled(): boolean {
		return localStorage.getItem("seline-do-not-track") === "1";
	}

	function doNotTrack(): void {
		localStorage.setItem("seline-do-not-track", "1");
	}

	function registerListeners() {
		const pushState = history.pushState;
		history.pushState = function (...args) {
			pushState.apply(this, args);
			page();
		};

		addEventListener("popstate", () => page());

		function onVisibilityChange() {
			if (!lastPage && document.visibilityState === "visible") {
				page();
			}
		}

		if (document.visibilityState !== "visible") {
			document.addEventListener("visibilitychange", onVisibilityChange);
		} else {
			page();
		}

		registerCustomEventListeners();
	}

	function enableAutoPageView(_initial = false) {
		if (options.autoPageView && !_initial) return;
		options.autoPageView = true;

		registerListeners();
	}

	function processPathname(pathname: string): string | null {
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
			if (regexMaskPatterns[i].test(pathname)) {
				return maskPatterns[i];
			}
		}
		return pathname;
	}

	function send(url: string, data: Record<string, unknown>, useBeacon = true): Promise<Response | void> {
		if (isTrackingDisabled()) return Promise.resolve();

		const payload = { ...data };
		if (userData.userId) payload.visitorId = userData.userId;
    if (visitorId) payload.visitorId = visitorId;

		if (useBeacon && navigator?.sendBeacon) {
			navigator.sendBeacon(url, JSON.stringify(payload));
			return Promise.resolve();
		}

		return fetch(url, {
			method: "POST",
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
		});
	}

	function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
		send(`${apiHost}/s/e`, { token, ...event }, true);
	}

	function track(name: string, data?: Record<string, unknown> | null): void {
		const pathname = processPathname(window.location.pathname);
		if (!pathname) return;

		createEvent({ pathname: pathname + window.location.search, name, data });
	}

	function page(customPathname?: string) {
    const currentPathname = customPathname ?? window.location.pathname;
		if (lastPage === currentPathname) return;
		lastPage = currentPathname;

		const pathname = processPathname(currentPathname);
		if (!pathname) return;

		if (!referrer || referrer.includes(window.location.hostname)) {
			referrer = null;
		}

		createEvent({
			pathname: customPathname ? pathname : pathname + window.location.search,
			referrer,
		});

		if (referrer) {
			referrer = null;
			sessionStorage.setItem("seline:referrer", "set");
		}
	}

	function setUser(data: SelineUserData) {
		userData = { ...userData, ...data };
		send(`${apiHost}/s/su`, { token, fields: userData }, false)
			.then(async (response) => {
				if (response) {
					const json = await response.json();
					if (json?.visitorId) {
						visitorId = json.visitorId as string;
						if (cookieOnIdentify) localStorage.setItem(STORAGE_KEY, visitorId as string);
					}
				}
			});
	}

	function registerCustomEventListeners() {
		document.addEventListener("click", (event) => {
			let targetElement = event.target as HTMLElement | null;

			if (
				!targetElement ||
				((targetElement.tagName === "INPUT" ||
					targetElement.tagName === "SELECT" ||
					targetElement.tagName === "TEXTAREA") &&
					// @ts-ignore
					targetElement.type !== "submit")
			) {
				return;
			}

			while (targetElement && !targetElement?.hasAttribute("data-sln-event")) {
				targetElement = targetElement.parentElement;
			}

			if (!targetElement) return;

			const eventName = targetElement.getAttribute("data-sln-event");
			if (!eventName) return;

			const eventData = {};

			for (const attr of Array.from(targetElement.attributes)) {
				if (attr.name.startsWith("data-sln-event-") && attr.value) {
					eventData[attr.name.slice("data-sln-event-".length)] = attr.value;
				}
			}

			if (targetElement.tagName === "FORM") {
				const form = targetElement as HTMLFormElement;
				const inputs = Array.from(form.elements) as HTMLInputElement[];
				for (const input of inputs) {
					if (input.type !== "password" && input.name && input.value) {
						eventData[input.name] = input.value;
					}
				}
			}

			track(eventName, eventData);
		});
	}

	return {
		track,
		page,
		setUser,
		enableAutoPageView,
		doNotTrack,
	};
}

if (!window.seline) {
  const token = document.currentScript?.getAttribute("data-token");
  const skipPatterns =
    document.currentScript?.getAttribute("data-skip-patterns")?.split(",") || [];
  const maskPatterns =
    document.currentScript?.getAttribute("data-mask-patterns")?.split(",") || [];
  const autoPageView =
    document.currentScript?.getAttribute("data-auto-page-view") !== "false";
  const apiHost = document.currentScript?.getAttribute("data-api-host");
  const cookieOnIdentify =
    document.currentScript?.getAttribute("data-cookie-on-identify") === "true";

  const seline = Seline({
    token,
    skipPatterns,
    maskPatterns,
    autoPageView,
    apiHost,
    cookieOnIdentify,
  });
  window.seline = seline;

  if (autoPageView) seline.enableAutoPageView(true);
}
