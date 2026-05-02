# 🛡️ Agent Gateway Protocol (AGP)
### The Zero-Trust Infrastructure for Autonomous Agents

**AGP** is a framework-agnostic security layer designed to turn any backend codebase into a secure, agent-ready environment. It acts as a **Zero-Trust Reverse Proxy**, allowing AI agents to interact with your business logic via an authenticated "Trust Bridge" without ever exposing your primary security secrets to the client side.

---

## 🚀 Key Features

- **🧠 Smart Architectural Scanner**: Automatically maps your API endpoints and identifies which routes require authentication.
- **🛡️ Zero-Trust Handshake**: Uses HMAC-SHA256 signature verification (`X-AGP-Signature`) to ensure requests only come from authorized agents.
- **⚡ Surgical Auto-Patching**: Injects a native, zero-dependency Trust Bridge directly into your existing middleware.
- **📦 Framework Agnostic**: Works with Express, Fastify, and beyond.
- **🔒 Scrambled Engine**: The core security relay is obfuscated to protect your system's integrity and intellectual property.

---

## 🛠️ Installation

```bash
npm install agp-system
```

---

## 📖 Quick Start

### 1. Initialize your Project
Navigate to your project root and run the architect. It will scan your files and secure your authentication middleware automatically.

```bash
npx agp-system init 5000
```
*Note: Replace `5000` with the port your backend is running on.*

### 2. Start the Gateway
Launch the secure gateway to start relaying agent requests.

```bash
npx agp-system serve
```
The gateway will now be active at `http://localhost:3010`.

---

## 🔌 Integration (Scenario B)

If you prefer to embed the AGP Gateway directly into your existing Express application:

```javascript
import express from 'express';
import { agpGateway } from 'agp-system';

const app = express();

// Securely mount the Agent Gateway
app.use('/agent-api', agpGateway({
  secret: process.env.AGP_SECRET
}));

app.listen(3000);
```

---

## 📐 How it Works: The Trust Bridge

1. **Discovery**: The AGP Scanner identifies your `authMiddleware`.
2. **Patching**: It injects a native `crypto` block that checks for `X-AGP-Signature`.
3. **Handshake**: When an agent sends a request, the Gateway signs the `userId` using your shared `AGP_SECRET`.
4. **Validation**: Your backend verifies the signature. If it matches, the agent is granted the same permissions as a logged-in user—**without needing a standard session or password.**

---

## 🛡️ Security Policy

The core relay logic is obfuscated using `javascript-obfuscator` to prevent tampering and protect the protocol's signature generation logic. Only the public CLI and manifest generation tools remain in plain text to ensure architectural transparency.

---

## 📄 License

MIT © 2024 AGP Systems.
