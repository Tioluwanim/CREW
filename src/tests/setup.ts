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
