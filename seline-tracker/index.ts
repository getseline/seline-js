type SelineOptions = {
	token?: string | null;
	apiHost?: string | null;
	autoPageView?: boolean | null;
	maskPatterns?: string[] | null;
	skipPatterns?: string[] | null;
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

export type Seline = {
	track: (name: string, data?: Record<string, unknown> | null) => void;
	page: () => void;
	setUser: (data: SelineUserData) => void;
	enableAutoPageView: () => void;
};

declare global {
	interface Window {
		seline: Seline;
	}
}

export function Seline(options: SelineOptions) {
	const token = options.token;
	const apiHost = options.apiHost ?? "https://api.seline.so";
	const maskPatterns = options.maskPatterns ?? [];
	const skipPatterns = options.skipPatterns ?? [];
	let userData: SelineUserData = {};
	let lastPage: string | null = null;
	let referrer: string | null = document.referrer;

	function registerListeners() {
		const pushState = history.pushState;
		history.pushState = function (...args) {
			pushState.apply(this, args);
			page();
		};

		addEventListener("popstate", page);

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

	function send(url: string, data: Record<string, unknown>): void {
		try {
			const payload = data;
			if (userData.userId) payload.visitorId = userData.userId;

			if (!navigator?.sendBeacon(url, JSON.stringify(payload))) {
				fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
					keepalive: true,
				});
			}
		} catch (error) {
			console.error(error);
		}
	}

	function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
		send(`${apiHost}/s/e`, { token, ...event });
	}

	function track(name: string, data?: Record<string, unknown> | null): void {
		createEvent({ name, data });
	}

	function page() {
		if (lastPage === window.location.pathname) return;
		lastPage = window.location.pathname;

		const pathname = processPathname(window.location.pathname);
		if (!pathname) return;

		if (!referrer || referrer.includes(location.hostname)) {
			referrer = null;
		}

		createEvent({
			pathname: pathname + window.location.search,
			referrer,
		});

		if (referrer) referrer = null;
	}

	function setUser(data: SelineUserData) {
		userData = { ...userData, ...data };
		send(`${apiHost}/s/su`, { token, ...userData });
	}

	return {
		track,
		page,
		setUser,
		enableAutoPageView,
	};
}

const token = document.currentScript?.getAttribute("data-token");
const skipPatterns =
	document.currentScript?.getAttribute("data-skip-patterns")?.split(",") || [];
const maskPatterns =
	document.currentScript?.getAttribute("data-mask-patterns")?.split(",") || [];
const autoPageView =
	document.currentScript?.getAttribute("data-auto-page-view") !== "false" ??
	true;

const seline = Seline({ token, skipPatterns, maskPatterns, autoPageView });
window.seline = seline;

if (autoPageView) seline.enableAutoPageView(true);
