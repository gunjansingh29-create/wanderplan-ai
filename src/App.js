import WanderPlanLLMFlow from "./WanderPlanLLMFlow";
import TripWizard from "./TripWizard";

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/trip/new" || path.startsWith("/trip/")) {
    return <TripWizard />;
  }
  return <WanderPlanLLMFlow />;
}
