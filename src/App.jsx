import { useState, useRef, useEffect } from 'react'

// SVG Icons as components
const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8" />
    <path d="M8 11h6" />
  </svg>
)

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
    <path d="M19 13l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17 15l1.5-.5.5-1.5z" />
  </svg>
)

function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasDocuments, setHasDocuments] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [inputValue])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = { role: 'user', content: inputValue.trim() }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Show typing indicator
    setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }])

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userMessage.content,
          top_k: 5,
          model: 'all-MiniLM-L6-v2',
          llm: 'llama-3.3-70b-versatile'
        })
      })

      const data = await response.json()
      
      // Remove typing indicator and add actual response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isTyping)
        return [...filtered, { role: 'assistant', content: data.answer || data.error || 'No response received.' }]
      })
    } catch (error) {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isTyping)
        return [...filtered, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]
      })
    }

    setIsLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <BookIcon />
          </div>
          <div>
            <h1 className="logo-text">Docu<span>Mind</span></h1>
            <p className="header-subtitle">Intelligent Document Intelligence</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="header-btn">Documents</button>
          <button className="header-btn primary">New Chat</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">
                <SparklesIcon />
              </div>
              <h1>Welcome to DocuMind</h1>
              <p>
                Ask questions about your documents and get intelligent answers 
                powered by advanced RAG technology.
              </p>
              <div className="welcome-features">
                <div className="feature">
                  <span className="feature-dot"></span>
                  PDF Analysis
                </div>
                <div className="feature">
                  <span className="feature-dot"></span>
                  Smart Retrieval
                </div>
                <div className="feature">
                  <span className="feature-dot"></span>
                  Context-Aware AI
                </div>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'assistant' ? <SparklesIcon /> : <UserIcon />}
                  </div>
                  <div className="message-content">
                    {message.isTyping ? (
                      <div className="typing-indicator">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          <form onSubmit={handleSubmit} className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="input-field"
              placeholder="Ask anything about your documents..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              type="submit" 
              className={`send-button ${isLoading ? 'loading' : ''}`}
              disabled={!inputValue.trim() || isLoading}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App