import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface SectionPresenceProps {
  sectionId: string;
  children: React.ReactNode;
  className?: string;
  showIndicator?: boolean;
  threshold?: number; // Time in ms to consider someone "in" the section
}

interface SectionUser {
  userId: string;
  userName: string;
  enteredAt: number;
  scrollPosition?: number;
  isActive: boolean;
}

const SectionPresence: React.FC<SectionPresenceProps> = ({
  sectionId,
  children,
  className = '',
  showIndicator = true,
  threshold = 1000 // 1 second
}) => {
  const [usersInSection, setUsersInSection] = useState<SectionUser[]>([]);
  const [isUserInSection, setIsUserInSection] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const enterTimeRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const user = useSelector((state: RootState) => state.auth.user);
  const { isConnected, emit, on, off } = useWebSocket({ autoConnect: false });

  // Intersection Observer to detect when user enters/leaves section
  useEffect(() => {
    if (!sectionRef.current || !user) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        
        if (entry.isIntersecting) {
          // User entered the section
          if (!isUserInSection) {
            enterTimeRef.current = Date.now();
            
            // Clear any pending exit timeout
            if (exitTimeoutRef.current) {
              clearTimeout(exitTimeoutRef.current);
              exitTimeoutRef.current = null;
            }

            // Wait for threshold before marking as "in section"
            setTimeout(() => {
              if (enterTimeRef.current && Date.now() - enterTimeRef.current >= threshold) {
                setIsUserInSection(true);
                
                if (isConnected) {
                  emit('section_enter', {
                    sectionId,
                    userId: user.id,
                    userName: user.name || user.email,
                    enteredAt: Date.now(),
                    scrollPosition: window.scrollY
                  });
                }
              }
            }, threshold);
          }
        } else {
          // User left the section
          enterTimeRef.current = null;
          
          if (isUserInSection) {
            // Add a small delay before marking as left to prevent flicker
            exitTimeoutRef.current = setTimeout(() => {
              setIsUserInSection(false);
              
              if (isConnected) {
                emit('section_exit', {
                  sectionId,
                  userId: user.id,
                  userName: user.name || user.email,
                  exitedAt: Date.now()
                });
              }
            }, 500);
          }
        }
      },
      {
        threshold: 0.3, // 30% of the section must be visible
        rootMargin: '0px 0px -20% 0px' // Only trigger when well into viewport
      }
    );

    observer.observe(sectionRef.current);

    return () => {
      observer.disconnect();
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [sectionId, user, isConnected, isUserInSection, threshold, emit]);

  // Listen for other users entering/leaving the section
  useEffect(() => {
    if (!isConnected) return;

    const handleSectionEnter = (data: SectionUser & { sectionId: string }) => {
      if (data.sectionId !== sectionId || data.userId === user?.id) return;
      
      setUsersInSection(prev => {
        const exists = prev.find(u => u.userId === data.userId);
        if (exists) {
          return prev.map(u => 
            u.userId === data.userId 
              ? { ...u, isActive: true, enteredAt: data.enteredAt }
              : u
          );
        } else {
          return [...prev, {
            userId: data.userId,
            userName: data.userName,
            enteredAt: data.enteredAt,
            scrollPosition: data.scrollPosition,
            isActive: true
          }];
        }
      });
    };

    const handleSectionExit = (data: { sectionId: string; userId: string; userName: string }) => {
      if (data.sectionId !== sectionId || data.userId === user?.id) return;
      
      setUsersInSection(prev => 
        prev.filter(u => u.userId !== data.userId)
      );
    };

    on('section_enter', handleSectionEnter);
    on('section_exit', handleSectionExit);

    return () => {
      off('section_enter', handleSectionEnter);
      off('section_exit', handleSectionExit);
    };
  }, [isConnected, sectionId, user?.id, on, off]);

  // Clean up inactive users
  useEffect(() => {
    const cleanup = setInterval(() => {
      setUsersInSection(prev => 
        prev.filter(user => 
          Date.now() - user.enteredAt < 5 * 60 * 1000 // Remove after 5 minutes
        )
      );
    }, 60000);

    return () => clearInterval(cleanup);
  }, []);

  const activeUserCount = usersInSection.length;
  const hasActiveUsers = activeUserCount > 0;

  return (
    <div 
      ref={sectionRef} 
      className={`relative ${className} ${
        isUserInSection ? 'ring-2 ring-indigo-200 ring-opacity-50' : ''
      }`}
      data-section-id={sectionId}
    >
      {children}
      
      {/* Presence Indicator */}
      {showIndicator && hasActiveUsers && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-white dark:bg-gray-800 rounded-full px-3 py-1 shadow-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-1">
                {usersInSection.slice(0, 3).map((user) => (
                  <div
                    key={user.userId}
                    className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium"
                    title={user.userName}
                  >
                    {user.userName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {activeUserCount === 1 ? (
                  <span>{usersInSection[0].userName} is here</span>
                ) : activeUserCount <= 3 ? (
                  <span>{activeUserCount} people here</span>
                ) : (
                  <span>{activeUserCount} people here</span>
                )}
              </div>
              
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}
      
      {/* Current User Indicator */}
      {isUserInSection && showIndicator && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-1 rounded-full border border-indigo-300 dark:border-indigo-700">
            You are viewing this section
          </div>
        </div>
      )}
      
      {/* Section Activity Overlay */}
      {hasActiveUsers && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Subtle glow effect to indicate activity */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 opacity-30 rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default SectionPresence;