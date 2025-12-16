export default function VideoCard({ video }) {
  const videoUrl = `http://localhost:3000/video?chat_id=${video.chat_id}&message_id=${video.message_id}`;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <video
        src={videoUrl}
        controls
        className="w-full rounded"
      />
      <p className="text-xs text-gray-500 mt-2">
        {new Date(video.created_at).toLocaleString()}
      </p>
    </div>
  );
}
