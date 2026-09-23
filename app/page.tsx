import Link from 'next/link';
import { Button } from '../src/components/ui/primitives';
import { LandingExperience } from '../src/page-components/LandingPage';

export default function LandingPageShell() {
	return (
		<main className="atelier-paper text-ink-900">
			<header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-900/5 bg-bone-50/80 px-5 py-4 backdrop-blur sm:px-8">
				<span className="font-display text-xl italic">CREW</span>
				<div className="flex items-center gap-2">
					<Link href="/demo" className="hidden text-sm font-medium text-ink-700 hover:text-ink-900 sm:inline">
						Explore the demo
					</Link>
					<Link href="/app">
						<Button className="!px-4 !py-2 text-sm">Open workspace</Button>
					</Link>
				</div>
			</header>

			<LandingExperience />

			<footer className="atelier-ink bg-ink-950 px-6 py-8 text-center text-xs text-bone-200/40 sm:px-8">
				CREW — the digital workspace where a creative runs the money side of every project.
			</footer>
		</main>
	);
}