// This file is loaded via --import BEFORE the main app
// It ensures .env is loaded before any other module reads process.env
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: envPath });
console.log(`[preload] Loaded .env from ${envPath}`);
console.log(`[preload] OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'set (length: ' + process.env.OPENROUTER_API_KEY.length + ')' : 'NOT SET'}`);
console.log(`[preload] SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
