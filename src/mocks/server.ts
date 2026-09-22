import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Used only by integration tests (see services/*.integration.test.ts).
// The browser-side MSW worker for `npm run dev` would be a separate
// setup (setupWorker from 'msw/browser') — not wired into dev serving in
// this pass, since the store currently drives the UI directly rather than
// through the service layer. See README "What's abbreviated."
export const server = setupServer(...handlers);
