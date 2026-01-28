import { useEffect } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";

export default function App() {
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/*<Header />*/}
      <Home />
    </div>
  );
}
