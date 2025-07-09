import React from 'react';
import * as Sentry from '@sentry/react';

interface SentryWorkshopProfilerProps {
  children: React.ReactNode;
  step: string;
}

/**
 * Sentry profiler specifically for workshop steps
 * Tracks performance and errors for each workshop step
 */
const SentryWorkshopProfiler: React.FC<SentryWorkshopProfilerProps> = ({ 
  children, 
  step 
}) => {
  return (
    <Sentry.Profiler 
      name={`WorkshopStep-${step}`}
      onMount={(component, metadata) => {
        // Track when a workshop step is mounted
        Sentry.addBreadcrumb({
          message: `Workshop step mounted: ${step}`,
          category: 'workshop',
          level: 'info',
          data: {
            step,
            renderTime: metadata?.renderTime,
          },
        });
      }}
      onUpdate={(component, metadata) => {
        // Track workshop step updates
        if (metadata?.renderTime && metadata.renderTime > 1000) {
          // Log slow renders
          Sentry.captureMessage(`Slow render in workshop step: ${step}`, {
            level: 'warning',
            tags: {
              workshop_step: step,
              render_time: metadata.renderTime.toString(),
            },
          });
        }
      }}
    >
      {children}
    </Sentry.Profiler>
  );
};

export default SentryWorkshopProfiler;