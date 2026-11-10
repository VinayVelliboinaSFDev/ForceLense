# ForceLens — Salesforce Record Access Explainer & AI Security Copilot

> **Open & Free Edition** | Chrome Extension (Manifest V3) | React 19 + TypeScript + Vite + Tailwind CSS

**ForceLens** is an evidence-backed browser companion designed for Salesforce administrators, architects, developers, consultants, and security teams. Embedded directly alongside Salesforce Lightning in the Chrome Side Panel or popup, ForceLens explains **why a selected user can or cannot view, edit, or delete a particular record, object, or field** — with zero manual guesswork.

---

## 🌟 Key Capabilities

### 1. Instant Session Auto-Detection (Inspector-Style)
- Automatically detects and hooks into your active Salesforce session using `chrome.cookies` — **zero Connected App configuration needed**!
- Seamlessly falls back to OAuth 2.0 PKCE if you prefer custom External Client App keys.

### 2. Multi-Dimensional Access Analysis
- **Record-Level Access**: Queries `UserRecordAccess` for `HasReadAccess`, `HasEditAccess`, `HasDeleteAccess`, `HasTransferAccess`, and `MaxAccessLevel`.
- **Object-Level CRUD**: Evaluates Profile and assigned Permission Sets for effective Read, Create, Edit, Delete, View All, and Modify All permissions.
- **Sharing Evidence & Grant Paths**: Inspects Record Ownership (`OwnerId`), explicit share table rows (e.g. `AccountShare`, `CaseShare`, custom `__Share`), and recursively resolves Public Group and Role hierarchy memberships.
- **ControlledByParent & Master-Detail Traversal**: Automatically follows parent sharing for child records (e.g. `OpportunityLineItem` ➔ `Opportunity`, `CaseComment` ➔ `Case`).

### 3. User Access Diff Mode (Side-by-Side Comparison)
- *"Why can User A see this record, but User B cannot?"*
- Select User A and search any User B live in your org.
- Side-by-side comparative matrices for Record Access (`UserRecordAccess`), Object CRUD, and Sharing Provenance.
- **AI Access Discrepancy & Root Cause Summary**: Instant AI explanation of the exact structural divergence between the two users.

### 4. AI Security Copilot & Interactive Multi-Turn Chat
- Powered by a **Dual-Tier AI Architecture**:
  - **Tier 1 (Zero-Setup / Free)**: Chrome Built-in AI (Gemini Nano on-device) & 1-Click Launchers (ChatGPT, Claude, Copilot, Gemini).
  - **Tier 2 (Enterprise & Custom)**: Google Gemini API, OpenAI (BYOK), Anthropic Claude (BYOK), and Local Ollama (100% private, on-premise LLMs).
- **Rich Visual Output**:
  - 🎯 **Card 1: Executive Access Scorecard**: Clean visual table with status badges (`🟢 GRANTED`, `🔴 DENIED`).
  - ⛓️ **Card 2: Visual Provenance Chain**: Step-by-step breadcrumb flow tiles connecting User ➔ Group/Role ➔ Share Table ➔ Record Access.
  - ⚠️ **Card 3: Discrepancy & Blocker Callout**: Explains the exact intersection model blocker (e.g. Object CRUD is Edit, but Record Sharing is Read-only).
  - 🛠️ **Card 4: Administrator Remediation Tile**: Concrete, 2-step Salesforce Setup click-paths to resolve access issues.
- **Interactive Chat Conversation**: Chat with ForceLens Copilot, ask follow-up questions, and explore remediation options.
- **Tab Persistence**: Chat history and analysis states persist uninterrupted when switching between tabs in the extension.
- **Live Read-Only Salesforce Org Querying**: The AI Copilot can execute safe, read-only SOQL queries (`SELECT ...`) against your live Salesforce org to retrieve live context and verify security settings in real time!

---

## 🧠 AI Functionality Architecture & Workflow Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FORCELENS AI ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

 1. Verified Evidence Extraction (Zero Hallucination Grounding)
    ┌───────────────────────────┐     ┌───────────────────────────┐
    │  UserRecordAccess Flags   │     │   Profile & PermSet CRUD  │
    └─────────────┬─────────────┘     └─────────────┬─────────────┘
                  │                                 │
                  ▼                                 ▼
    ┌───────────────────────────┐     ┌───────────────────────────┐
    │  Share Table Rows & Owner │     │  Role & Group Memberships │
    └─────────────┬─────────────┘     └─────────────┬─────────────┘
                  │                                 │
                  └────────────────┬────────────────┘
                                   ▼
                ┌───────────────────────────────────────┐
                │   ai-prompt-generator.ts              │
                │   • Strips FLS for clean Record/CRUD  │
                │   • Formats 4 Structured Output Cards │
                │   • Formats Diff Prompts for User A/B │
                └──────────────────┬────────────────────┘
                                   │
 2. Provider Routing & Multi-Turn Dispatcher (ai-service.ts)
                                   ▼
          ┌───────────────────────────────────────────────────┐
          │                  executeAiChat()                  │
          │             (ai/ai-service.ts dispatcher)         │
          └───────┬──────────────┬─────────────┬──────────────┘
                  │              │             │
        ┌─────────┴────────┐     │     ┌───────┴──────────┐
        ▼                  ▼     ▼     ▼                  ▼
   Chrome Nano       Gemini API      Ollama (Local)     OpenAI / Claude
   (On-Device)       (Cloud BYOK)    (100% On-Premise)  (Cloud BYOK)

 3. Agentic Live Read-Only Salesforce Query Loop (AiExplainerTab.tsx)
                  │
                  ▼
          ┌───────────────────────────────────────────────────┐
          │ Model detects need for live org info              │
          │ Emits: [SALESFORCE_QUERY: SELECT ... FROM ...]    │
          └──────────────────┬────────────────────────────────┘
                             │
                             ▼
          ┌───────────────────────────────────────────────────┐
          │ soql-safety.ts Validator                          │
          │ • Enforces read-only SELECT (blocks DML/mutations)│
          │ • Enforces memory limits (max 50-100 rows)        │
          └──────────────────┬────────────────────────────────┘
                             │
                             ▼
          ┌───────────────────────────────────────────────────┐
          │ sfApi.query() executes via active session         │
          │ Returns real Salesforce org records               │
          └──────────────────┬────────────────────────────────┘
                             │
                             ▼
          ┌───────────────────────────────────────────────────┐
          │ Synthesizes final response with live org context  │
          │ Displays visual badge: 🔍 Queried Salesforce Org  │
          └──────────────────┬────────────────────────────────┘
                             │
 4. Rich Rendering & Interactive Conversation (RichAiResponseView.tsx)
                             ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ • Card 1: Executive Scorecard Table (🟢 GRANTED / 🔴 DENIED)          │
 │ • Card 2: Visual Provenance Flow (User ⬇️ Role/Group ⬇️ Share Row)   │
 │ • Card 3: Discrepancy & Blocker Callout Alert Box                     │
 │ • Card 4: Actionable Setup Click-Path Remediation Tile                │
 │ • Interactive Chat Input + Quick Suggestion Chips                     │
 │ • Tab-Persistent Conversation State (resets on user/record change)    │
 └───────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Privacy Commitments

- **100% Free & Open-Source**: No paywalls, no subscriptions, no tracking.
- **Read-Only Operation**: ForceLens never performs `INSERT`, `UPDATE`, `DELETE`, `DROP`, or `ALTER` operations. All queries are strictly validated.
- **Zero Token Leakage**: Tokens and secrets are isolated in memory and never shared with AI prompts, content scripts, or logs.
- **Local AI Privacy**: Supports local Ollama models (`llama3`, `mistral`, `codellama`) for air-gapped or HIPAA/SOC2 compliance requirements.

---

## 🚀 Developer Quick Start

### 1. Build the Extension
```bash
# Clone the repository
git clone https://github.com/VinayVelliboinaSFDev/ForceLense.git
cd ForceLense

# Install dependencies
npm install

# Run unit tests
npm test

# Build production bundle
npm run build
```

### 2. Load Unpacked in Google Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `dist/` directory inside this repository.
5. Open any Salesforce record and launch ForceLens from the Side Panel icon!

---

## 📁 Repository Structure

```
ForceLense/
├── dist/                      # Compiled Chrome MV3 extension bundle
├── public/
│   ├── manifest.json          # Chrome Manifest V3 configuration
│   └── icons/                 # Extension logos (16, 32, 48, 128)
├── src/
│   ├── ai/                    # AI Copilot engine, providers & stores
│   │   ├── ai-service.ts      # Multi-turn chat dispatcher (Gemini, Claude, GPT, Ollama, Chrome)
│   │   ├── ai-store.ts        # Persistent provider & API key settings
│   │   └── ai-types.ts        # ChatMessage, AiSettingsConfig, Provider types
│   ├── analyzers/             # Provenance & evidence analysis
│   │   ├── ai-prompt-generator.ts # Prompt engineering for single & diff analysis
│   │   ├── record-access.ts   # UserRecordAccess query & resolver
│   │   ├── object-permissions.ts # Profile & PermissionSet CRUD calculator
│   │   ├── sharing-evidence.ts# Share tables & role hierarchy traversal
│   │   └── orchestrator.ts    # Unified analysis orchestrator
│   ├── auth/                  # Session auto-detection & OAuth PKCE
│   │   ├── salesforce-session.ts # Cookie-based active session extractor
│   │   ├── oauth.ts           # Fallback PKCE OAuth 2.0 flow
│   │   └── token-store.ts     # Secure local token management
│   ├── components/            # React UI components
│   │   ├── AiExplainerTab.tsx # AI Copilot interactive chat & verdict tab
│   │   ├── UserDiffView.tsx   # User Diff Mode with AI Diff Summary
│   │   ├── RichAiResponseView.tsx # Card 1-4 markdown & visual scorecard renderer
│   │   └── Header.tsx, etc.
│   ├── salesforce/            # Salesforce REST API & safety
│   │   ├── api-client.ts      # Authenticated REST API & SOQL query client
│   │   └── soql-safety.ts     # Read-only SOQL validator & sanitizer
│   └── sidepanel/             # Side Panel main entrypoint
│       └── SidePanelApp.tsx   # Persistent tab container & root state
├── tests/                     # Vitest automated test suite (53 unit tests)
├── package.json
└── vite.config.ts
```

---

## 📄 License

ForceLens is open-source software licensed under the [MIT License](LICENSE).
