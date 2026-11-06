# ForceLens — Salesforce Record Access Explainer

> **Open & Free Edition** | Chrome Extension (Manifest V3) | React + TypeScript + Vite

**ForceLens** is an evidence-backed browser companion designed for Salesforce administrators, developers, consultants, and support teams. Embedded right alongside Salesforce Lightning in the Chrome Side Panel or popup, ForceLens explains why a selected Salesforce user can or cannot view, edit, or delete a particular record, object, or field.

---

## 🌟 Key Features

1. **Context-Aware Record Detection**
   - Automatically detects current Lightning record URLs (`/lightning/r/{ObjectApiName}/{RecordId}/view`, edit, and related views).
   - Supports manual record ID and object override for flexibility.

2. **Target User Selection**
   - Search active Salesforce users by Name, Username, Email, or User ID.
   - Inspects access from the perspective of the target user without impersonating their session.

3. **Multi-Dimensional Access Analysis**
   - **Record-Level Access**: Queries `UserRecordAccess` for `HasReadAccess`, `HasEditAccess`, `HasDeleteAccess`, `HasTransferAccess`, `HasAllAccess`, and `MaxAccessLevel`.
   - **Object-Level CRUD**: Evaluates Profile and assigned Permission Sets to compute effective Read, Create, Edit, Delete, View All, and Modify All permissions.
   - **Field-Level Security (FLS)**: Evaluates permissionable and standard fields, clearly distinguishing readable vs editable fields.
   - **Sharing Evidence & Grant Paths**: Inspects Record Ownership (`OwnerId`), explicit share table rows (e.g. `AccountShare`, `CaseShare`, or custom object `__Share`), and recursively resolves Public Group and Role hierarchy memberships.

4. **Evidence Taxonomy & Known Limitations**
   - Categorizes every finding into **Confirmed**, **Supported**, **Possible**, **Unavailable**, or **Unknown**.
   - Explicitly documents platform boundaries (e.g. Organization-Wide Defaults requiring Metadata/Tooling API, runtime Restriction Rules, and Dynamic Forms component filters) rather than making false inferences.

5. **Diagnostic Summary Export**
   - Generate copyable Markdown or JSON diagnostic reports with a single click.
   - Strict security: Access tokens, refresh tokens, and credentials are never included in exported logs or reports.

6. **Interactive Demo / Sample Mode**
   - Built-in offline demo mode loaded with a realistic Case record, user permissions, and sharing rules so you can explore ForceLens immediately even before connecting to a live Salesforce org.

---

## 🔒 Security & Privacy Architecture

- **OAuth 2.0 with PKCE (Proof Key for Code Exchange)**: Cryptographically secure authorization flow via `chrome.identity.launchWebAuthFlow`. No client secret is ever required, stored, or shipped.
- **Read-Only Operation**: ForceLens never modifies org metadata, user permissions, records, or sharing configurations.
- **Token Isolation**: OAuth tokens remain strictly inside extension-controlled storage (`chrome.storage.local` / `session`). Tokens are **never** injected into the Salesforce DOM, content scripts, or telemetry.
- **Least-Privilege Scopes**: Requests only standard read/query scopes (`api`, `id`, `web`, `refresh_token`).

---

## 🚀 Quick Start / Developer Installation

### 1. Build the Extension
```bash
# Clone the repository
git clone https://github.com/VinayVelliboinaSFDev/ForceLense.git
cd ForceLense

# Install dependencies
npm install

# Run automated tests
npm test

# Build production bundle
npm run build
```

### 2. Load Unpacked in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `dist/` directory inside this project folder (`/Users/vinayvelliboina/Documents/ForceLense/dist`).
5. Pin the **ForceLens** icon to your Chrome toolbar.

---

## ⚙️ Salesforce External Client App Setup

To connect to your live Salesforce org:

1. In Salesforce Setup, go to **App Manager** (or **External Client App Manager**).
2. Create a new **Connected App** or **External Client App**:
   - **App Name**: `ForceLens Chrome Extension`
   - **Contact Email**: your email
   - **Enable OAuth Settings**: Checked
   - **Callback URL (Redirect URI)**:
     ```
     https://<your-extension-id>.chromiumapp.org/oauth
     ```
     *(You can find and copy your exact Redirect URI directly in ForceLens under **Settings** ⚙️)*
   - **Selected OAuth Scopes**:
     - Access the Salesforce API (`api`)
     - Perform requests at any time (`refresh_token, offline_access`)
     - Access unique user identifiers (`id`)
     - Access your basic information (`web`)
   - **Require Proof Key for Code Exchange (PKCE)**: Checked / Supported
3. Copy the **Consumer Key (Client ID)**.
4. In ForceLens, click **Connect** or **Settings** (⚙️), paste your **Consumer Key**, and select **Production/Developer Edition** or **Sandbox**.

---

## 📁 Project Structure

```
ForceLense/
├── dist/                  # Production-ready Chrome MV3 unpacked extension
├── public/
│   ├── manifest.json      # Manifest V3 configuration
│   └── icons/             # 16x16, 32x32, 48x48, 128x128 icons
├── src/
│   ├── analyzers/         # Access analysis orchestration & evidence engines
│   │   ├── record-access.ts
│   │   ├── object-permissions.ts
│   │   ├── field-permissions.ts
│   │   ├── sharing-evidence.ts
│   │   └── orchestrator.ts
│   ├── auth/              # OAuth 2.0 PKCE & secure token store
│   │   ├── pkce.ts
│   │   ├── oauth.ts
│   │   └── token-store.ts
│   ├── background/        # MV3 Background service worker
│   │   └── service-worker.ts
│   ├── components/        # Reusable React components & modals
│   ├── content/           # Content script & Lightning record detector
│   │   ├── content.ts
│   │   └── record-detector.ts
│   ├── popup/             # Extension toolbar popup
│   ├── salesforce/        # Salesforce REST API client & SOQL queries
│   ├── sidepanel/         # Side Panel primary workflow application
│   ├── styles/            # Tailwind CSS and global styling
│   └── types/             # Normalized schemas & data models
├── tests/                 # Vitest automated test suite
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vite.content.config.ts
```

---

## 🧪 Testing

```bash
# Run unit and integration test suite
npm test
```

---

## 📄 License & Open-Source

ForceLens is open and free to use under the MIT License.
