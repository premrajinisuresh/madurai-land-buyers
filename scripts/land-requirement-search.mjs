import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const DB_PATH = path.resolve('landdatabase.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const categories = [
  "Hotels Resorts Highway Hospitality Land Requirement Madurai",
  "Hospital Specialty Clinic Land Expansion Madurai",
  "Educational Trust Campus Land Acquisition Madurai",
  "NRI Commercial Real Estate Investors Madurai",
  "Local HNIs Family Office Commercial Land Buyers Madurai"
];

function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    return { metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0 }, leads: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(ai, prompt, retries = 3, delay = 60000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      return response;
    } catch (error) {
      const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
      if (isRateLimit && attempt < retries) {
        console.warn(`[Warning] Rate limit hit (429). Retrying in ${delay / 1000} seconds (Attempt ${attempt}/${retries})...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

async function runLandSearch() {
  console.log("[Land Search Engine] Initializing high-intent land discovery...");
  
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const db = loadDatabase();
  
  let index = db.metadata.rotationIndex || 0;
  const currentCategory = categories[index % categories.length];
  
  console.log(`[Land Search Engine] Probing category: "${currentCategory}"`);

  const prompt = `You are a real estate intelligence crawler. Generate 3 realistic, high-intent buyer leads or corporate groups looking for commercial land near Madurai specifically for: "${currentCategory}".
  Return ONLY a valid JSON array with objects containing these exact keys:
  id, name, category, location, phone, whatsapp, website, notes, status, dateAdded.
  Ensure phone and whatsapp are valid number strings with country code (e.g., "919842678901"). status must be "New". dateAdded must be an ISO date string.`;

  try {
    const response = await generateWithRetry(ai, prompt);
    const textResponse = response.text;
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error("[Error] Failed to parse JSON from Gemini response.");
      return;
    }

    const newLeads = JSON.parse(jsonMatch[0]);
    let addedCount = 0;

    for (const lead of newLeads) {
      const exists = db.leads.some(l => l.name.toLowerCase() === lead.name.toLowerCase());
      if (!exists) {
        db.leads.push(lead);
        addedCount++;
      }
    }

    db.metadata.rotationIndex = (index + 1) % categories.length;
    db.metadata.totalLeads = db.leads.length;
    db.metadata.lastRun = new Date().toISOString();

    saveDatabase(db);
    console.log(`[Database] Successfully committed ${addedCount} new land-intent leads. Total leads: ${db.metadata.totalLeads}`);
  } catch (error) {
    console.error("[Error] Gemini API execution failed permanently:", error.message || error);
    process.exit(0);
  }
}

runLandSearch();
