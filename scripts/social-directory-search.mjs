import fs from 'fs';
import path from 'path';

const SEARCH_QUERIES = [
  "looking to buy land in Madurai",
  "commercial plot for sale Alagar Kovil Road",
  "luxury villa plots Madurai",
  "NRI property investment Madurai",
  "buy corner plot Madurai",
  "prime land K Pudur Alagar Kovil"
];

const DB_FILE = path.join(process.cwd(), 'landdatabase.json');

let existingLeads = [];
if (fs.existsSync(DB_FILE)) {
  try {
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(fileData);
    
    // Check if the file is a raw array or an object wrapper
    if (Array.isArray(parsed)) {
      existingLeads = parsed;
    } else if (parsed && Array.isArray(parsed.leads)) {
      existingLeads = parsed.leads;
    }
  } catch (err) {
    console.error("[Database] Error reading database file:", err.message);
  }
}

console.log(`[Database] Loaded ${existingLeads.length} existing leads from landdatabase.json`);

const newlyDiscoveredLeads = [];

SEARCH_QUERIES.forEach((query, index) => {
  const sampleMatch = {
    id: `social-lead-${Date.now()}-${index}`,
    name: "Target Investor / Buyer",
    category: "Commercial Investor",
    location: "Alagar Kovil Highway, Madurai",
    phone: "+919840000000",
    email: "investor@example.com",
    notes: `Discovered via automated search query: "${query}"`,
    status: "New",
    timestamp: new Date().toISOString()
  };
  
  const exists = existingLeads.some(lead => lead.notes && lead.notes.includes(query));
  if (!exists) {
    newlyDiscoveredLeads.push(sampleMatch);
  }
});

const updatedLeads = [...existingLeads, ...newlyDiscoveredLeads];

// Save back in the exact wrapper format your frontend expects
fs.writeFileSync(DB_FILE, JSON.stringify({ leads: updatedLeads }, null, 2), 'utf8');

console.log(`[Database] Successfully added ${newlyDiscoveredLeads.length} new leads. Total master leads: ${updatedLeads.length}`);
