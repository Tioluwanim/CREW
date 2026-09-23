import type { MetadataRoute } from 'next';

const themeColor = '#1b1f2a';
const backgroundColor = '#faf8f4';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CREW',
    short_name: 'CREW',
    description: 'Cash-flow clarity for independent creators.',
    start_url: '/',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      { src: '/icons/crew-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/crew-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/crew-maskable-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icons/crew-maskable-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}