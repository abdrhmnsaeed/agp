# AGP System Architectural Analysis & Agent Discovery Framework

## Executive Summary

The **Agent Gateway Protocol (AGP)** implements a sophisticated zero-trust security model for autonomous agents. This document provides a comprehensive architectural analysis, identifies optimization opportunities, and proposes an **Agent Discovery Protocol (ADP)** that enables peer-to-peer agent communication without requiring traditional APIs or GUIs.

---

## 1. Current Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ECOSYSTEM                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Agent A    │  │   Agent B    │  │   Agent C    │          │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘          │
│          │                  │                  │                 │
│          └──────────────────┼──────────────────┘                 │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │   AGP Gateway      │                        │
│                   │  (agp-bouncer)     │                        │
│                   │                    │                        │
│                   │ • Token Validation │                        │
│                   │ • HMAC Signing     │                        │
│                   │ • Request Relay    │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          │                  │                  │                │
│   ┌──────▼────┐      ┌──────▼────┐      ┌──────▼────┐         │
│   │ Microserv │      │ Microserv │      │ Microserv │         │
│   │    A      │      │    B      │      │    C      │         │
│   └───────────┘      └───────────┘      └───────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Trust Flow

```
Agent → Authorized Token (JWT) → AGP Gateway → HMAC Signature → Backend
         ↓
    x-agp-userid
    x-agp-signature
         ↓
    Backend verifies signature against shared SECRET_KEY
```

### 1.3 Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Discovery** | Gemini 3 Flash LLM | Auto-scans backend code |
| **Authentication** | HMAC-SHA256 | Cryptographic handshake |
| **Token Management** | JWT | Scoped authorization |
| **Configuration** | agp.config.json | Skill-to-endpoint mapping |
| **Public Manifest** | /.well-known/ai.json | Machine-readable capabilities |
| **Obfuscation** | javascript-obfuscator | Security relay protection |

---

## 2. Current Strengths

✅ **Zero-Trust Architecture**: No session state needed on client side.
✅ **Auto-Discovery**: LLM-powered endpoint detection eliminates manual configuration.
✅ **Framework Agnostic**: Works with Express, Fastify, any middleware-based framework.
✅ **Cryptographic Verification**: HMAC-SHA256 provides strong authenticity guarantees.
✅ **Scoped Permissions**: JWTs restrict agent capabilities by action.
✅ **Seamless Integration**: Express middleware injection requires minimal code changes.
✅ **Public Manifest**: /.well-known/ai.json enables agent discoverability.

---

## 3. Critical Improvements Needed

### 3.1 **Agent Registration & Metadata Storage**
**Current Gap**: Agents require manual token generation via UI handshake.

**Recommendation**:
```javascript
// Add a persistent agent registry
// agp.registry.json or database
{
  "agents": [
    {
      "id": "agent-uuid",
      "name": "Content Analyzer",
      "version": "1.0.0",
      "capabilities": ["getPosts", "getUserPosts"],
      "created_at": "2026-05-02T10:00:00Z",
      "key_hash": "sha256:abc123...",
      "last_seen": "2026-05-02T10:15:00Z",
      "status": "active"
    }
  ]
}
```

### 3.2 **HMAC Key Rotation**
**Current Gap**: Single static SECRET_KEY creates vulnerability if compromised.

**Recommendation**:
```javascript
// Implement key versioning
{
  "secrets": [
    {
      "version": 2,
      "key": "new-key-2026",
      "active": true,
      "created_at": "2026-05-02T00:00:00Z"
    },
    {
      "version": 1,
      "key": "old-key-2026",
      "active": false,
      "created_at": "2026-04-02T00:00:00Z"
    }
  ]
}
```

### 3.3 **Audit Logging**
**Current Gap**: No centralized request logging for compliance.

**Recommendation**: Add middleware to log:
- Agent ID
- Action executed
- Parameters (sanitized)
- Response status
- Timestamp
- IP address

### 3.4 **Rate Limiting per Agent**
**Current Gap**: No protection against abuse by rogue agents.

**Recommendation**: Implement quota system:
```javascript
{
  "quotas": [
    {
      "agent_id": "agent-uuid",
      "requests_per_minute": 60,
      "requests_per_hour": 1000,
      "burst_allowed": 10
    }
  ]
}
```

### 3.5 **Device Trust Fingerprinting**
**Current Gap**: Tokens don't validate source environment.

**Recommendation**: Add optional device context to signature:
```javascript
const signatureData = userId + "|" + deviceFingerprint + "|" + timestamp;
const signature = crypto.createHmac('sha256', SECRET_KEY).update(signatureData).digest('hex');
```

---

## 4. Agent Discovery Protocol (ADP): Zero-API Communication

### 4.1 Problem Statement

Current limitations:
- Agents must know the Gateway endpoint in advance
- Manual integration required for each agent
- No standard way for agents to discover each other's capabilities
- GUI-based consent flow breaks autonomous workflows

**Solution**: Implement a **mesh-based discovery protocol** where agents communicate through standardized, discoverable interfaces.

### 4.2 Agent Discovery Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              AGENT MESH DISCOVERY PROTOCOL (ADP)                │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           Discovery Layer (/.well-known/*)               │ │
│  │                                                            │ │
│  │  /ai.json          → Skill capabilities                  │ │
│  │  /agent-mesh.json  → Peer registry (NEW)                 │ │
│  │  /discovery.json   → Service location (NEW)              │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                           ▲                                     │
│                    Self-Discovery                              │
│                    (No Auth Required)                          │
│                           │                                     │
│  ┌───────────────────────┴────────────────────────────────┐   │
│  │                                                        │   │
│  │   ┌──────────────┐      ┌──────────────┐             │   │
│  │   │  Gateway A   │◄────►│  Gateway B   │             │   │
│  │   │              │      │              │             │   │
│  │   │ Agent Pool   │      │ Agent Pool   │             │   │
│  │   │   A1, A2     │      │   B1, B2     │             │   │
│  │   └──────────────┘      └──────────────┘             │   │
│  │          ▲                      ▲                     │   │
│  │          │                      │                     │   │
│  │   Direct Agent Coord            │                     │   │
│  │   (Signed Messages)             │                     │   │
│  │                                 │                     │   │
│  │   ┌──────────────┐      ┌──────────────┐             │   │
│  │   │  Gateway C   │◄────►│ Message Bus  │             │   │
│  │   │              │      │  (Optional)  │             │   │
│  │   │ Agent Pool   │      │              │             │   │
│  │   │   C1, C2     │      └──────────────┘             │   │
│  │   └──────────────┘                                   │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Implementation: Discovery Manifest Files

#### 4.3.1 Enhanced `/.well-known/ai.json` (Public Discovery)
```json
{
  "protocol_version": "ADP v4.0",
  "gateway_id": "gateway-uuid-12345",
  "gateway_url": "http://localhost:3010",
  "agent_mesh_enabled": true,
  "timestamp": "2026-05-02T10:00:00Z",
  "skills": [
    {
      "name": "createPost",
      "method": "POST",
      "path": "/api/posts/",
      "parameters": ["title", "category", "description"],
      "requires_auth": true,
      "execution_time_ms": 145,
      "rate_limit_rpm": 60
    }
  ],
  "discovery_endpoints": {
    "mesh_registry": "/.well-known/agent-mesh.json",
    "peer_discovery": "/.well-known/discovery.json",
    "health": "/.well-known/health.json"
  }
}
```

#### 4.3.2 New `/.well-known/agent-mesh.json` (Peer Registry)
```json
{
  "mesh_version": "ADP v4.0",
  "gateway_id": "gateway-uuid-12345",
  "local_agents": [
    {
      "agent_id": "agent-analyzer-001",
      "name": "Content Analyzer",
      "version": "1.0.0",
      "capabilities": ["analyzePosts", "categorizeContent"],
      "status": "online",
      "uptime_seconds": 3600,
      "last_heartbeat": "2026-05-02T10:15:32Z",
      "mesh_protocol_version": "ADP v4.0"
    },
    {
      "agent_id": "agent-bot-002",
      "name": "Notification Dispatcher",
      "version": "2.1.0",
      "capabilities": ["sendNotification", "getUserPreferences"],
      "status": "online",
      "uptime_seconds": 7200,
      "last_heartbeat": "2026-05-02T10:15:29Z",
      "mesh_protocol_version": "ADP v4.0"
    }
  ],
  "peer_gateways": [
    {
      "gateway_id": "gateway-uuid-67890",
      "url": "http://peer-gateway.internal:3010",
      "agents_count": 3,
      "last_sync": "2026-05-02T10:15:00Z",
      "is_trusted": true,
      "trust_level": "verified"
    }
  ]
}
```

#### 4.3.3 New `/.well-known/discovery.json` (Service Location)
```json
{
  "version": "ADP v4.0",
  "Gateway_capabilities": {
    "token_endpoint": "/auth/agent",
    "execute_endpoint": "/api/execute",
    "mesh_registry": "/.well-known/agent-mesh.json",
    "health_check": "/.well-known/health.json"
  },
  "supported_auth_methods": [
    "jwt_bearer",
    "hmac_signature",
    "mesh_signed_message"
  ],
  "agent_coordination": {
    "enabled": true,
    "protocol": "ADP",
    "message_format": "signed_json",
    "max_hops": 5,
    "ttl_seconds": 3600
  }
}
```

---

## 5. Zero-API Agent Communication Protocol

### 5.1 Direct Agent-to-Agent Communication (No Gateway)

**Goal**: Agents can discover and communicate with each other directly through a standardized message format.

#### Message Format (Signed)
```json
{
  "msg_id": "uuid-12345",
  "sender_agent_id": "agent-analyzer-001",
  "receiver_agent_id": "agent-bot-002",
  "action": "coordinate_analysis",
  "timestamp": "2026-05-02T10:15:32.123Z",
  "payload": {
    "task": "analyze_posts_batch",
    "posts_ids": ["post1", "post2", "post3"],
    "context": { "priority": "high" }
  },
  "signature": "hmac-sha256-signature",
  "algorithm": "HMAC-SHA256"
}
```

#### Signature Generation (Agent-to-Agent)
```javascript
const messageString = JSON.stringify({
  msg_id,
  sender_agent_id,
  receiver_agent_id,
  action,
  timestamp,
  payload
});

const signature = crypto
  .createHmac('sha256', agent_private_key)
  .update(messageString)
  .digest('hex');

// Message verified by receiver using sender's public_key_hash
```

### 5.2 Agent Discovery Flow (No UI Required)

```
┌──────────────┐
│   Agent A    │
│  Startup     │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────┐
│ 1. Fetch /.well-known/ai.json          │
│    (Discovers local Gateway URL)       │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│ 2. Parse Gateway ID & Capabilities     │
│    (Learns available skills)           │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│ 3. Fetch /.well-known/agent-mesh.json  │
│    (Discovers peer agents)             │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│ 4. FOR EACH PEER AGENT:                │
│    - Extract agent_id & status         │
│    - Parse their capabilities          │
│    - Build capability map              │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│ 5. Agent A is NOW AWARE of:            │
│    - Local skills (via gateway)        │
│    - Peer agents & their skills        │
│    - Peer gateways (federation)        │
│    - Message routing paths             │
└────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 6. Agent A CAN NOW:                     │
│    ✓ Self-select needed capabilities    │
│    ✓ Coordinate with Agent B directly   │
│    ✓ Request capabilities it lacks      │
│    ✓ Trigger cascading workflows        │
│    ✓ ALL WITHOUT A GUI or Manual Auth   │
└──────────────────────────────────────────┘
```

### 5.3 Practical Example: Multi-Agent Workflow

**Scenario**: Three agents coordinate to process user content without any GUI or manual configuration.

#### Step 1: Agents Self-discover
```javascript
// agent-analyzer.mjs
class ContentAnalyzer {
  async bootstrap(gatewayUrl) {
    // Fetch public manifest
    const manifest = await fetch(`${gatewayUrl}/.well-known/ai.json`).then(r => r.json());
    const meshRegistry = await fetch(`${gatewayUrl}/.well-known/agent-mesh.json`).then(r => r.json());
    
    this.skills = manifest.skills;
    this.peers = meshRegistry.local_agents.filter(a => a.agent_id !== this.id);
    
    console.log(`✓ Discovered ${this.peers.length} peer agents`);
    // No auth prompt needed!
  }
}
```

#### Step 2: Direct Agent Coordination
```javascript
// Agent A → Agent B (Direct Message)
const coordinationMessage = {
  msg_id: crypto.randomUUID(),
  sender_agent_id: "agent-analyzer-001",
  receiver_agent_id: "agent-bot-002",
  action: "request_notification_capability",
  payload: {
    task: "notify_users_batch",
    user_ids: ["user1", "user2", "user3"]
  },
  timestamp: new Date().toISOString()
};

// Sign the message
const signature = crypto
  .createHmac('sha256', process.env.AGENT_PRIVATE_KEY)
  .update(JSON.stringify(coordinationMessage))
  .digest('hex');

coordinationMessage.signature = signature;

// Send to peer agent endpoint
const response = await fetch(
  `http://peer-gateway/agent-api/receive-message`,
  {
    method: 'POST',
    body: JSON.stringify(coordinationMessage),
    headers: { 'Content-Type': 'application/json' }
  }
);
```

#### Step 3: Capability-Driven Routing
```javascript
// Agent intelligently routes to available capability
class AgentOrchestrator {
  async executeWorkflow(task) {
    const requiredSkills = this.analyzeTask(task);
    
    for (const skill of requiredSkills) {
      // Check local skills
      if (this.hasSkill(skill)) {
        await this.executeLocally(skill);
      } 
      // Check peer agents
      else if (this.findPeerWithSkill(skill)) {
        const peer = this.findPeerWithSkill(skill);
        await this.sendToAgent(peer, { action: skill, task });
      }
      // Check peer gateways
      else if (this.findGatewayWithSkill(skill)) {
        const gateway = this.findGatewayWithSkill(skill);
        await this.requestViaGateway(gateway, { action: skill, task });
      }
    }
  }
}
```

---

## 6. Enhanced Security Model for Agent Mesh

### 6.1 Multi-Layered Trust Chain

```
Layer 1: Agent Identity
├─ Agent ID (UUID)
├─ Public Key Hash
└─ Registered Capabilities

Layer 2: Message Integrity  
├─ HMAC-SHA256 Signature
├─ Timestamp Validation (±5s)
└─ Message ID Deduplication

Layer 3: Gateway Verification
├─ X-AGP-Signature (to backend)
├─ X-AGP-UserId (agent context)
└─ Scoped JWT (capability limits)

Layer 4: Audit Trail
├─ Message Log
├─ Agent Interactions
└─ Compliance Records
```

### 6.2 Trust Bootstrap for New Peers

```javascript
// When peer gateway A encounters gateway B:

1. Fetch /.well-known/discovery.json from B
2. Verify B's certificate (if TLS)
3. Exchange gateway IDs and capabilities
4. Add to trusted_peers list (if whitelist mode)
5. Cache discovery info (ttl: 1 hour)
6. Establish bidirectional health check
```

---

## 7. Implementation Roadmap

### Phase 1: Agent Registry (Week 1-2)
- [ ] Create agent registration endpoint
- [ ] Store agent metadata (db or JSON)
- [ ] Implement agent lifecycle (register → online → offline)

### Phase 2: Enhanced Discovery (Week 2-3)
- [ ] Create `/.well-known/agent-mesh.json` endpoint
- [ ] Add agent heartbeat mechanism
- [ ] Implement peer gateway sync

### Phase 3: Direct Messaging (Week 3-4)
- [ ] Add `/agent-api/receive-message` endpoint
- [ ] Implement message signing & verification
- [ ] Add message routing logic

### Phase 4: Smart Orchestration (Week 4-5)
- [ ] Build capability-aware routing
- [ ] Implement fallback mechanisms
- [ ] Add cross-gateway federation

### Phase 5: Observability (Week 5-6)
- [ ] Centralized audit logging
- [ ] Agent coordination metrics
- [ ] Mesh topology visualization

---

## 8. Code Snippets: Enhanced AGP Implementation

### 8.1 Agent Mesh Registry (New Module)

```javascript
// gateway/agent-mesh-registry.mjs
import crypto from 'crypto';

export class AgentMeshRegistry {
  constructor() {
    this.agents = new Map();
    this.messageLog = [];
  }

  registerAgent(agentId, metadata) {
    this.agents.set(agentId, {
      ...metadata,
      registered_at: new Date(),
      last_heartbeat: new Date(),
      status: 'online'
    });
  }

  getAgentMesh() {
    return {
      mesh_version: 'ADP v4.0',
      timestamp: new Date().toISOString(),
      local_agents: Array.from(this.agents.values()),
      active_count: Array.from(this.agents.values()).filter(a => a.status === 'online').length
    };
  }

  verifyMessage(message) {
    const agent = this.agents.get(message.sender_agent_id);
    if (!agent) return false;

    // Reconstruct message without signature
    const { signature, ...msg } = message;
    const reconstructed = JSON.stringify(msg);

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', agent.public_key_hash)
      .update(reconstructed)
      .digest('hex');

    return expectedSig === signature;
  }

  logMessage(message) {
    this.messageLog.push({
      ...message,
      logged_at: new Date()
    });
  }
}
```

### 8.2 Enhanced Bouncer with Mesh Support

```javascript
// gateway/agp-bouncer-enhanced.mjs
import AgentMeshRegistry from './agent-mesh-registry.mjs';

export default function createAGPGateway(options = {}) {
  const router = express.Router();
  const meshRegistry = new AgentMeshRegistry();

  // Existing endpoints...

  // NEW: Agent mesh discovery
  router.get('/.well-known/agent-mesh.json', (req, res) => {
    res.json(meshRegistry.getAgentMesh());
  });

  // NEW: Receive direct agent messages
  router.post('/agent-api/receive-message', (req, res) => {
    const message = req.body;

    // Verify message signature
    if (!meshRegistry.verifyMessage(message)) {
      return res.status(401).json({ error: 'Invalid message signature' });
    }

    // Log message
    meshRegistry.logMessage(message);

    // Route to target agent if local
    const targetAgent = meshRegistry.agents.get(message.receiver_agent_id);
    if (targetAgent?.local) {
      // Deliver message to agent
      broadcastToAgent(message.receiver_agent_id, message);
      return res.json({ status: 'delivered' });
    }

    // Forward to peer gateway if known
    res.status(404).json({ error: 'Agent not found locally' });
  });

  return router;
}
```

---

## 9. Comparison: Traditional vs ADP Architecture

| Aspect | Traditional (API) | AGP with ADP |
|--------|-----------------|------------|
| **Agent Discovery** | Manual configuration | Automatic via /.well-known/ |
| **Authentication** | Each agent needs credential setup | Self-issued signed messages |
| **Peer Communication** | Through gateway only | Direct peer-to-peer |
| **Authorization** | Role-based (centralized) | Capability-based (distributed) |
| **Scalability** | Gateway is bottleneck | Mesh-based (N² connections possible) |
| **Discoverability** | No standard mechanism | Standardized JSON manifests |
| **Compliance Audit** | Difficult to trace multi-hop | Built-in message logging |
| **Latency** | 2 hops (agent → gateway → service) | 1 hop (agent → service) |

---

## 10. Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Rogue Agent** | Could impersonate trusted peer | Message signature verification + agent whitelist |
| **Message Replay** | Same action executed twice | Unique msg_id + timestamp deduplication |
| **Key Compromise** | All agent communication exposed | Key rotation + dual signing (backup key) |
| **Gateway SPOF** | Mesh breaks if gateway fails | Peer gateway redundancy + fallback routing |
| **DoS Attack** | Agent spammed with requests | Rate limiting per agent + circuit breaker |

---

## 11. Recommended Configuration

### 11.1 Production Setup

```json
{
  "agp_deployment": {
    "mode": "mesh",
    "security": {
      "key_rotation_days": 90,
      "message_timeout_seconds": 3600,
      "signature_algorithm": "HMAC-SHA256",
      "tls_required": true,
      "agent_whitelist_enabled": true
    },
    "rate_limiting": {
      "default_rpm": 100,
      "default_hourly": 5000,
      "trusted_agents_rpm": 1000
    },
    "audit": {
      "log_all_messages": true,
      "log_retention_days": 90,
      "compliance_mode": "strict"
    },
    "mesh": {
      "peer_sync_interval_seconds": 300,
      "health_check_interval_seconds": 60,
      "max_message_hops": 5,
      "federation_enabled": true
    }
  }
}
```

---

## 12. Conclusion

The **Agent Gateway Protocol with Agent Discovery Protocol (ADP)** transforms AGP from a reverse proxy into a **self-organizing agent mesh**. Key benefits:

🚀 **Zero Configuration**: Agents auto-discover capabilities  
🔐 **No GUI Required**: Fully autonomous operation  
📡 **Scalable Coordination**: Peer-to-peer reduces bottlenecks  
✅ **Built-in Compliance**: Messages are inherently auditable  
🔄 **Resilient**: Mesh topology provides redundancy  

This enables **true autonomous agent ecosystems** where AI systems operate as peers in a cryptographically-verified network—no APIs, no dashboards, no manual intervention.

---

## 13. Next Steps

1. **Implement Agent Registry**: Store agent metadata persistently
2. **Deploy Mesh Discovery**: Make peer agents discoverable
3. **Build Orchestration Layer**: Enable capability-aware routing
4. **Establish Trust Chain**: Multi-layered verification
5. **Monitor & Audit**: Comprehensive logging for compliance

---

*Document Version: 1.0.0*  
*Last Updated: 2026-05-02*  
*Protocol Version: ADP v4.0*
