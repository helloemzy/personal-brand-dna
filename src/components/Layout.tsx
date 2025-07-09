import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { logoutUser } from '../store/slices/authSlice';
import { Menu, X } from 'lucide-react';
import SkipLinks from './accessibility/SkipLinks';
import LiveRegion from './accessibility/LiveRegion';
import { useFocusTrap, useEscapeKey, useAnnounce } from '../hooks/useAccessibility';
import { focusVisible, KeyCodes } from '../utils/accessibility';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageAnnouncement, setPageAnnouncement] = useState('');
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  
  // Trap focus in mobile menu when open
  useFocusTrap(mobileMenuRef, mobileMenuOpen);
  
  // Close mobile menu on escape
  useEscapeKey(() => setMobileMenuOpen(false), mobileMenuOpen);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
    announce('You have been logged out');
  };
  
  // Keyboard navigation for mobile menu
  const handleMobileMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === KeyCodes.ESCAPE) {
      setMobileMenuOpen(false);
    }
  };

  const navigation: Array<{name: string; href: string; icon: string; subscription?: string}> = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Brand House', href: '/brand-house', icon: '🏛️' },
    { name: 'Content Calendar', href: '/content/calendar', icon: '📅' },
    { name: 'Content Queue', href: '/content-approval', icon: '📋' },
    { name: 'News Sources', href: '/news-setup', icon: '📰' },
    { name: 'Analytics', href: '/analytics/dashboard', icon: '📈' },
    { name: 'Subscription', href: '/subscription', icon: '💳' },
  ];

  const filteredNavigation = navigation.filter(item => {
    if (item.subscription === 'professional') {
      return user?.subscriptionTier !== 'free';
    }
    return true;
  });

  // Announce page changes
  useEffect(() => {
    const pageName = navigation.find(item => item.href === location.pathname)?.name || 'Page';
    setPageAnnouncement(`Navigated to ${pageName}`);
  }, [location.pathname]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLinks />
      <LiveRegion message={pageAnnouncement} priority="polite" />
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu */}
      <div 
        ref={mobileMenuRef}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        onKeyDown={handleMobileMenuKeyDown}
      >
        <div className="flex h-full flex-col">
          {/* Mobile menu header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">BrandPillar AI</h2>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={`text-gray-400 hover:text-gray-600 p-2 rounded-md ${focusVisible}`}
              aria-label="Close navigation menu"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav 
            className="flex-1 px-4 py-6 space-y-2 overflow-y-auto"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } ${focusVisible}`
                }
              >
                <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
                <span>{item.name}</span>
                {item.subscription && user?.subscriptionTier === 'free' && (
                  <span className="ml-auto text-xs text-blue-600 font-medium" aria-label="Professional tier required">PRO</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Mobile User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center" aria-hidden="true">
                  <span className="text-sm font-medium text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user?.subscriptionTier} Plan
                </p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={handleLogout}
                  className={`text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 ${focusVisible}`}
                  aria-label="Log out of your account"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-white lg:shadow-lg" role="complementary" aria-label="Desktop sidebar">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">
              <NavLink to="/dashboard" className={focusVisible}>BrandPillar AI</NavLink>
            </h1>
          </div>

          {/* Desktop Navigation */}
          <nav 
            className="flex-1 px-4 py-6 space-y-2 overflow-y-auto"
            role="navigation"
            aria-label="Main navigation"
          >
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } ${focusVisible}`
                }
              >
                <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
                <span>{item.name}</span>
                {item.subscription && user?.subscriptionTier === 'free' && (
                  <span className="ml-auto text-xs text-blue-600 font-medium" aria-label="Professional tier required">PRO</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Desktop User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center" aria-hidden="true">
                  <span className="text-sm font-medium text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user?.subscriptionTier} Plan
                </p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={handleLogout}
                  className={`text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 ${focusVisible}`}
                  aria-label="Log out of your account"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64" role="region" aria-label="Main content area">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200" role="banner">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setMobileMenuOpen(true);
                    announce('Navigation menu opened');
                  }}
                  className={`text-gray-400 hover:text-gray-600 p-2 rounded-md lg:hidden ${focusVisible}`}
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-6 w-6" aria-hidden="true" />
                </button>
                <h2 className="ml-3 text-lg font-semibold text-gray-900 lg:ml-0">
                  {/* Page title will be handled by individual pages */}
                </h2>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Quick actions */}
                <NavLink
                  to="/profile"
                  className={`text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 ${focusVisible}`}
                  aria-label="Profile settings"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </NavLink>
                <NavLink
                  to="/subscription"
                  className={`text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 ${focusVisible}`}
                  aria-label="Subscription management"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </NavLink>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1" id="main" role="main" tabIndex={-1}>
          <div className="py-4 px-4 sm:py-6 sm:px-6 lg:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;