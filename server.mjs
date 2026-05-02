import express from 'express';
import jwt from 'jsonwebtoken';
import createAGPGateway from './gateway/agp-bouncer.mjs';

const app = express();
const PORT = 3010;
const SECRET_KEY = process.env.AGP_SECRET || 'agp-super-secret';

app.use(express.json());

// 1. THE AGP GATEWAY
app.use('/api', createAGPGateway());

// 2. THE AUTH FLOW (Agent Handshake)
app.get('/auth/agent', (req, res) => {
    const { scope } = req.query;
    res.send(`
        <div style="background:#0f172a; color:white; height:100vh; display:flex; align-items:center; justify-content:center; font-family:sans-serif;">
            <div style="background:#1e293b; padding:2rem; border-radius:12px; text-align:center;">
                <h2>Grant Agent Access?</h2>
                <p>Requesting permission for: <strong>${scope}</strong></p>
                <form action="/auth/approve" method="POST">
                    <input type="hidden" name="scope" value="${scope}">
                    <button type="submit" style="background:#3b82f6; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; width:100%;">Approve</button>
                </form>
            </div>
        </div>
    `);
});

app.post('/auth/approve', (req, res) => {
    const { scope } = req.body;
    const token = jwt.sign({ scopes: [scope], userId: 'authorized-agent' }, SECRET_KEY, { expiresIn: '1h' });
    res.send(`
        <div style="background:#0f172a; color:white; padding:2rem; font-family:sans-serif; height:100vh;">
            <h3>Authorization Token:</h3>
            <textarea style="width:100%; height:100px; background:#1e293b; color:#60a5fa; border:none; padding:10px;" readonly>${token}</textarea>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 AGP Gateway Service running at http://localhost:${PORT}`);
});
