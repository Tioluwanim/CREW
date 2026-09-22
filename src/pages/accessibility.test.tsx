import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { expect as vitestExpect } from 'vitest';
import { ProjectDetailPage } from './ProjectDetailPage';
import { OnboardingPage } from './OnboardingPage';
import { CopilotProvider } from '../components/copilot/CopilotContext';
import { useProjectStore } from '../store/projectStore';

vitestExpect.extend(toHaveNoViolations);

describe('accessibility', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('project workspace has no detectable axe violations on the Overview tab', async () => {
    const { container } = render(
      <MemoryRouter>
        <CopilotProvider>
          <ProjectDetailPage />
        </CopilotProvider>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('onboarding has no detectable axe violations on step 1', async () => {
    const { container } = render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
