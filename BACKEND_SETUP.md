# serp-sum Backend Setup

Your serp-sum extension now uses a **backend server** to handle OpenAI API calls with your API key stored securely in `.env`.

## ✅ Setup Complete

The backend is configured and ready to run. Here's what was set up:

### Backend Server
- **Location**: `c:\Users\Paardhiv Reddy\serp-sum\server.js`
- **Framework**: Express.js
- **Port**: 3000 (localhost)
- **API Key Storage**: `.env` file (ignored by Git)

### Extension Updates
- Removed local API key storage requirement
- Removed settings modal for API key entry  
- Extension now calls `http://localhost:3000/api/chat` and `/api/explain`
- Both chat and text explanation work when server is running

## 🚀 How to Use

### 1. Start the Backend Server

Open a terminal in the root folder and run:

```bash
cd "c:\Users\Paardhiv Reddy\serp-sum"
npm start
```

**Output should show:**
```
✅ OpenAI API key loaded from .env
🚀 serp-sum backend server running at http://localhost:3000
   Chat: POST http://localhost:3000/api/chat
   Explain: POST http://localhost:3000/api/explain
   Health: GET http://localhost:3000/api/health
```

### 2. Load the Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Navigate to: `c:\Users\Paardhiv Reddy\serp-sum\serp-sum-v2\dist`
5. Select the `dist` folder

### 3. Use the Extension

- The extension will **only work when the server is running on localhost:3000**
- Chat and text explanations require the backend
- Knowledge tab works offline (stores responses locally)
- No API key entry needed in the UI anymore ✅

## 🔄 Development Mode

For easier development with auto-reload:

```bash
npm run dev
```

This uses `--watch` to restart the server when you make changes.

## 📝 Environment Variables

Your API key is in `.env`:
```
OPENAI_API_KEY=sk-proj-...
PORT=3000
```

**⚠️ Never commit `.env` to Git** — it's in `.gitignore`

## ✅ Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Chat with AI (requires messages array) |
| `/api/explain` | POST | Explain selected text |
| `/api/health` | GET | Check if server is running |

## 🐛 Troubleshooting

**"Failed to connect to localhost:3000"**
- Make sure the backend server is running (`npm start`)
- Check that port 3000 is available

**"API returned an empty response"**
- Check OpenAI API key in `.env` is valid
- Check your OpenAI account has credits/quota

**Extension not loading?**
- Hard refresh: `Ctrl+Shift+R` on the panel
- Reload the extension in `chrome://extensions/`

## 📚 Files Structure

```
serp-sum/
├── server.js                    # Backend server
├── .env                         # API key (not in Git)
├── package.json                 # Dependencies
├── serp-sum-v2/
│   ├── src/
│   │   ├── background/index.ts  # Updated: calls localhost:3000
│   │   ├── App.tsx              # Updated: removed API key UI
│   │   └── ...
│   └── dist/                    # Built extension (load this in Chrome)
```

---

**Summary**: Backend keeps your API key secure. Extension is lightweight and only needs the server running to function. Knowledge storage still works offline! ✅
