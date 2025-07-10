import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'text',
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-gray-200';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// Composite skeleton components
export const TextBlockSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? '80%' : '100%'}
        height="1rem"
      />
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton width="60%" height="1.25rem" className="mb-2" />
        <Skeleton width="40%" height="0.875rem" />
      </div>
    </div>
    <TextBlockSkeleton lines={3} />
  </div>
);

export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 bg-white rounded-lg">
    <Skeleton variant="rectangular" width={64} height={64} />
    <div className="flex-1">
      <Skeleton width="70%" height="1.125rem" className="mb-2" />
      <Skeleton width="50%" height="0.875rem" />
    </div>
    <Skeleton variant="circular" width={32} height={32} />
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <Skeleton height="1rem" />
      </td>
    ))}
  </tr>
);

export const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <Skeleton width="40%" height="1.5rem" className="mb-4" />
    <div className="h-64 flex items-end gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton
            variant="rectangular"
            width="100%"
            height={`${Math.random() * 80 + 20}%`}
          />
        </div>
      ))}
    </div>
  </div>
);

// Page-specific skeleton loaders
export const DashboardSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    <ChartSkeleton />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="max-w-4xl mx-auto p-6">
    <div className="bg-white rounded-lg shadow p-8">
      <div className="flex items-center gap-6 mb-8">
        <Skeleton variant="circular" width={96} height={96} />
        <div className="flex-1">
          <Skeleton width="40%" height="2rem" className="mb-2" />
          <Skeleton width="60%" height="1rem" />
        </div>
      </div>
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <Skeleton width="30%" height="0.875rem" className="mb-2" />
            <Skeleton width="100%" height="2.5rem" variant="rectangular" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ContentListSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between mb-6">
      <Skeleton width={200} height="2rem" />
      <Skeleton width={120} height="2.5rem" variant="rectangular" />
    </div>
    <div className="grid gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Add shimmer animation to tailwind (add this to your CSS)
const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    #f3f4f6 25%,
    #e5e7eb 50%,
    #f3f4f6 75%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}
`;