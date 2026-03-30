import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DarkModeProvider } from './context/DarkModeContext';
import { Splash } from './components/Splash';

export default function App() {
  return (
    <DarkModeProvider>
      <Splash />
      <RouterProvider router={router} />
    </DarkModeProvider>
  );
}