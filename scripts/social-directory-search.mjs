import path from 'path';
import { GoogleGenAI } from '@google/genai';

const DB_PATH = path.resolve('landdatabase.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SEARCH_QUERIES = [
  "hotel restaurant land buyer requirement Madurai MagicBricks Facebook group",
  "resort land wanted Madurai Alagar Kovil Road",
  "wedding hall land requirement Madurai property portal",
  "hospital annexe land expansion Madurai",
  "school college annexe land requirement Madurai",
  "service apartment developer land buyer Madurai",
  "mandakapadi wedding hall land requirement Madurai",
  "commercial complex plot wanted Alagar Kovil Highway Madurai",
  "IT corporate office land requirement Madurai",
  "shopping mall commercial plot buyer Madurai MagicBricks",
  "NRI commercial real estate investors looking for land Madurai",
  "local family office HNI commercial land buyers Madurai",
  "automobile showroom dealership land requirement Madurai",
  "gold jewelry textile retail brand land purchase Madurai",
  "bank corporate branch head office plot requirement Madurai",
  "industrialist family office land acquisition Madurai",
  "diagnostic center healthcare chain land requirement Madurai"
];

function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    return {
      metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 },
      leads: []
    };
  }
  try {
    const rawContent = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(rawContent);

    let leads = [];
    let metadata = { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 };

    if (Array.isArray(parsed)) {
      leads = parsed;
      metadata.totalLeads = leads.length;
    } else if (parsed && typeof parsed === 'object') {
      leads = Array.isArray(parsed.leads) ? parsed.leads : [];
      if (parsed.metadata) {
        metadata = {
          lastRun: parsed.metadata.lastRun || null,
          totalLeads: leads.length,
          rotationIndex: typeof parsed.metadata.rotationIndex === 'number' ? parsed.metadata.rotationIndex : 0,
          socialRotationIndex: typeof parsed.metadata.socialRotationIndex === 'number' ? parsed.metadata.socialRotationIndex : 0
        };
      } else {
        metadata.totalLeads = leads.length;
      }
    }
    return { metadata, leads };
  } catch (e) {
    console.error("[Database Warning] Error parsing existing database JSON. Attempting fallback or safe state recovery:", e.message);
    // If corruption happened, try loading from backup if available
    const backupPath = `${DB_PATH}.bak`;
    if (fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        const backupParsed = JSON.parse(backupContent);
        console.log("[Database Recovery] Successfully recovered database state from backup file.");
        return {
          metadata: backupParsed.metadata || { lastRun: null, totalLeads: backupParsed.leads?.length || 0, rotationIndex: 0, socialRotationIndex: 0 },
          leads: Array.isArray(backupParsed) ? backupParsed : (backupParsed.leads || [])
        };
      } catch (backupEx) {
        console.error("[Database Recovery] Backup file also invalid. Initializing clean state to protect run.");
      }
    }
    return {
      metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 },
      leads: []
    };
  }
}

async function generateContentWithRetry(ai, modelName, prompt, maxRetries = 3, initialDelayMs = 5000) {
  let delayMs = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      return response;
    } catch (error) {
      const errString = error.message || String(error);
      const isTransient = error.status === 503 || error.status === 429 || errString.includes('503') || errString.includes('high demand');
      console.warn(`[API Warning] Attempt ${attempt}/${maxRetries} failed. Details: ${errString}`);
      if (isTransient && attempt < maxRetries) {
        console.log(`[API Retry] High demand / transient error caught. Waiting ${delayMs / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

function extractAndParseJSON(textResponse) {
  if (!textResponse) throw new Error("Empty response string received from model.");
  
  // Clean markdown code block syntax securely
  let cleaned = textResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonString = cleaned.substring(firstBracket, lastBracket + 1);
    return JSON.parse(jsonString);
  }
  
  throw new Error("No valid JSON array boundaries found in model output.");
}

function saveDatabaseSafely(newLeads, queryCategory, updateIndexCallback) {
  const db = loadDatabase();

  // Create immediate file backup before touching data
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, `${DB_PATH}.bak`);
    } catch (bakErr) {
      console.warn("[Database Warning] Failed to create safety backup file:", bakErr.message);
    }
  }

  const existingNames = new Set(db.leads.map(l => (l.name || "").toLowerCase().trim()));
  let addedCount = 0;

  if (Array.isArray(newLeads)) {
    for (const lead of newLeads) {
      const leadName = (lead.name || "").trim();
      const normalizedKey = leadName.toLowerCase();
      if (leadName && !existingNames.has(normalizedKey)) {
        db.leads.push({
          id: lead.id || `social-lead-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          name: leadName,
          category: lead.category || queryCategory || "Portal / Social Lead",
          location: lead.location || "Alagar Kovil Highway, Madurai",
          phone: lead.phone || "Not public",
          whatsapp: lead.whatsapp || "Not public",
          email: lead.email || "Not public",
          website: lead.website || "Not public",
          notes: lead.notes || `Discovered via query: "${queryCategory}"`,
          status: lead.status || "New",
          dateAdded: lead.dateAdded || new Date().toISOString()
        });
        existingNames.add(normalizedKey);
        addedCount++;
      }
    }
  }

  if (typeof updateIndexCallback === 'function') {
    updateIndexCallback(db);
  }

  db.metadata.totalLeads = db.leads.length;
  db.metadata.lastRun = new Date().toISOString();
  
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`[Database] Successfully committed ${addedCount} new social/portal leads. Total master leads: ${db.metadata.totalLeads}`);
}

async function runSocialSearch() {
  console.log("[Social Search Engine] Scanning property portals and groups for buyer posts...");
  
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const dbLoad = loadDatabase();
  
  let queryIndex = dbLoad.metadata.socialRotationIndex || 0;
  const currentQuery = SEARCH_QUERIES[queryIndex % SEARCH_QUERIES.length];

  console.log(`[Social Search Engine] Probing query: "${currentQuery}"`);

  const prompt = `Find active direct buyer requirement posts or investor listings matching: "${currentQuery}". Exclude brokers.
  Return ONLY a valid JSON array of objects with these exact keys:
  id, name, category, location, phone, whatsapp, email, website, notes, status, dateAdded.
  - category should match the query type.
  - location should be near Madurai / Alagar Kovil Highway.
  - status must be "New".
  - dateAdded must be an ISO date string.
  No introductory text, output only the JSON array.`;

  try {
    const response = await generateContentWithRetry(ai, 'gemini-3.6-flash', prompt);
    const textResponse = response.text;
    
    const newLeads = extractAndParseJSON(textResponse);

    saveDatabaseSafely(newLeads, currentQuery, (db) => {
      db.metadata.socialRotationIndex = (queryIndex + 1) % SEARCH_QUERIES.length;
    });

  } catch (error) {
    console.error("[Error] Social search execution failed safely without corrupting database:", error.message || error);
    process.exit(1);
  }
}

runSocialSearch();
