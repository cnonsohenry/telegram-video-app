function App() {
  const backendURL = "http://localhost:5000/upload";

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    const form = new FormData();
    form.append("video", file);

    const res = await fetch(backendURL, {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    console.log("Uploaded video:", data.url);
  };

  return (
    <div>
      <h1>Upload Video</h1>
      <input type="file" accept="video/*" onChange={handleUpload} />
    </div>
  );
}
