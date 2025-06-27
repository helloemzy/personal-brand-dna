/**
 * Skeleton screens for improved perceived performance
 * Show these while content is loading
 */

import React from 'react';

// Base skeleton component with shimmer animation
const SkeletonBase: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// Article card skeleton for news dashboard
export const ArticleCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
    <div className="flex justify-between items-start mb-3">
      <div className="flex-1">
        <SkeletonBase className="h-6 w-3/4 mb-2" />
        <div className="flex items-center space-x-3">
          <SkeletonBase className="h-4 w-24" />
          <SkeletonBase className="h-4 w-1" />
          <SkeletonBase className="h-4 w-32" />
        </div>
      </div>
      <SkeletonBase className="h-8 w-8 rounded" />
    </div>
    <SkeletonBase className="h-4 w-full mb-2" />
    <SkeletonBase className="h-4 w-5/6 mb-3" />
    <div className="flex items-center justify-between">
      <SkeletonBase className="h-4 w-28" />
      <SkeletonBase className="h-4 w-16" />
    </div>
  </div>
);

// Content generation page skeleton
export const ContentGenerationSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow-sm p-6">
      <SkeletonBase className="h-6 w-48 mb-4" />
      <SkeletonBase className="h-32 w-full mb-4" />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonBase className="h-10 w-full" />
        <SkeletonBase className="h-10 w-full" />
      </div>
    </div>
    
    <div className="bg-white rounded-lg shadow-sm p-6">
      <SkeletonBase className="h-6 w-32 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <SkeletonBase className="h-5 w-48 mb-2" />
            <SkeletonBase className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Dashboard stats skeleton
export const DashboardStatsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <SkeletonBase className="h-4 w-24 mb-2" />
            <SkeletonBase className="h-8 w-16" />
          </div>
          <SkeletonBase className="h-10 w-10 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

// Voice profile skeleton
export const VoiceProfileSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-6">
      <div>
        <SkeletonBase className="h-6 w-48 mb-2" />
        <SkeletonBase className="h-4 w-64" />
      </div>
      <SkeletonBase className="h-12 w-24 rounded-lg" />
    </div>
    
    <div className="mb-8">
      <div className="bg-gray-50 rounded-lg p-6 flex items-center justify-center">
        <SkeletonBase className="h-48 w-48 rounded-full" />
      </div>
    </div>
    
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <SkeletonBase className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <SkeletonBase className="h-4 w-32" />
                <SkeletonBase className="h-4 w-12" />
              </div>
              <SkeletonBase className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <SkeletonBase className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <SkeletonBase className="h-4 w-32" />
                <SkeletonBase className="h-4 w-12" />
              </div>
              <SkeletonBase className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Content history table skeleton
export const ContentHistorySkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <SkeletonBase className="h-6 w-48" />
        <SkeletonBase className="h-10 w-32" />
      </div>
    </div>
    
    <div className="divide-y divide-gray-200">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SkeletonBase className="h-5 w-64 mb-2" />
              <div className="flex items-center space-x-4">
                <SkeletonBase className="h-4 w-20" />
                <SkeletonBase className="h-4 w-32" />
                <SkeletonBase className="h-4 w-24" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <SkeletonBase className="h-8 w-16 rounded" />
              <SkeletonBase className="h-8 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Workshop step skeleton
export const WorkshopStepSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div>
      <SkeletonBase className="h-8 w-64 mb-2" />
      <SkeletonBase className="h-4 w-full max-w-2xl" />
    </div>
    
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center">
        <SkeletonBase className="h-5 w-5 mr-2" />
        <SkeletonBase className="h-4 w-48" />
      </div>
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="p-4 rounded-lg border-2 border-gray-200">
          <SkeletonBase className="h-5 w-32 mb-2" />
          <SkeletonBase className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
);

// Analytics chart skeleton
export const AnalyticsChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <SkeletonBase className="h-6 w-48 mb-4" />
    <div className="h-64 flex items-end justify-between space-x-2">
      {[40, 65, 30, 85, 55, 75, 45].map((height, i) => (
        <SkeletonBase
          key={i}
          className="flex-1"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
    <div className="flex justify-between mt-4">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
        <SkeletonBase key={day} className="h-4 w-8" />
      ))}
    </div>
  </div>
);

// LinkedIn settings skeleton
export const LinkedInSettingsSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center">
        <SkeletonBase className="h-10 w-10 rounded-full mr-3" />
        <div>
          <SkeletonBase className="h-5 w-48 mb-1" />
          <SkeletonBase className="h-4 w-32" />
        </div>
      </div>
      <SkeletonBase className="h-10 w-24 rounded" />
    </div>
    
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div>
            <SkeletonBase className="h-4 w-48 mb-1" />
            <SkeletonBase className="h-3 w-64" />
          </div>
          <SkeletonBase className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

// Generic list skeleton
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
        <SkeletonBase className="h-5 w-48 mb-2" />
        <SkeletonBase className="h-4 w-full mb-1" />
        <SkeletonBase className="h-4 w-3/4" />
      </div>
    ))}
  </div>
);

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
      <div className="flex space-x-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBase key={i} className="h-4 w-24" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4">
          <div className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonBase 
                key={colIndex} 
                className={`h-4 ${colIndex === 0 ? 'w-48' : 'w-24'}`} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);