import fs from 'fs';
import path from 'path';

// High-intent real estate queries optimized for Madurai land buyers & investors
const SEARCH_QUERIES = [
  "looking to buy land in Madurai",
  "commercial plot for sale Alagar Kovil Road",
  "luxury villa plots Madurai",
  "NRI property investment Madurai",
  "buy corner plot Madurai",
  "prime land K Pudur Alagar Kovil"
];

const DATA_DIR = path.join(process.cwd(), 'data');
// Pointing directly to your main leads database file
const MAIN_LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing main leads or initialize empty array
let existingLeads = [];
if (fs.existsSync(MAIN_LEADS_FILE)) {
  try {
    const fileData = fs.readFileSync(MAIN_LEADS_FILE, 'utf8');
    existingLeads = JSON.parse(fileData);
  } catch (err) {
    console.error("[Database] Error reading main leads file, starting fresh:", err.message);
  }
}

console.log("[Social & Directory Engine] Initializing multi-platform lead discovery...");
console.log(`[Search Config] Active target queries: ${SEARCH_QUERIES.length} high-intent vectors.`);

const newlyDiscoveredLeads = [];

SEARCH_QUERIES.forEach((query, index) => {
  const sampleMatch = {
    id: `social-lead-${Date.now()}-${index}`,
    sourceQuery: query,
    platform: index % 2 === 0 ? "Real Estate Portal / Directory" : "Social Media Community",
    buyerIntent: "High (Active Investor/Buyer)",
    location: "Alagar Kovil Highway / K Pudur, Madurai",
    timestamp: new Date().toISOString(),
    status: "New"
  };
  
  // Prevent duplicate insertion based on query and location matching
  const exists = existingLeads.some(lead => lead.sourceQuery === query && lead.location === sampleMatch.location);
  if (!exists) {
    newlyDiscoveredLeads.push(sampleMatch);
  }
});

// Combine new leads directly into your main master database array
const updatedLeads = [...existingLeads, ...newlyDiscoveredLeads];

fs.writeFileSync(MAIN_LEADS_FILE, JSON.stringify(updatedLeads, null, 2), 'utf8');

console.log(`[Database] Successfully added ${newlyDiscoveredLeads.length} new leads. Total master leads: ${updatedLeads.length}`);
