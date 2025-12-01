import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hello/")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => {
        console.error(err);
        setMessage("Error calling API");
      });
  }, []);

  return (
    <div style={{ padding: "2rem", color: "#fff", background: "#000", minHeight: "100vh" }}>
      <h1>TripMate Frontend</h1>
      <p>Backend says: {message}</p>
    </div>
  );
}

export default App;
