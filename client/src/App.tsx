import { useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { useHistory } from "./hooks/useHistory";
import { useRecorder, MIME_TYPE } from "./hooks/useRecorder";
import { useInactivityTimer } from "./hooks/useInactivityTimer";
import AuthForm from "./components/AuthForm";
import RecorderPanel from "./components/RecorderPanel";
import HistorySidebar from "./components/HistorySidebar";

export default function App() {
  const auth = useAuth();
  const history = useHistory(auth.token, auth.isAuthenticated);

  // Break the circular dep: useRecorder needs to call handleLogout on 401,
  // but handleLogout calls recorder.reset(). A ref lets useRecorder always
  // call the latest handleLogout without it being a hook dep.
  const handleLogoutRef = useRef<() => void>(() => {});
  const recorder = useRecorder(auth.token, () => handleLogoutRef.current(), history.refresh);

  const handleLogout = () => {
    auth.logout();
    recorder.reset();
    history.reset();
  };
  handleLogoutRef.current = handleLogout;

  useInactivityTimer(auth.isAuthenticated, () => {
    handleLogout();
    alert("You have been logged out due to inactivity.");
  });

  if (!auth.isAuthenticated) {
    return (
      <AuthForm
        isRegistering={auth.isRegistering}
        isVerifying={auth.isVerifying}
        authError={auth.authError}
        onSubmit={auth.handleAuth}
        onToggleMode={auth.toggleMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8">
        <RecorderPanel
          user={auth.user}
          onLogout={handleLogout}
          recording={recorder.recording}
          onStart={recorder.start}
          onStop={recorder.stop}
          audioUrl={recorder.audioUrl}
          mimeType={MIME_TYPE}
          error={recorder.error}
          transcript={recorder.transcript}
        />
        <HistorySidebar history={history.history} />
      </div>

      <p className="mt-12 text-sm text-gray-500">
        For support, contact{" "}
        <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
          narmilas@proton.me
        </a>
      </p>
    </div>
  );
}
