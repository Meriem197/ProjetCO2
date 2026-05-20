import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { UiProvider } from "@/context/UiContext";
import { CloudBackground } from "@/components/theme/PremiumElements";
import { routes } from "@/routes/config";
import ProtectedRoute from "@/routes/ProtectedRoute";

const queryClient = new QueryClient();

// React Router “future flags” (préparation v7)
const router = createBrowserRouter(
  routes.map((route) => {
    if (route.isProtected) {
      return {
        ...route,
        element: <ProtectedRoute roles={route.roles}>{route.element}</ProtectedRoute>,
      };
    }
    return route;
  }),
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CloudBackground />
      <UiProvider>
        <AuthProvider>
          <DataProvider>
            <RouterProvider router={router} />
          </DataProvider>
        </AuthProvider>
      </UiProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
