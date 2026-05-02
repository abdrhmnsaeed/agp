import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import crypto from 'crypto';

export default function createAGPGateway(options = {}) {
    const router = express.Router();
    
    // Support manual enterprise options OR environmental variables
    const SECRET_KEY = options.secret || process.env.AGP_SECRET;

    if (!SECRET_KEY) {
        console.warn(chalk.yellow('⚠️ [AGP Warning]: No AGP_SECRET provided. Requests will fail.'));
    }

    const configPath = path.join(process.cwd(), 'agp.config.json');
    if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`[AGP Proxy] ERROR: agp.config.json not found. Run 'npx agp-system init' first.`));
        return router;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // We must parse JSON bodies if the parent app hasn't already
    router.use(express.json());

    router.post('/execute', async (req, res) => {
        const { action, parameters } = req.body;
        const authHeader = req.headers.authorization;
        const skillMapping = config.mappings[action];

        if (!skillMapping) return res.status(404).json({ error: `Skill '${action}' not mapped.` });

        let userId = null;
        let signature = null;
        const isPublic = skillMapping.requires_auth === false;

        // 1. IF PRIVATE: Verify Agent Token & Sign the Trust Bridge
        if (!isPublic) {
            let userContext = null;
            if (authHeader) {
                try {
                    const token = authHeader.split(' ')[1];
                    userContext = jwt.verify(token, SECRET_KEY);
                    if (!userContext.scopes.includes(action)) {
                        return res.status(403).json({ error: "Insufficient scope." });
                    }
                } catch (err) {
                    return res.status(401).json({ error: "Invalid agent token." });
                }
            }

            if (!userContext) {
                return res.status(401).json({
                    error: "Unauthorized",
                    auth_url: `/auth/agent?scope=${action}` 
                });
            }

            userId = String(userContext.userId || 'anonymous-agent');
            signature = crypto.createHmac('sha256', SECRET_KEY).update(userId).digest('hex');
        }

        // 2. PROXY RELAY: Forward the request to the real backend
        try {
            const targetUrl = `${config.target_base}${skillMapping.path}`;
            console.log(chalk.cyan(`[AGP Relay] ${isPublic ? '🌐 PUBLIC' : '🔒 SECURE'} ${action} -> ${skillMapping.method} ${targetUrl}`));
            
            // Build headers dynamically based on security level
            const fetchHeaders = { 'Content-Type': 'application/json' };
            if (!isPublic) {
                fetchHeaders['X-AGP-UserId'] = userId;
                fetchHeaders['X-AGP-Signature'] = signature;
            }

            const fetchOptions = {
                method: skillMapping.method,
                headers: fetchHeaders
            };
            
            // Only attach body if it's not a GET request
            if (skillMapping.method !== 'GET') {
                fetchOptions.body = JSON.stringify(parameters);
            }

            const relayResponse = await fetch(targetUrl, fetchOptions);
            const responseData = await relayResponse.json().catch(() => ({}));
            return res.status(relayResponse.status).json(responseData);
            
        } catch (err) {
            console.error(chalk.red(`[AGP Proxy] Relay Failure:`), err.message);
            return res.status(502).json({ error: "Bad Gateway", details: "Target unreachable." });
        }
    });

    return router;
}
