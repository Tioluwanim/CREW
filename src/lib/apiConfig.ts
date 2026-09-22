// The single point every service module reads to decide where it talks
// to. Flip VITE_USE_MOCK_API to 'false' and set VITE_API_BASE_URL to swap
// every service function from the MSW mock to a real backend — no other
// code path differences, per section 43b's mock-to-real swap contract.
//
// Default is mock-on, since that's what this repo ships runnable today.

const env = import.meta.env as Record<string, string | undefined>;

export const USE_MOCK_API = env.VITE_USE_MOCK_API !== 'false';

export const API_BASE_URL = USE_MOCK_API ? '/api' : env.VITE_API_BASE_URL || '/api';
