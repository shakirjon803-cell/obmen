import { Plus, ArrowLeft } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useLocation, useNavigate } from 'react-router-dom';

function NellXLogo() {
  return (
    <svg
      width="120"
      height="36"
      viewBox="0 0 120 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="select-none"
      aria-label="NellX"
    >
      {/* N */}
      <path
        d="M4 28V8h3.2l8.4 13.6V8h3.2v20h-3.2L7.2 14.4V28H4z"
        fill="#111827"
      />
      {/* e */}
      <path
        d="M24.5 21.2c0 .4.1.6.1.8h-8.8c.2 1.2.7 2.1 1.5 2.7.8.6 1.8.9 3 .9 1.6 0 2.9-.5 3.9-1.6l1.8 2c-.7.8-1.5 1.4-2.5 1.8-1 .4-2.1.6-3.4.6-1.5 0-2.9-.3-4-1-1.2-.6-2.1-1.5-2.7-2.7-.6-1.1-1-2.4-1-3.9 0-1.4.3-2.7.9-3.9.6-1.1 1.5-2 2.6-2.7 1.1-.6 2.4-1 3.8-1 1.4 0 2.6.3 3.7 1 1.1.6 1.9 1.5 2.5 2.6.6 1.1.9 2.4.9 3.9v.5zm-8.8-1.4h6.2c-.1-1.1-.5-2-1.2-2.6-.7-.6-1.5-.9-2.5-.9s-1.8.3-2.5.9c-.6.6-1 1.5-1 2.6z"
        fill="#111827"
      />
      {/* l */}
      <path
        d="M27 28V6h3v22h-3z"
        fill="#111827"
      />
      {/* l */}
      <path
        d="M33 28V6h3v22h-3z"
        fill="#111827"
      />
      {/* X - stylized with gradient */}
      <defs>
        <linearGradient id="xGradient" x1="40" y1="8" x2="60" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <path
        d="M40 8h4.2l5.8 8.8L55.8 8H60l-8 11.5L60.2 28H56l-6-8.5-6 8.5h-4.2l8.2-8.5L40 8z"
        fill="url(#xGradient)"
      />
      {/* Decorative dot */}
      <circle cx="67" cy="24" r="3" fill="#3B82F6" />
    </svg>
  );
}

export function Header() {
  const { role, activeTab, setShowAddPostModal, registration } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're on a sub-page
  const isSubPage = location.pathname !== '/' &&
    !location.pathname.startsWith('/feed') &&
    location.pathname !== '';

  const showBackButton = isSubPage || location.pathname.includes('/post/') || location.pathname.includes('/user/');

  // Show add button for exchangers on feed or offers tabs
  const isRegistered = registration.completed === true;
  const showAddButton = role === 'exchanger' && (activeTab === 'feed' || activeTab === 'offers') && isRegistered;

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50">
      <div className="flex justify-between items-center px-4 py-2.5 max-w-md mx-auto">
        {/* Left: Back button or spacer */}
        <div className="w-10 flex justify-start">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={22} />
            </button>
          )}
        </div>

        {/* Center: Logo */}
        <div className="flex-1 flex justify-center">
          <NellXLogo />
        </div>

        {/* Right: Add button or spacer */}
        <div className="w-10 flex justify-end">
          {showAddButton && (
            <button
              onClick={() => setShowAddPostModal(true)}
              className="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
              aria-label="Add post"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
