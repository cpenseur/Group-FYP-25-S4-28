import { useEffect, useState } from "react";

function App() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hello/")
      .then((res) => res.json())
      .then((data) => setMsg(data.message))
      .catch(() => setMsg("Error calling API"));
  }, []);

  return (
    <div>
      <p>{msg}</p>
    </div>
  );
}

export default App;
