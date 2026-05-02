import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function applySmartPatch(targetBase, authFile, newContent) {
    const fullPath = path.resolve(targetBase, authFile);
    if (!fs.existsSync(fullPath)) {
        const potentialFiles = glob.sync(`**/${path.basename(authFile)}`, { cwd: targetBase, absolute: true });
        if (potentialFiles.length === 0) {
            console.error(chalk.red(`❌ Could not locate auth file: ${authFile}`));
            return;
        }
        return applySmartPatch(targetBase, potentialFiles[0], newContent);
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    if (currentContent.includes('X-AGP-Signature')) {
        console.log(chalk.yellow(`ℹ️ Trust Bridge is already active in ${authFile}. Skipping patch.`));
        return;
    }

    fs.writeFileSync(fullPath, newContent);
    console.log(chalk.green(`⚡ UNIVERSAL SMART-PATCH: Successfully secured ${authFile}`));
}

export async function scanProject(targetDir = '.', targetPort = '5000') {
    const normalizedTarget = path.resolve(targetDir).replace(/\\/g, '/');
    console.log(chalk.blue(`🚀 AGP Smart Architect: Mapping API for [${normalizedTarget}]...`));

    let API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    // If no key is found in the environment, ask the user directly!
    if (!API_KEY) {
        console.log(chalk.yellow(`\n⚠️  No Gemini API Key detected.`));
        const rl = readline.createInterface({ input, output });
        
        API_KEY = await rl.question(chalk.green('🔑 Please paste your Gemini API Key and press Enter: '));
        rl.close();
        
        // Clean up any accidental spaces they pasted
        API_KEY = API_KEY.trim();

        if (!API_KEY) {
            console.error(chalk.red("\n❌ Error: An API Key is required to run the Smart Scanner."));
            return;
        }
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const rawFiles = glob.sync(`${normalizedTarget}/**/*.{js,ts,py,php,go,rb}`, { nodir: true });
    const files = rawFiles.filter(f => {
        const isIgnored = /node_modules|client|build|dist|vendor|public|\.git|__pycache__|tests/i.test(f);
        const isCore = /controller|route|auth|middleware|main|app|index/i.test(f);
        return !isIgnored && isCore;
    });

    if (files.length === 0) {
        console.error(chalk.red("❌ Error: No architectural files found. Check your path."));
        return;
    }

    console.log(chalk.gray(`🔍 Analyzed ${files.length} core backend files...`));

    const contextMap = files.slice(0, 30).map(file => ({
        path: path.relative(normalizedTarget, file),
        content: fs.readFileSync(file, 'utf8').substring(0, 4000) 
    }));

    try {
        console.log(chalk.gray(`📡 Dispatching for Audited Full-File Rewrite to Gemini 3 Flash...`));
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
                You are the AGP Universal Systems Architect. 
                Analyze the codebase and output JSON.

                DIRECTIVES:
                1. Detect the BACKEND framework.
                2. Find the primary Server-Side Authentication Middleware file.
                3. Rewrite that file completely to include the AGP Trust Bridge.
                   - The Trust Bridge MUST execute INSIDE the exported middleware function.
                   - CRITICAL: You MUST wrap the injected logic with the framework's native comment syntax exactly like this:
                     // --- AGP TRUST BRIDGE START ---
                     (your logic here)
                     // --- AGP TRUST BRIDGE END ---
                   - The logic must verify an HMAC-SHA256 signature from 'X-AGP-Signature' against 'X-AGP-UserId' using 'process.env.AGP_SECRET'.
                   - If valid, populate the user object (e.g., req.user) and immediately return next().
                   - DO NOT use third-party libraries (use native crypto/hashlib).
                4. CRITICAL: For each skill, analyze the route definitions. If the route uses authentication middleware (e.g., authMiddleware), set "requires_auth" to true. Otherwise, false.
                
                Codebase Context:
                ${JSON.stringify(contextMap)}
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        framework: { type: Type.STRING },
                        auth_file: { type: Type.STRING },
                        patched_auth_file_content: { type: Type.STRING },
                        skills: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    method: { type: Type.STRING },
                                    url_path: { type: Type.STRING },
                                    parameters: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    requires_auth: { type: Type.BOOLEAN }
                                },
                                required: ["name", "method", "url_path", "parameters", "requires_auth"]
                            }
                        }
                    },
                    required: ["framework", "auth_file", "patched_auth_file_content", "skills"]
                }
            }
        });

        const analysis = JSON.parse(response.text);

        const internalProxyMap = { target_base: `http://localhost:${targetPort}`, mappings: {} };
        analysis.skills.forEach(s => { 
            internalProxyMap.mappings[s.name] = { 
                method: s.method, 
                path: s.url_path, 
                requires_auth: s.requires_auth
            }; 
        });

        fs.writeFileSync('agp.config.json', JSON.stringify(internalProxyMap, null, 2));
        console.log(chalk.green(`✅ Analysis Complete! Found ${analysis.framework} backend.`));
        
        // Write the public AI manifest
        const wellKnownDir = path.join(process.cwd(), '.well-known');
        if (!fs.existsSync(wellKnownDir)) fs.mkdirSync(wellKnownDir);
        
        const aiManifest = {
            protocol_version: "ADP v3.0",
            skills: analysis.skills
        };
        fs.writeFileSync(path.join(wellKnownDir, 'ai.json'), JSON.stringify(aiManifest, null, 2));
        console.log(chalk.green(`  Public Manifest generated at /.well-known/ai.json`));
        
        await applySmartPatch(normalizedTarget, analysis.auth_file, analysis.patched_auth_file_content);

    } catch (err) {
        console.error(chalk.red("❌ AGP Scanner Failure:"), err.message);
    }
}

