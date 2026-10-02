import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { vi } from 'vitest';

afterEach(() => cleanup());

vi.mock('next/navigation', () => ({
	usePathname: () => window.location.pathname,
	useRouter: () => ({
		back: vi.fn(),
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
	}),
	useParams: () => {
		const parts = window.location.pathname.split('/').filter(Boolean);
		const id = parts.at(-1);
		return { id: id === 'projects' ? undefined : id };
	},
}));

// jsdom doesn't implement matchMedia. GSAP's ScrollTrigger plugin calls it
// at *import* time (see components/landing/ScrollProgressBar.tsx), so any
// test that imports a module in that chain needs this polyfilled globally,
// before that import executes — a per-test stub is too late.
if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));
}
