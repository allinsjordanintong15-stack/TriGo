import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';

// A data router, so pages can use useBlocker (unsaved Settings changes). Its one catch-all
// route renders the existing route tree (src/routes.tsx) as descendant routes, so every
// URL, tab and redirect behaves as it did under <BrowserRouter>.
const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
