// The single point every service module reads to decide where it talks
// to. Flip NEXT_PUBLIC_USE_MOCK_API to 'false' and set NEXT_PUBLIC_API_BASE_URL to swap
// every service function from the MSW mock to a real backend — no other
// code path differences, per section 43b's mock-to-real swap contract.
//
// Default is mock-on, since that's what this repo ships runnable today.

const env = typeof process !== 'undefined' ? process.env : {};

// An explicit NEXT_PUBLIC_USE_MOCK_API always wins. When it is left unset but a backend URL is
// configured, the app runs live (sign in / onboarding), so one variable is enough to leave the demo.
const flag = env.NEXT_PUBLIC_USE_MOCK_API;
export const USE_MOCK_API = flag === 'true' ? true : flag === 'false' ? false : !env.NEXT_PUBLIC_API_BASE_URL;

export const API_BASE_URL = USE_MOCK_API ? '/api' : env.NEXT_PUBLIC_API_BASE_URL || '/api';
