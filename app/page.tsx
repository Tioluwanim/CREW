import { FloatingNav } from '../src/components/layout/FloatingNav';
import { LandingExperience } from '../src/page-components/LandingPage';

export default function LandingPageShell() {
	return (
		<main className="atelier-paper text-ink-900">
			<FloatingNav />

			<LandingExperience />

			<footer className="atelier-ink bg-ink-950 px-6 py-8 text-center text-xs text-bone-200/40 sm:px-8">
				CREW — the digital workspace where a creative runs the money side of every project.
			</footer>
		</main>
	);
}