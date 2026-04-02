import { memo, useCallback, useState, type FormEvent } from "react";
import type { User } from "../types";
import { loginApi, signupApi } from "../accountApi";

type AuthModalProps = {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onClose: () => void;
  onAuthed: (payload: { token: string; user: User }) => void;
};

const AuthModal = memo(function AuthModal({
  mode,
  onModeChange,
  onClose,
  onAuthed,
}: AuthModalProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (pending) return;
      setError(null);

      setPending(true);
      try {
        if (mode === "login") {
          const payload = await loginApi({
            email: loginEmail,
            password: loginPassword,
          });
          onAuthed(payload);
          onClose();
          return;
        }

        const payload = await signupApi({
          name,
          email: signupEmail,
          password: signupPassword,
        });
        onAuthed(payload);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setPending(false);
      }
    },
    [
      mode,
      pending,
      loginEmail,
      loginPassword,
      name,
      signupEmail,
      signupPassword,
      onAuthed,
      onClose,
    ],
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "login" ? "Login" : "Create account"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mode === "login"
                ? "Access your saved favorites"
                : "Sign up to save favorites permanently"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm"
          >
            Close
          </button>
        </div>

        <form className="px-6 py-5" onSubmit={onSubmit}>
          {mode === "signup" && (
            <div className="space-y-3 mb-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-400"
                placeholder="Name"
                type="text"
              />
              <input
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-400"
                placeholder="Email"
                type="email"
              />
              <input
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-400"
                placeholder="Password"
                type="password"
              />
            </div>
          )}

          {mode === "login" && (
            <div className="space-y-3 mb-4">
              <input
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-400"
                placeholder="Email"
                type="email"
              />
              <input
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-400"
                placeholder="Password"
                type="password"
              />
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            disabled={pending}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-3xl font-semibold text-lg disabled:opacity-70"
          >
            {pending
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>

          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => onModeChange("signup")}
                  className="text-violet-600 dark:text-violet-400 font-semibold"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => onModeChange("login")}
                  className="text-violet-600 dark:text-violet-400 font-semibold"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
});

export default AuthModal;

