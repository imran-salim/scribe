import { useEffect } from "react";
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
  const recorder = useRecorder(auth.token, auth.logout, history.refresh);

  // Reset transient recorder and history state whenever the user is no longer
  // authenticated (covers logout, inactivity timeout, and 401 mid-session).
  useEffect(() => {
    if (!auth.isAuthenticated) {
      recorder.reset();
      history.reset();
    }
  }, [auth.isAuthenticated, recorder.reset, history.reset]);

  useInactivityTimer(auth.isAuthenticated, () => {
    auth.logout();
    alert("You have been logged out due to inactivity.");
  });

  if (!auth.isAuthenticated) {
    return (
      <AuthForm
        isRegistering={auth.isRegistering}
        isVerifying={auth.isVerifying}
        authError={auth.authError}
        onSubmit={auth.handleAuth}
        // onToggleMode={auth.toggleMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8">
        <RecorderPanel
          user={auth.user}
          onLogout={auth.logout}
          recording={recorder.recording}
          isStarting={recorder.isStarting}
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
