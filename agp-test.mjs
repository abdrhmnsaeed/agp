import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, './.env') });

const GATEWAY_URL = 'http://localhost:3010/execute';
const SECRET_KEY = process.env.AGP_SECRET || 'agp-super-secret';

async function runAutomaticTest() {
    console.log(chalk.blue('🧪 Starting AGP Automatic Relay Test...'));

    // 1. Generate a valid Agent Token for testing (acting as a dummy user ID)
    const testToken = jwt.sign({
        scopes: ['getUser'],
        userId: '65f1a2b3c4d5e6f7a8b9c0d1' 
    }, SECRET_KEY, { expiresIn: '1h' });

    console.log(chalk.gray('📡 Sending relay request through Gateway to Blog Server...'));

    try {
        const response = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${testToken}`
            },
            body: JSON.stringify({
                action: 'getUser',
                parameters: { id: '65f1a2b3c4d5e6f7a8b9c0d1' }
            })
        });

        const data = await response.json();

        if (response.status === 201 || response.status === 200) {
            console.log(chalk.green('✅ SUCCESS: The Blog Server accepted the request!'));
            console.log(chalk.gray('Response:'), data);
        } else if (response.status === 401 || response.status === 403) {
            console.log(chalk.red('❌ AUTH FAILURE: The Blog Server rejected the relay.'));
            console.log(chalk.yellow('Tip: Ensure your Blog Server has the "Trust Bridge" snippet applied and shares the same AGP_SECRET.'));
            console.log(chalk.gray('Error:'), data);
        } else {
            console.log(chalk.red(`❌ ERROR: Gateway returned HTTP ${response.status}`));
            console.log(chalk.gray('Details:'), data);
        }

    } catch (err) {
        console.error(chalk.red('❌ CONNECTION ERROR:'), err.message);
        console.log(chalk.yellow('Ensure both your Blog Server (5000) and AGP Gateway (3010) are running.'));
    }
}

runAutomaticTest();
