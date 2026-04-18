// app.js
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// UI Elements
const setupView = document.getElementById('setup-view');
const chatView = document.getElementById('chat-view');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const summarizeBtn = document.getElementById('summarize-btn');
const summaryOutput = document.getElementById('summary-output');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatHistory = document.getElementById('chat-history');
const pageTitleEl = document.getElementById('page-title');
const apiStatusDot = document.getElementById('api-status');
const apiStatusText = document.getElementById('api-status-text');
const settingsBtn = document.getElementById('settings-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

let API_KEY = "";

// Initialize
async function init() {
  const data = await chrome.storage.local.get(['gemini_api_key']);
  if (data.gemini_api_key) {
    API_KEY = data.gemini_api_key;
    showView('chat');
    updateStatus(true, "Gemini 2.5 Flash Ready");
  } else {
    showView('setup');
    updateStatus(false, "API Key Required");
  }
  
  // Detect active tab info
  updatePageInfo();
}

function showView(view) {
  if (view === 'setup') {
    setupView.classList.remove('hidden');
    chatView.classList.add('hidden');
  } else {
    setupView.classList.add('hidden');
    chatView.classList.remove('hidden');
  }
}

function updateStatus(ready, text) {
  if (ready) {
    apiStatusDot.classList.remove('error');
    apiStatusText.innerText = "Gemini 2.5 Flash Ready";
  } else {
    apiStatusDot.classList.add('error');
    apiStatusText.innerText = text || "Error";
  }
}

async function updatePageInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageTitleEl.innerText = tab.title || "Unknown Page";
  }
}

// Tab Switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(`${tabId}-panel`).classList.add('active');
  });
});

// API Key Logic
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    await chrome.storage.local.set({ gemini_api_key: key });
    API_KEY = key;
    showView('chat');
    updateStatus(true);
  }
});

settingsBtn.addEventListener('click', () => {
  showView('setup');
});

// Content Extraction Helper
async function getPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageContent" });
    return response;
  } catch (err) {
    console.error("Content extraction failed:", err);
    return null;
  }
}

// Gemini API Wrapper
async function callGemini(prompt) {
  const url = `${API_URL}?key=${API_KEY}`;
  
  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
}

// Summarization Logic
summarizeBtn.addEventListener('click', async () => {
  summarizeBtn.disabled = true;
  summarizeBtn.innerText = "Analyzing Pulse...";
  summaryOutput.classList.remove('empty');
  summaryOutput.innerHTML = '<div class="loading">Generating summary with Gemini 2.5 Flash...</div>';

  try {
    const pageData = await getPageContext();
    if (!pageData || !pageData.content) {
      throw new Error("Could not read page content. Try refreshing the page.");
    }

    const prompt = `You are Aura AI, a high-speed research assistant. 
    Analyze the following web page content and provide a high-level summary.
    Use this format:
    ### ⚡ Pulse Summary
    (2-3 sentences max)
    
    ### 🔑 Key Takeaways
    - (Point 1)
    - (Point 2)
    - (Point 3)
    
    ### 💡 Smart Insights
    (Optional interesting observation)

    Page Title: ${pageData.title}
    URL: ${pageData.url}
    Content: ${pageData.content.substring(0, 15000)} // Truncate to stay within limits if necessary
    `;

    const result = await callGemini(prompt);
    summaryOutput.innerHTML = formatAIResponse(result);
  } catch (err) {
    summaryOutput.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.innerText = "Generate Pulse Summary";
  }
});

// Chat Logic
async function handleChat() {
  const text = chatInput.value.trim();
  if (!text || sendBtn.disabled) return;

  addMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  
  sendBtn.disabled = true;
  const loadingMsg = addMessage('Aura is thinking...', 'ai', true);

  try {
    const pageData = await getPageContext();
    let prompt = `User question: ${text}`;
    
    if (pageData && pageData.content) {
      prompt = `Context of the web page the user is currently looking at:
      Title: ${pageData.title}
      Content Snippet: ${pageData.content.substring(0, 10000)}
      
      User Question: ${text}
      
      Respond as Aura AI, helpful and concise.`;
    }

    const result = await callGemini(prompt);
    updateAiMessage(loadingMsg, result);
  } catch (err) {
    updateAiMessage(loadingMsg, `Sorry, I encountered an error: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleChat();
  }
});

// UI Helpers
function formatAIResponse(text) {
  // Simple markdown-to-html converter for cleaner display
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function addMessage(text, role, isLoading = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  msgDiv.innerHTML = `<div class="bubble">${isLoading ? text : formatAIResponse(text)}</div>`;
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return msgDiv;
}

function updateAiMessage(msgDiv, text) {
  msgDiv.querySelector('.bubble').innerHTML = formatAIResponse(text);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Auto-expand textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

init();
