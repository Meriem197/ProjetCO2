/**
 * =============================================================================
 * components/LoadingSpinner.jsx — SIMPLE LOADING COMPONENT
 * =============================================================================
 * Used for lazy-loaded page loading states
 * =============================================================================
 */

export default function LoadingSpinner({ message = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-gray-300 font-medium">{message}</p>
      </div>
    </div>
  );
}
