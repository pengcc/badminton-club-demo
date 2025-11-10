import '@testing-library/jest-dom';

// Polyfills/mocks for DOM APIs used by Radix UI and components
if (!('matchMedia' in window)) {
	// @ts-ignore
	window.matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}

if (!('ResizeObserver' in window)) {
	// @ts-ignore
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as any;
}

if (!('IntersectionObserver' in window)) {
	// @ts-ignore
	window.IntersectionObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() { return []; }
		root = null;
		rootMargin = '';
		thresholds = [];
	} as any;
}

// Prevent errors from optional UI behaviors in tests
// @ts-ignore
window.scrollTo = window.scrollTo || (() => {});

// Mock Next.js app router for client components using next/navigation
jest.mock('next/navigation', () => ({
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		back: jest.fn(),
		prefetch: jest.fn()
	})
}));

// ---- Suppress React 19 Suspense act() warnings ----
const originalError = console.error;
beforeAll(() => {
	jest.spyOn(console, 'error').mockImplementation((...args) => {
		const msg = args[0];
		// Suppress React 19 Suspense act() warnings
		if (
			typeof msg === 'string' &&
			(msg.includes('A suspended resource finished loading') ||
				msg.includes('wrapped in act(...)') ||
				msg.includes('not wrapped in act'))
		) {
			return;
		}
		// Call the original console.error for all other errors
		originalError.call(console, ...args);
	});
});

afterAll(() => {
	jest.restoreAllMocks();
});
