'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SerwistProvider } from '@serwist/next/react';
import { MotionConfig } from 'framer-motion';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === 'development'}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </QueryClientProvider>
    </SerwistProvider>
  );
}