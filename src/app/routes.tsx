import { createBrowserRouter, Navigate, useOutletContext } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Dashboard } from "./pages/Dashboard";
import { Forecast } from "./pages/Forecast";
import { AddData } from "./pages/AddData";
import { Counter } from "./pages/Counter";
import { History } from './pages/History';
import { Members } from './pages/Members';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function HistoryRoute() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>();
  return <History isAdmin={isAdmin} />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "forecast", Component: Forecast },
      { path: "counter", Component: Counter },
      { path: "history", element: <HistoryRoute /> },
      { path: "add-data", Component: AddData },
      { path: "members", element: <AdminRoute><Members /></AdminRoute> },
    ],
  },
]);