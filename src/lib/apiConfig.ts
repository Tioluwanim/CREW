// The single point every service module reads to decide where it talks
// to. Flip NEXT_PUBLIC_USE_MOCK_API to 'false' and set NEXT_PUBLIC_API_BASE_URL to swap
// every service function from the MSW mock to a real backend — no other
// code path differences, per section 43b's mock-to-real swap contract.
//
// Default is mock-on, since that's what this repo ships runnable today.

// IMPORTANT: Next.js only bakes NEXT_PUBLIC_* values into the browser bundle when they are written
// literally as `process.env.NEXT_PUBLIC_NAME`. Reading them through an alias (`const env = process.env`)
// works on the server but leaves them undefined in the browser, silently forcing the demo.
const rawFlag = process.env.NEXT_PUBLIC_USE_MOCK_API;
const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

// An explicit NEXT_PUBLIC_USE_MOCK_API always wins. When it is left unset but a backend URL is
// configured, the app runs live (sign in / onboarding), so one variable is enough to leave the demo.
const flag = rawFlag;
export const USE_MOCK_API = flag === 'true' ? true : flag === 'false' ? false : !rawBaseUrl;

export const API_BASE_URL = USE_MOCK_API ? '/api' : rawBaseUrl || '/api';
