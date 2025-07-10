import React, { Suspense } from 'react';
import { lazyWithRetry } from '../../../utils/lazyWithPreload';
import { Linkedin } from 'lucide-react';

// Lazy load the LinkedIn content components
const LinkedInHeadlines = lazyWithRetry(() => 
  import('./LinkedInHeadlines')
);

const ElevatorPitches = lazyWithRetry(() => 
  import('./ElevatorPitches')
);

const ContentStarterPack = lazyWithRetry(() => 
  import('./ContentStarterPack')
);

// Skeleton loader for LinkedIn content
const LinkedInContentSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Linkedin className="w-5 h-5 text-gray-400" />
        <div className="h-6 w-40 bg-gray-200 rounded" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-50 rounded">
            <div className="h-4 w-full bg-gray-200 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface LazyLinkedInContentProps {
  linkedinContent: any;
  archetype: string;
}

export const LazyLinkedInContent: React.FC<LazyLinkedInContentProps> = ({ 
  linkedinContent, 
  archetype 
}) => {
  const [selectedHeadlineStyle, setSelectedHeadlineStyle] = React.useState('authority');
  const [selectedPitchDuration, setSelectedPitchDuration] = React.useState('30-second');

  return (
    <div className="space-y-8">
      <Suspense fallback={<LinkedInContentSkeleton />}>
        <LinkedInHeadlines
          headlines={linkedinContent.headlines}
          selectedStyle={selectedHeadlineStyle}
          onStyleChange={setSelectedHeadlineStyle}
          archetype={archetype}
        />
      </Suspense>

      <Suspense fallback={<LinkedInContentSkeleton />}>
        <ElevatorPitches
          pitches={linkedinContent.elevatorPitches}
          selectedDuration={selectedPitchDuration}
          onDurationChange={setSelectedPitchDuration}
        />
      </Suspense>

      <Suspense fallback={<LinkedInContentSkeleton />}>
        <ContentStarterPack
          ideas={linkedinContent.contentIdeas}
          contentPillars={linkedinContent.contentPillars}
        />
      </Suspense>
    </div>
  );
};

// Preload LinkedIn content when user scrolls near it
export const preloadLinkedInContent = () => {
  LinkedInHeadlines.preload();
  ElevatorPitches.preload();
  ContentStarterPack.preload();
};