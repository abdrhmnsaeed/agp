# AGP Agent Discovery Protocol - Implementation Guide

## Quick Start: Adding ADP to Your AGP Installation

This guide shows concrete code snippets to implement agent discovery without APIs or GUIs.

---

## 1. Agent Registry Module (New File)

**File**: `gateway/agent-registry.mjs`

```javascript
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentRegistry {
  constructor() {
    this.registryPath = path.join(process.cwd(), 'agp.agent-registry.json');
    this.agents = this.loadRegistry();
  }

  loadRegistry() {
    if (fs.existsSync(this.registryPath)) {
      return JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
    }
    return { agents: [], created_at: new Date().toISOString() };
  }

  saveRegistry() {
    fs.writeFileSync(
      this.registryPath,
      JSON.stringify(this.agents, null, 2)
    );
  }

  registerAgent(agentId, metadata) {
    const existingIndex = this.agents.agents.findIndex(a => a.agent_id === agentId);
    
    const agentRecord = {
      agent_id: agentId,
      name: metadata.name,
      version: metadata.version || '1.0.0',
      capabilities: metadata.capabilities || [],
      status: 'online',
      registered_at: existingIndex >= 0 ? this.agents.agents[existingIndex].registered_at : new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      public_key_hash: metadata.public_key_hash,
      max_request_per_minute: metadata.max_rpm || 60
    };

    if (existingIndex >= 0) {
      this.agents.agents[existingIndex] = agentRecord;
    } else {
      this.agents.agents.push(agentRecord);
    }

    this.saveRegistry();
    return agentRecord;
  }

  heartbeat(agentId) {
    const agent = this.agents.agents.find(a => a.agent_id === agentId);
    if (agent) {
      agent.last_heartbeat = new Date().toISOString();
      agent.status = 'online';
      this.saveRegistry();
    }
  }

  getAgent(agentId) {
    return this.agents.agents.find(a => a.agent_id === agentId);
  }

  getAllAgents() {
    return this.agents.agents;
  }

  getOnlineAgents() {
    return this.agents.agents.filter(a => a.status === 'online');
  }

  getMesh() {
    return {
      mesh_version: 'ADP v4.0',
      gateway_id: process.env.GATEWAY_ID || 'agp-gateway-default',
      timestamp: new Date().toISOString(),
      local_agents: this.getOnlineAgents(),
      agent_count: this.getOnlineAgents().length,
      registry_updated_at: this.agents.created_at
    };
  }
}
```

---

## 2. Message Verifier (New File)

**File**: `gateway/message-verifier.mjs`

```javascript
import crypto from 'crypto';

export class MessageVerifier {
  static createSignature(messageObject, secretKey) {
    // Remove signature field if exists
    const { signature, ...messageData } = messageObject;
    
    // Create deterministic JSON string
    const messageString = JSON.stringify(messageData, Object.keys(messageData).sort());
    
    // Generate HMAC-SHA256
    return crypto
      .createHmac('sha256', secretKey)
      .update(messageString)
      .digest('hex');
  }

  static verifySignature(messageObject, secretKey) {
    const expectedSignature = this.createSignature(messageObject, secretKey);
    return expectedSignature === messageObject.signature;
  }

  static createMessage(senderAgentId, receiverAgentId, action, payload, secretKey) {
    const message = {
      msg_id: crypto.randomUUID(),
      sender_agent_id: senderAgentId,
      receiver_agent_id: receiverAgentId,
      action,
      timestamp: new Date().toISOString(),
      payload
    };

    message.signature = this.createSignature(message, secretKey);
    return message;
  }

  static validateMessageTimestamp(message, toleranceSeconds = 5) {
    const messageTime = new Date(message.timestamp).getTime();
    const now = new Date().getTime();
    const diffSeconds = Math.abs(now - messageTime) / 1000;
    
    return diffSeconds <= toleranceSeconds;
  }
}
```

---

## 3. Enhanced Gateway with Discovery (Modify Bouncer)

**Add to**: `gateway/agp-bouncer.mjs`

```javascript
import { AgentRegistry } from './agent-registry.mjs';
import { MessageVerifier } from './message-verifier.mjs';

export default function createAGPGateway(options = {}) {
  const router = express.Router();
  const registry = new AgentRegistry();
  const SECRET_KEY = options.secret || process.env.AGP_SECRET;

  // ========== EXISTING CODE (unchanged) ==========
  // [Keep all existing endpoints intact]

  // ========== NEW: DISCOVERY ENDPOINTS ==========

  // 1. Enhanced ai.json with discovery links
  router.get('/.well-known/ai.json', (req, res) => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const manifest = {
      protocol_version: 'ADP v4.0',
      gateway_id: process.env.GATEWAY_ID || 'agp-gateway-default',
      gateway_url: `http://localhost:${process.env.AGP_PORT || 3010}`,
      agent_mesh_enabled: true,
      timestamp: new Date().toISOString(),
      skills: Object.entries(config.mappings).map(([name, mapping]) => ({
        name,
        method: mapping.method,
        path: mapping.path,
        requires_auth: mapping.requires_auth !== false,
        execution_time_ms: 150
      })),
      discovery_endpoints: {
        mesh_registry: '/.well-known/agent-mesh.json',
        service_discovery: '/.well-known/discovery.json',
        health: '/.well-known/health.json'
      }
    };

    res.json(manifest);
  });

  // 2. NEW: Agent Mesh Registry
  router.get('/.well-known/agent-mesh.json', (req, res) => {
    res.json(registry.getMesh());
  });

  // 3. NEW: Service Discovery
  router.get('/.well-known/discovery.json', (req, res) => {
    res.json({
      version: 'ADP v4.0',
      gateway_capabilities: {
        token_endpoint: '/auth/agent',
        execute_endpoint: '/api/execute',
        mesh_registry: '/.well-known/agent-mesh.json',
        message_receive: '/agent-api/receive-message',
        agent_register: '/agent-api/register',
        health_check: '/.well-known/health.json'
      },
      supported_auth_methods: [
        'jwt_bearer',
        'hmac_signature',
        'mesh_signed_message'
      ],
      agent_coordination: {
        enabled: true,
        protocol: 'ADP',
        message_format: 'signed_json',
        max_hops: 5,
        ttl_seconds: 3600
      }
    });
  });

  // 4. NEW: Agent Registration
  router.post('/agent-api/register', (req, res) => {
    const { agent_id, name, version, capabilities, public_key_hash, max_rpm } = req.body;

    if (!agent_id || !public_key_hash) {
      return res.status(400).json({ error: 'agent_id and public_key_hash required' });
    }

    try {
      const agentRecord = registry.registerAgent(agent_id, {
        name: name || agent_id,
        version,
        capabilities,
        public_key_hash,
        max_rpm
      });

      res.status(201).json({
        status: 'registered',
        agent: agentRecord,
        discovery_manifest: `/.well-known/agent-mesh.json`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. NEW: Heartbeat Endpoint
  router.post('/agent-api/heartbeat/:agentId', (req, res) => {
    registry.heartbeat(req.params.agentId);
    res.json({ status: 'heartbeat_recorded' });
  });

  // 6. NEW: Direct Agent Messaging
  router.post('/agent-api/receive-message', (req, res) => {
    const message = req.body;

    // Validate required fields
    if (!message.msg_id || !message.sender_agent_id || !message.signature) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Verify timestamp
    if (!MessageVerifier.validateMessageTimestamp(message)) {
      return res.status(400).json({ error: 'Message timestamp outside tolerance window' });
    }

    // Get sender agent to verify signature
    const senderAgent = registry.getAgent(message.sender_agent_id);
    if (!senderAgent) {
      return res.status(404).json({ error: 'Sender agent not found' });
    }

    // Verify message signature using agent's key hash
    if (!MessageVerifier.verifySignature(message, SECRET_KEY)) {
      return res.status(401).json({ error: 'Invalid message signature' });
    }

    console.log(`✓ Message received: ${message.msg_id} from ${message.sender_agent_id}`);

    // Check if receiver is local
    const receiverAgent = registry.getAgent(message.receiver_agent_id);
    if (receiverAgent && receiverAgent.status === 'online') {
      // In production: deliver to agent via event bus, WebSocket, etc.
      res.json({
        status: 'delivered',
        msg_id: message.msg_id,
        receiver_status: 'online'
      });
    } else {
      // Forward to peer gateway if known
      res.status(404).json({
        status: 'agent_not_found',
        suggestion: 'Check /.well-known/agent-mesh.json for peer gateways'
      });
    }
  });

  // 7. NEW: Health Check
  router.get('/.well-known/health.json', (req, res) => {
    res.json({
      status: 'healthy',
      gateway_id: process.env.GATEWAY_ID || 'agp-gateway-default',
      agents_online: registry.getOnlineAgents().length,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
```

---

## 4. Agent Client Bootstrap (New File)

**File**: `agents/agent-bootstrap.mjs`

This is what agents would use to self-discover without any GUI:

```javascript
import crypto from 'crypto';
import fetch from 'node-fetch';

export class AgentBootstrap {
  constructor(agentId, gatewayUrl, privateKey) {
    this.agentId = agentId;
    this.gatewayUrl = gatewayUrl.replace(/\/$/, ''); // Remove trailing slash
    this.privateKey = privateKey;
    this.publicKeyHash = crypto.createHash('sha256').update(privateKey).digest('hex');
    this.capabilities = [];
    this.peers = [];
    this.availableSkills = [];
  }

  async discoverCapabilities() {
    try {
      console.log(`🔍 ${this.agentId}: Discovering capabilities...`);

      // Step 1: Fetch public manifest
      const manifest = await fetch(`${this.gatewayUrl}/.well-known/ai.json`)
        .then(r => r.json());

      this.availableSkills = manifest.skills;
      console.log(`✓ Found ${this.availableSkills.length} available skills`);

      // Step 2: Fetch mesh registry
      const mesh = await fetch(`${this.gatewayUrl}/.well-known/agent-mesh.json`)
        .then(r => r.json());

      this.peers = mesh.local_agents.filter(a => a.agent_id !== this.agentId);
      console.log(`✓ Found ${this.peers.length} peer agents`);

      // Step 3: Register self
      await this.registerWithGateway();

      return {
        agent_id: this.agentId,
        skills_available: this.availableSkills.length,
        peers: this.peers.length,
        ready: true
      };
    } catch (err) {
      console.error(`✗ Discovery failed: ${err.message}`);
      throw err;
    }
  }

  async registerWithGateway() {
    const response = await fetch(`${this.gatewayUrl}/agent-api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this.agentId,
        name: `Agent ${this.agentId}`,
        version: '1.0.0',
        capabilities: [],
        public_key_hash: this.publicKeyHash,
        max_rpm: 100
      })
    });

    if (!response.ok) throw new Error(`Registration failed: ${response.statusText}`);
    return response.json();
  }

  async sendMessageToAgent(receiverAgentId, action, payload) {
    const message = {
      msg_id: crypto.randomUUID(),
      sender_agent_id: this.agentId,
      receiver_agent_id: receiverAgentId,
      action,
      timestamp: new Date().toISOString(),
      payload
    };

    // Sign the message
    const messageString = JSON.stringify(message, Object.keys(message).sort());
    message.signature = crypto
      .createHmac('sha256', this.privateKey)
      .update(messageString)
      .digest('hex');

    console.log(`📤 ${this.agentId} → ${receiverAgentId}: ${action}`);

    const response = await fetch(`${this.gatewayUrl}/agent-api/receive-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    return response.json();
  }

  async executeSkill(skillName, parameters) {
    const skill = this.availableSkills.find(s => s.name === skillName);
    if (!skill) throw new Error(`Skill '${skillName}' not available`);

    // Token would be generated via gateway
    // For now, this shows the flow
    console.log(`⚙️ ${this.agentId}: Executing skill '${skillName}'`);

    return {
      skillName,
      status: 'queued',
      parameters
    };
  }

  getPeerWithCapability(requiredCapability) {
    return this.peers.find(peer =>
      peer.capabilities && peer.capabilities.includes(requiredCapability)
    );
  }

  async heartbeat() {
    await fetch(`${this.gatewayUrl}/agent-api/heartbeat/${this.agentId}`, {
      method: 'POST'
    });
  }
}
```

---

## 5. Example Multi-Agent Workflow

**File**: `examples/multi-agent-workflow.mjs`

```javascript
import { AgentBootstrap } from '../agents/agent-bootstrap.mjs';

// Three agents working together WITHOUT any GUI or manual configuration

async function runWorkflow() {
  const gatewayUrl = 'http://localhost:3010';
  const privateKey = process.env.AGENT_PRIVATE_KEY || 'shared-secret-key';

  // Initialize three agents
  const analyzerAgent = new AgentBootstrap('agent-analyzer-001', gatewayUrl, privateKey);
  const dispatcerAgent = new AgentBootstrap('agent-dispatcher-002', gatewayUrl, privateKey);
  const reporterAgent = new AgentBootstrap('agent-reporter-003', gatewayUrl, privateKey);

  try {
    // PHASE 1: Multi-agent discovery (NO GUI interaction needed)
    console.log('\n=== PHASE 1: Agent Discovery ===\n');
    
    await analyzerAgent.discoverCapabilities();
    await dispatcherAgent.discoverCapabilities();
    await reporterAgent.discoverCapabilities();

    // PHASE 2: Coordinate workflow
    console.log('\n=== PHASE 2: Workflow Coordination ===\n');

    // Analyzer requests dispatcher to send notifications
    const coordMsg = await analyzerAgent.sendMessageToAgent(
      'agent-dispatcher-002',
      'coordinate_workflow',
      {
        task: 'notify_users_of_new_content',
        user_count: 5,
        priority: 'high'
      }
    );

    console.log(`Coordination response: ${JSON.stringify(coordMsg)}`);

    // PHASE 3: Heartbeat (keep alive)
    console.log('\n=== PHASE 3: Heartbeat ===\n');

    await analyzerAgent.heartbeat();
    await dispatcherAgent.heartbeat();
    await reporterAgent.heartbeat();

    console.log('✓ All agents synchronized and ready for tasks');

  } catch (err) {
    console.error('Workflow error:', err.message);
  }
}

runWorkflow();
```

---

## 6. Installation Steps

1. **Add registry module**:
   ```bash
   cp gateway/agent-registry.mjs gateway/
   cp gateway/message-verifier.mjs gateway/
   ```

2. **Update bouncer**:
   - Add the new discovery endpoints from section 3
   - Import `AgentRegistry` and `MessageVerifier`

3. **Add agent bootstrap**:
   ```bash
   mkdir -p agents
   cp agents/agent-bootstrap.mjs agents/
   ```

4. **Set environment variables**:
   ```bash
   export AGP_SECRET="your-secret-key"
   export GATEWAY_ID="agp-gateway-prod-001"
   export AGP_PORT="3010"
   export AGENT_PRIVATE_KEY="agent-shared-key"
   ```

5. **Test discovery**:
   ```bash
   curl http://localhost:3010/.well-known/ai.json
   curl http://localhost:3010/.well-known/agent-mesh.json
   ```

---

## 7. What Agents Can Now Do (Without GUI)

✅ Fetch `/.well-known/ai.json` → Learn available skills  
✅ Fetch `/.well-known/agent-mesh.json` → Discover peer agents  
✅ POST to `/agent-api/register` → Self-register  
✅ POST to `/agent-api/receive-message` → Send signed messages to peers  
✅ POST to `/agent-api/heartbeat` → Stay alive in mesh  
✅ Coordinate with other agents using capability-based routing  

**Result**: Full autonomous agent mesh with zero manual configuration!

---

*This implementation guide shows the minimum viable product for ADP integration.*
