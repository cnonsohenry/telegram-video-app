import VideoGallery from "./components/VideoGallery";
import "./index.css";

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <h1 className="text-center text-2xl font-bold py-4">Video Library</h1>
      <VideoGallery />
    </div>
  );
}
