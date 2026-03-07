type Props = {
  isRegistering: boolean;
  isVerifying: boolean;
  authError: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  // onToggleMode: () => void;
};

export default function AuthForm({ isRegistering, isVerifying, authError, onSubmit, /*onToggleMode*/ }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Scribe</h1>
        <h2 className="text-xl font-bold text-gray-700 mb-6">
          {isRegistering ? "Create an account" : "Sign in"}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email address"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              required
              disabled={isVerifying}
            />
          </div>
          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              required
              disabled={isVerifying}
            />
          </div>
          {authError && (
            <p className="text-red-500 text-sm font-medium">{authError}</p>
          )}
          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? "Processing..." : isRegistering ? "Register" : "Sign In"}
          </button>
        </form>

        {/* Registration disabled — uncomment to re-enable the toggle
        <button
          onClick={onToggleMode}
          className="mt-6 text-sm text-emerald-600 hover:underline font-medium"
        >
          {isRegistering ? "Already have an account? Sign in" : "Need an account? Register"}
        </button>

        <div className="mt-6 text-sm text-gray-400 font-medium">
          Registration is currently disabled.
        </div>
        */}

        <p className="mt-8 text-sm text-gray-500">
          For support, contact{" "}
          <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
            narmilas@proton.me
          </a>
        </p>
      </div>
    </div>
  );
}
