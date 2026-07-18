import { Alert, AlertDescription } from './ui/alert';
import { useDarkMode } from '../context/DarkModeContext';

interface DataLoadingStateProps {
  label?: string;
}

/** Shown in place of a page's data-dependent content while it's first loading. */
export function DataLoadingState({ label = 'Loading data' }: DataLoadingStateProps) {
  const { darkMode } = useDarkMode();

  return (
    <div className={`app-shell-card flex flex-col items-center justify-center gap-4 p-10 text-center`}>
      <div
        className={`h-10 w-10 animate-spin rounded-full border-4 ${
          darkMode ? 'border-slate-700 border-t-cyan-400' : 'border-slate-200 border-t-blue-600'
        }`}
      />
      <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </p>
    </div>
  );
}

interface DataErrorStateProps {
  message: string;
}

/** Shown in place of a page's data-dependent content when it failed to load. */
export function DataErrorState({ message }: DataErrorStateProps) {
  return (
    <Alert variant="destructive" className="app-shell-card border-0">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
