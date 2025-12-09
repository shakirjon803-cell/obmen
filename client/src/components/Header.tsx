import { Plus, ArrowLeft } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useLocation, useNavigate } from 'react-router-dom';

function NellXLogo() {
  return (
    <img
      src="/gemini_generated_image_4g9jw74g9jw74g9j.png"
      alt="NellX"
      className="h-9 w-auto"
    />
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
