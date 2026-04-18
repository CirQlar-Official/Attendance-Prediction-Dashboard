import { createBrowserRouter, Navigate, useOutletContext } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Dashboard } from "./pages/Dashboard";
import { Forecast } from "./pages/Forecast";
import { AddData } from "./pages/AddData";
import { History } from './pages/History';

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
      { path: "history", element: <HistoryRoute /> },
      { 
        path: "add-data", 
        element: <AdminRoute><AddData /></AdminRoute>
      },
    ],
  },
]);