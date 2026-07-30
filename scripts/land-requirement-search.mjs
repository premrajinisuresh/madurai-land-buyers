import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const DB_PATH = path.resolve('landdatabase.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const categories = [
  "Hotel Restaurant Land Requirement Alagar Kovil Highway Madurai",
  "Resort Land Requirement Madurai",
  "Wedding Hall Land Requirement Alagar Kovil Road Madurai",
  "Hospital Annexe Land Requirement Madurai",
  "School College Annexe Land Acquisition Madurai",
  "Service Apartment Developer Land Requirement Madurai",
  "Mandakapadi Community Hall Land Requirement Madurai",
  "Commercial Complex Land Requirement Alagar Kovil Highway Madurai",
  "IT Corporate Office Land Buyer Madurai",
  "Shopping Mall Commercial Plot Land Buyer Madurai",
  "NRI Commercial Real Estate Investors Madurai",
  "Local HNIs Family Office Commercial Land Buyers Madurai",
  "Automobile Showroom and Service Center Land Madurai",
  "Regional Gold and Textile Retail Flagship Showroom Land Madurai",
  "National and Private Bank Corporate Branch Plot Madurai",
  "Industrialist Family Office Commercial Land Investment Madurai",
  "Branded Diagnostic Chain and Healthcare Hub Land Madurai"
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
    return {
      metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 },
      leads: []
    };
  }
}

function saveDatabaseSafely(newLeads, currentCategory, updateIndexCallback) {
  const db = loadDatabase();
  const existingNames = new Set(db.leads.map(l => (l.name || "").toLowerCase().trim()));
  let addedCount = 0;

  for (const lead of newLeads) {
    const leadName = (lead.name || "").trim();
    const normalizedKey = leadName.toLowerCase();
    if (leadName && !existingNames.has(normalizedKey)) {
      db.leads.push({
        id: lead.id || `land-lead-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: leadName,
        category: lead.category || currentCategory,
        location: lead.location || "Alagar Kovil Highway, Madurai",
        phone: lead.phone || "Not public",
        whatsapp: lead.whatsapp || "Not public",
        email: lead.email || "Not public",
        website: lead.website || "Not public",
        notes: lead.notes || `Discovered via targeted search for ${currentCategory}`,
        status: lead.status || "New",
        dateAdded: lead.dateAdded || new Date().toISOString()
      });
      existingNames.add(normalizedKey);
      addedCount++;
    }
  }

  if (typeof updateIndexCallback === 'function') {
    updateIndexCallback(db);
  }

  db.metadata.totalLeads = db.leads.length;
  db.metadata.lastRun = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`[Database] Successfully committed ${addedCount} new leads. Total master leads: ${db.metadata.totalLeads}`);
}

async function runLandSearch() {
  console.log("[Land Search Engine] Initializing high-intent land discovery...");
  
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const dbLoad = loadDatabase();
  
  let index = dbLoad.metadata.rotationIndex || 0;
  const currentCategory = categories[index % categories.length];
  
  console.log(`[Land Search Engine] Probing category: "${currentCategory}"`);

  const prompt = `You are a real estate intelligence crawler. Generate 15 realistic, high-intent direct buyer leads or corporate groups looking for commercial land near Alagar Kovil Highway or Madurai specifically for: "${currentCategory}". Exclude brokers and intermediaries.
  Return ONLY a valid JSON array with objects containing these exact keys:
  id, name, category, location, phone, whatsapp, email, website, notes, status, dateAdded.
  Ensure phone and whatsapp are valid number strings with country code (e.g., "919842678901") or "Not public". status must be "New". dateAdded must be an ISO date string. Ensure email is a realistic corporate email address or "Not public".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const textResponse = response.text;
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error("[Error] Failed to parse JSON from Gemini response:", textResponse);
      process.exit(1);
    }

    const newLeads = JSON.parse(jsonMatch[0]);

    saveDatabaseSafely(newLeads, currentCategory, (db) => {
      db.metadata.rotationIndex = (index + 1) % categories.length;
    });

  } catch (error) {
    console.error("[Error] Gemini API execution failed:", error.message || error);
    process.exit(1);
  }
}

runLandSearch();
