import { Alert, AlertDescription } from './ui/alert';

interface DataLoadingStateProps {
  label?: string;
}

/** Shown in place of a page's data-dependent content while it's first loading. */
export function DataLoadingState({ label = 'Loading data' }: DataLoadingStateProps) {
  return (
    <div className="app-shell-card flex flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-cyan-400" />
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
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
