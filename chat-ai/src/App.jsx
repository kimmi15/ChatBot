import { useState, useRef, useEffect } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const env = import.meta.env.VITE_API_GENERATIVE_LANGUAGE_CLIENT || "";
const envImage = import.meta.env.VITE_API_GENERATIVE_IMAGE_CLIENT || "";

const promptTemplates = [
  "Summarize this article",
  "Generate code for a login form",
  "Translate this to Hindi",
  "Write a poem about the moon",
  "What are the benefits of meditation?"
];

function App() {
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [question, setQuestion] = useState(() => localStorage.getItem("draft") || "");
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem("searchHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [showFavorites, setShowFavorites] = useState(false);

  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, generatingAnswer, loadingImage]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  }, [chatHistory, searchHistory]);

  useEffect(() => {
    localStorage.setItem("draft", question);
  }, [question]);

  function addUserMessage(prompt) {
    setChatHistory(prev => [...prev, { type: "question", content: prompt }]);
    if (!searchHistory.includes(prompt)) {
      setSearchHistory(prev => [prompt, ...prev]);
    }
  }

  async function generateAnswer(e) {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    const prompt = question.trim();
    setGeneratingAnswer(true);
    addUserMessage(prompt);
    setQuestion("");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await response.json();
      const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
      setChatHistory(prev => [
        ...prev,
        { type: "answer", content: aiResponse, favorite: false, feedback: null },
      ]);
    } catch (error) {
      console.error(error);
      alert("Error generating answer. Please try again.");
    }
    setGeneratingAnswer(false);
  }

  async function handleImageGenerate() {
    if (!question.trim()) return;
    const prompt = question.trim();
    setLoadingImage(true);
    addUserMessage(prompt);
    setQuestion("");

    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("output_format", "webp");

      const response = await axios.post(
        "https://api.stability.ai/v2beta/stable-image/generate/ultra",
        formData,
        {
          headers: {
            Authorization: `Bearer ${envImage}`,
            Accept: "image/*",
          },
          responseType: "arraybuffer",
        }
      );

      const blob = new Blob([response.data], { type: "image/webp" });
      const imageUrl = URL.createObjectURL(blob);
      setChatHistory(prev => [...prev, { type: "image", content: imageUrl }]);
    } catch (error) {
      console.error(error);
      alert(`Image generation failed: ${error?.response?.status || error.message}`);
    }
    setLoadingImage(false);
  }

  function toggleFavorite(index) {
    setChatHistory(prev =>
      prev.map((item, idx) =>
        idx === index ? { ...item, favorite: !item.favorite } : item
      )
    );
  }

  function setFeedback(index, value) {
    setChatHistory(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, feedback: value } : item))
    );
  }

  function clearChat() {
    if (confirm("Clear chat history?")) {
      setChatHistory([]);
    }
  }

  function exportChatAsText() {
    const text = chatHistory
      .map(item => {
        const prefix =
          item.type === "question"
            ? "👤 User:"
            : item.type === "answer"
              ? "🤖 AI:"
              : "🖼️ Image URL:";
        return `${prefix} ${item.content}`;
      })
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat-history.txt";
    link.click();
  }

  return (
    <div className="flex h-screen">
      {/* Right Sidebar */}
      <aside className="w-60 p-3 border-l border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Search History</h2>
        <ul className="space-y-1">
          {searchHistory.length === 0 ? (
            <li className="text-sm text-gray-500">No searches yet</li>
          ) : (
            searchHistory.map((item, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded text-sm hover:bg-blue-100 dark:hover:bg-gray-600"
              >
                <span
                  className="cursor-pointer flex-1"
                  onClick={() => setQuestion(item)}
                >
                  {item}
                </span>
                <button
                  onClick={() => {
                    const updated = searchHistory.filter((_, i) => i !== idx);
                    setSearchHistory(updated);
                  }}
                  className="text-red-500 ml-2 font-bold hover:text-red-700"
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col p-3">
        <header className="flex flex-wrap gap-2 justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-blue-500">Gemini Chat AI</h1>
          <div className="flex gap-2 flex-wrap">
            <select
              onChange={(e) => setQuestion(e.target.value)}
              className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
            >
              <option value="">🧠 Choose a Prompt</option>
              {promptTemplates.map((template, index) => (
                <option key={index} value={template}>{template}</option>
              ))}
            </select>
            <button onClick={() => setShowFavorites(!showFavorites)} className="text-sm px-2 py-1 bg-yellow-400 rounded">
              {showFavorites ? "Show All" : "⭐ Favorites"}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="text-sm px-2 py-1 bg-blue-500 text-white rounded">
              {darkMode ? "☀ Light" : "🌙 Dark"}
            </button>
            <button onClick={clearChat} className="text-sm px-2 py-1 bg-red-500 text-white rounded">
              Clear
            </button>
            <button
              onClick={exportChatAsText}
              className="text-sm px-2 py-1 bg-purple-600 text-white rounded"
            >
              Export Chat
            </button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 bg-white dark:bg-gray-700 p-2 rounded">
          {chatHistory.length === 0 ? (
            <div className="text-center text-gray-500">Start by asking something below.</div>
          ) : (
            chatHistory
              .filter(item => !showFavorites || item.favorite)
              .map((item, idx) => (
                <div key={idx} className={`flex ${item.type === "question" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] p-2 rounded-lg ${item.type === "question"
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-gray-200 dark:bg-gray-600 text-black dark:text-white rounded-bl-none"
                      }`}
                  >
                    {item.type === "image" ? (
                      <img src={item.content} alt="Generated" className="rounded" />
                    ) : (
                      <ReactMarkdown>{item.content}</ReactMarkdown>
                    )}
                    {item.type === "answer" && (
                      <div className="mt-1 flex gap-2 text-xs">
                        <button onClick={() => toggleFavorite(idx)}>
                          {item.favorite ? "⭐ Unfavorite" : "☆ Favorite"}
                        </button>
                        <button onClick={() => setFeedback(idx, "👍")}>👍</button>
                        <button onClick={() => setFeedback(idx, "👎")}>👎</button>
                        {item.feedback && <span>{item.feedback}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
          {generatingAnswer && <div className="text-left animate-pulse">✏️ Generating answer...</div>}
          {loadingImage && <div className="text-left animate-pulse">🖼️ Generating image...</div>}
        </div>

        <form onSubmit={generateAnswer} className="mt-2 flex gap-2">
          <textarea
            className="flex-1 p-2 border rounded bg-white dark:bg-gray-800 text-black dark:text-white"
            placeholder="Ask something..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={2}
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={generatingAnswer}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {generatingAnswer ? "..." : "Send"}
            </button>
            <button
              type="button"
              onClick={handleImageGenerate}
              disabled={loadingImage}
              className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
            >
              {loadingImage ? "..." : "Image"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
