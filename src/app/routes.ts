import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Dashboard } from "./pages/Dashboard";
import { Forecast } from "./pages/Forecast";
import { AddData } from "./pages/AddData";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "forecast", Component: Forecast },
      { path: "add-data", Component: AddData },
    ],
  },
]);
