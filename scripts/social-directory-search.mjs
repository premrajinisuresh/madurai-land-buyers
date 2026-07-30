// scripts/social-directory-search.mjs
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('landdatabase.json');
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

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
    return { metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 }, leads: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return {
      metadata: raw.metadata || { lastRun: null, totalLeads: (raw.leads || raw).length, rotationIndex: 0, socialRotationIndex: 0 },
      leads: Array.isArray(raw) ? raw : (raw.leads || [])
    };
  } catch (e) {
    return { metadata: { lastRun: null, totalLeads: 0, rotationIndex: 0, socialRotationIndex: 0 }, leads: [] };
  }
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

async function runSocialSearch() {
  console.log("[Social Search Engine] Scanning property portals and groups for buyer posts...");
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const db = loadDatabase();
  let queryIndex = (db.metadata.socialRotationIndex || 0) % SEARCH_QUERIES.length;
  const currentQuery = SEARCH_QUERIES[queryIndex];

  console.log(`[Social Search Engine] Probing query: "${currentQuery}"`);

  const prompt = `Using Google Search, find active direct buyer requirement posts, investor inquiries, or wanted listings on property portals (MagicBricks, Facebook groups, Justdial) matching: "${currentQuery}". Exclude brokers and intermediaries.
  Return ONLY a valid JSON array of objects with these exact keys:
  id, name, category, location, phone, whatsapp, email, website, notes, status, dateAdded.
  - category should be matched to the query type.
  - location should be near Madurai / Alagar Kovil Highway.
  - status must be "New".
  - dateAdded must be an ISO date string.
  No introductory or concluding text, output only the JSON array.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`API returned status ${response.status}`);

    const data = await response.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.log("[Social Search] No new JSON array parsed from response, skipping addition.");
      return;
    }

    const newLeads = JSON.parse(jsonMatch[0]);
    let addedCount = 0;
    const existingNames = new Set(db.leads.map(l => (l.name || "").toLowerCase().trim()));

    for (const lead of newLeads) {
      const leadName = (lead.name || "").trim();
      const normalizedKey = leadName.toLowerCase();
      if (leadName && !existingNames.has(normalizedKey)) {
        db.leads.push({
          id: lead.id || `social-lead-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          name: leadName,
          category: lead.category || "Portal / Social Lead",
          location: lead.location || "Alagar Kovil Highway, Madurai",
          phone: lead.phone || "Not public",
          whatsapp: lead.whatsapp || "Not public",
          email: lead.email || "Not public",
          website: lead.website || "Not public",
          notes: lead.notes || `Discovered via query: "${currentQuery}"`,
          status: "New",
          dateAdded: lead.dateAdded || new Date().toISOString()
        });
        existingNames.add(normalizedKey);
        addedCount++;
      }
    }

    db.metadata.socialRotationIndex = (queryIndex + 1) % SEARCH_QUERIES.length;
    db.metadata.totalLeads = db.leads.length;
    db.metadata.lastRun = new Date().toISOString();

    saveDatabase(db);
    console.log(`[Database] Successfully committed ${addedCount} new social/portal leads. Total master leads: ${db.metadata.totalLeads}`);
  } catch (error) {
    console.error("[Error] Social search execution failed:", error.message || error);
    process.exit(1);
  }
}

runSocialSearch();
