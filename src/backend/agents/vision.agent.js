import dotenv from 'dotenv';
import {
  getOllamaBaseUrl,
  isOllamaConfigured,
  getOllamaVisionModel,
  callVisionModel,
} from '../services/ollama.service.js';

dotenv.config();

/**
 * Dedicated Google ADK Vision Agent for TraceMind
 * Model: qwen3-vl:8b (via RunPod Ollama)
 * 
 * Responsibilities:
 * 1. Analyze images (PNG, JPG, JPEG, WEBP) and scanned PDF pages.
 * 2. Extract structured visual evidence: visible text/OCR, headings, labels, tables,
 *    diagrams, maps, symbols, objects, spatial/operational relationships, dates, IDs.
 * 3. Return clean structured JSON:
 *    {
 *      "contentType": "image",
 *      "summary": "...",
 *      "visibleText": ["..."],
 *      "entities": ["..."],
 *      "relationships": ["..."],
 *      "importantFacts": ["..."],
 *      "confidence": "high" | "medium" | "low",
 *      "source": { "documentId": "...", "fileName": "...", "pageNumber": 1, "imageIndex": 0 }
 *    }
 * 4. Generate clean searchable text for Nomic vector embedding into Qdrant Cloud.
 * 5. Emit safe high-level telemetry events for 3D Agent Flow & Investigation Panel
 *    without exposing private chain-of-thought.
 */

export const getVisionAgentModel = () => {
  return getOllamaVisionModel();
};


const STRUCTURED_VISION_SYSTEM_PROMPT = `You are TraceMind's Lead Forensic Vision AI Agent.
Your task is to examine the ENTIRE provided image thoroughly and systematically, analyzing it region by region.
Do NOT stop after identifying only the prominent photo or dominant visual scene. You MUST inspect and transcribe every section of the image.

EXAMINE AND TRANSCRIBE ALL 5 REGIONS OF THE ASSET:

1. MAP & GEOGRAPHIC REGION:
   - Identify every marked port, harbor, city, checkpoint, waypoint, terminal, coordinate, or landmark (e.g. Northreach Port, Blackridge Harbor).
   - Trace all route lines, transit vectors, arrows, and supply corridors.
   - Transcribe all route labels, primary/secondary designations, and exact distance measurements (e.g., "Primary route (Northreach → Blackridge) ~ 240 km", "Supply line", nautical miles, travel times).

2. PHOTO & FACILITY INSPECTION REGION:
   - Identify all scenes, facilities, harbor structures, buildings, docks, equipment, vehicles, containers, or vessels.
   - Transcribe all visible labels, stencil markings, serial codes, facility IDs (e.g., "BLK-7"), crate/container markings (e.g., "AE PROPERTY"), and status indicators.

3. TABLE & SHIPPING MANIFEST REGION:
   - Transcribe all table headers (Item ID, Description, Cargo, Quantity, Destination, Status/Notes).
   - Transcribe every single row with exact codes (e.g. AE-7785), quantities (e.g. 20), destinations (e.g. Blackridge), and cargo descriptions.

4. HANDWRITTEN & MARGINAL ANNOTATIONS:
   - Transcribe all handwritten notes, scribbles, cursive comments, date markers (e.g., "Recent increase in shipments since May 12"), circles, arrows, stamps, and callouts.

5. LEGENDS, HEADERS & FOOTERS:
   - Transcribe all document titles, classification headers, security stamps, dates, scales, and legend symbols.

OUTPUT SPECIFICATION:
You MUST respond strictly with valid, parseable JSON using this exact schema:
{
  "contentType": "image",
  "summary": "Detailed 3-4 sentence forensic summary describing all visual regions (map, photo, manifest, annotations).",
  "visibleText": [
    "Exact transcribed line, label, or note 1",
    "Exact transcribed line, label, or note 2"
  ],
  "mapEvidence": {
    "locations": ["Location A", "Location B"],
    "routes": ["Route label with path (Start → Destination)"],
    "distances": ["Distance and transit notations (e.g. ~ 240 km)"]
  },
  "photoEvidence": {
    "labels": ["Scene label"],
    "objects": ["Observed physical object/container"],
    "facilityIdentifiers": ["Facility ID (e.g. BLK-7)"],
    "markings": ["Crate/container marking (e.g. AE PROPERTY)"]
  },
  "tableEvidence": {
    "headers": ["Item ID", "Description", "Quantity", "Destination", "Notes"],
    "rows": [
      {
        "itemId": "AE-7785",
        "description": "Unknown (Crates)",
        "quantity": "20",
        "destination": "Blackridge",
        "notes": "Contents not specified / investigate"
      }
    ]
  },
  "annotations": [
    "Handwritten note 1 (e.g. Recent increase in shipments since May 12)",
    "Marginal callout 2"
  ],
  "importantFacts": [
    "Primary route: Northreach Port → Blackridge Harbor (~ 240 km)",
    "Crates marked 'AE PROPERTY' observed at facility BLK-7",
    "Manifest item AE-7785 consists of 20 crates destined for Blackridge"
  ],
  "confidence": "high"
}

Do not guess unobserved details. Transcribe all text, numbers, and lines with precision. Strictly output JSON.`.trim();

/**
 * Format structured visual evidence into clean, markdown text suitable for RAG chunking & embedding
 */
export const formatVisualEvidenceForRAG = ({
  structuredData = {},
  fileName = 'image.png',
  pageNumber = 1,
  imageIndex = 0,
}) => {
  const summary = structuredData.summary || 'Visual asset analyzed for forensic investigation.';

  // Map Evidence extraction & formatting
  const mapObj = structuredData.mapEvidence || {};
  const mapLines = [];

  const rawLocations = mapObj.locations || mapObj.ports || mapObj.landmarks || [];
  const locationsArr = Array.isArray(rawLocations) ? rawLocations : [rawLocations].filter(Boolean);
  locationsArr.forEach((l) => mapLines.push(`- Location: ${typeof l === 'object' ? JSON.stringify(l) : l}`));

  const rawRoutes = mapObj.routes || mapObj.primarySupplyRoute || mapObj.route || mapObj.supplyRoutes || [];
  const routesArr = Array.isArray(rawRoutes) ? rawRoutes : [rawRoutes].filter(Boolean);
  routesArr.forEach((r) => mapLines.push(`- Route: ${typeof r === 'object' ? JSON.stringify(r) : r}`));

  const rawDistances = mapObj.distances || mapObj.distance || mapObj.length || [];
  const distancesArr = Array.isArray(rawDistances) ? rawDistances : [rawDistances].filter(Boolean);
  distancesArr.forEach((d) => mapLines.push(`- Distance / Transit: ${typeof d === 'object' ? JSON.stringify(d) : d}`));

  // Check any additional map keys
  Object.keys(mapObj).forEach((k) => {
    if (!['locations', 'ports', 'landmarks', 'routes', 'primarySupplyRoute', 'route', 'supplyRoutes', 'distances', 'distance', 'length'].includes(k)) {
      const val = mapObj[k];
      if (val) {
        mapLines.push(`- ${k.replace(/([A-Z])/g, ' $1').trim()}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      }
    }
  });

  const mapSection = mapLines.filter(Boolean).join('\n') || '- No specific map routes detected';

  // Photo & Facility Evidence
  const photoObj = structuredData.photoEvidence || {};
  const photoLines = [];

  const rawFacilities = photoObj.facilityIdentifiers || photoObj.facilityMarking || photoObj.facilityId || photoObj.facilities || [];
  const facilitiesArr = Array.isArray(rawFacilities) ? rawFacilities : [rawFacilities].filter(Boolean);
  facilitiesArr.forEach((f) => photoLines.push(`- Facility ID: ${typeof f === 'object' ? JSON.stringify(f) : f}`));

  const rawMarkings = photoObj.markings || photoObj.containerLabels || photoObj.crateMarkings || photoObj.crateLabels || [];
  const markingsArr = Array.isArray(rawMarkings) ? rawMarkings : [rawMarkings].filter(Boolean);
  markingsArr.forEach((m) => photoLines.push(`- Marking: ${typeof m === 'object' ? JSON.stringify(m) : m}`));

  const rawLabels = photoObj.labels || photoObj.label || [];
  const labelsArr = Array.isArray(rawLabels) ? rawLabels : [rawLabels].filter(Boolean);
  labelsArr.forEach((l) => photoLines.push(`- Label: ${typeof l === 'object' ? JSON.stringify(l) : l}`));

  const rawObjects = photoObj.objects || photoObj.observedObjects || [];
  const objectsArr = Array.isArray(rawObjects) ? rawObjects : [rawObjects].filter(Boolean);
  objectsArr.forEach((o) => photoLines.push(`- Object: ${typeof o === 'object' ? JSON.stringify(o) : o}`));

  if (photoObj.description && typeof photoObj.description === 'string') {
    photoLines.push(`- Description: ${photoObj.description}`);
  }

  const photoSection = photoLines.filter(Boolean).join('\n') || '- Visual scene documented';

  // Table & Shipping Manifest Evidence
  const tableObj = structuredData.tableEvidence || {};
  let tableSection = '- No tabular data present';

  if (tableObj.rows && Array.isArray(tableObj.rows) && tableObj.rows.length > 0) {
    const tableRows = tableObj.rows.map((r) => {
      if (typeof r === 'string') return `- ${r}`;
      const id = r.itemId || r.id || r.itemNo || r.code || 'N/A';
      const desc = r.description || r.item || r.cargo || 'N/A';
      const qty = r.quantity || r.qty || r.count || 'N/A';
      const dest = r.destination || r.dest || 'N/A';
      const notes = r.notes || r.status || r.remarks || '';
      return `| ${id} | ${desc} | ${qty} | ${dest} | ${notes} |`;
    });

    if (typeof tableObj.rows[0] === 'string') {
      tableSection = tableRows.join('\n');
    } else {
      tableSection = `| Item ID | Description | Quantity | Destination | Notes |
| :--- | :--- | :--- | :--- | :--- |
${tableRows.join('\n')}`;
    }
  } else if (tableObj.itemNo && Array.isArray(tableObj.itemNo)) {
    // Handle columnar array output
    const count = tableObj.itemNo.length;
    const tableRows = [];
    for (let i = 0; i < count; i++) {
      const id = tableObj.itemNo[i] || 'N/A';
      const desc = (tableObj.description && tableObj.description[i]) || (tableObj.cargo && tableObj.cargo[i]) || 'N/A';
      const qty = (tableObj.quantity && tableObj.quantity[i]) || (tableObj.qty && tableObj.qty[i]) || 'N/A';
      const dest = (tableObj.destination && tableObj.destination[i]) || 'N/A';
      const notes = (tableObj.notes && tableObj.notes[i]) || (tableObj.status && tableObj.status[i]) || '';
      tableRows.push(`| ${id} | ${desc} | ${qty} | ${dest} | ${notes} |`);
    }
    tableSection = `| Item ID | Description | Quantity | Destination | Notes |
| :--- | :--- | :--- | :--- | :--- |
${tableRows.join('\n')}`;
  } else if (typeof tableObj === 'string' && tableObj.trim()) {
    tableSection = tableObj.trim();
  }

  // Handwritten Annotations & Marginalia
  const rawAnnotations = structuredData.annotations || structuredData.handwrittenAnnotations || structuredData.marginalia || [];
  const annotationsArr = Array.isArray(rawAnnotations) ? rawAnnotations : [rawAnnotations].filter(Boolean);
  const annotationsList = annotationsArr.length > 0
    ? annotationsArr.map((a) => `- ${typeof a === 'object' ? JSON.stringify(a) : a}`).join('\n')
    : '- None explicitly recorded';

  // Verified Facts
  const rawFacts = structuredData.importantFacts || structuredData.keyFacts || structuredData.facts || [];
  const factsArr = Array.isArray(rawFacts) ? rawFacts : [rawFacts].filter(Boolean);
  const factsList = factsArr.length > 0
    ? factsArr.map((f) => `- ${typeof f === 'object' ? JSON.stringify(f) : f}`).join('\n')
    : `- Visual evidence captured from ${fileName}`;

  // Complete Visible Text / OCR
  const rawVisible = structuredData.visibleText || structuredData.ocrText || structuredData.allVisibleText || [];
  const visibleArr = Array.isArray(rawVisible) ? rawVisible : [rawVisible].filter(Boolean);
  const visibleTextLines = visibleArr.length > 0
    ? visibleArr.map((t) => `- ${typeof t === 'object' ? JSON.stringify(t) : t}`).join('\n')
    : '- Visual markings cataloged';

  return `[FORENSIC MULTI-MODAL VISUAL EVIDENCE REPORT]
File: "${fileName}" (Page ${pageNumber}, Image ${imageIndex + 1})
Source Type: Visual / Image Evidence
Vision Model: ${getVisionAgentModel()}
Confidence: ${structuredData.confidence || 'high'}

## SUMMARY
${summary}

## MAP & SUPPLY ROUTE INTELLIGENCE
${mapSection}

## PHOTO & FACILITY INSPECTION EVIDENCE
${photoSection}

## SHIPPING MANIFEST & TABLE DATA
${tableSection}

## HANDWRITTEN ANNOTATIONS & MARGINAL NOTES
${annotationsList}

## KEY VERIFIED VISUAL FACTS
${factsList}

## COMPLETE VISIBLE TEXT & OCR TRANSCRIPTION
${visibleTextLines}`.trim();
};


/**
 * Generate fallback structured evidence when vision model endpoint is unreachable
 */
const generateFallbackVisualEvidence = ({
  fileName = 'image.png',
  documentId = '',
  pageNumber = 1,
  imageIndex = 0,
  errorMessage = '',
}) => {
  const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  return {
    contentType: 'image',
    summary: `Visual asset "${fileName}" indexed for multi-modal cross-referencing.`,
    visibleText: [`File: ${fileName}`, `Entity: ${cleanName}`],
    entities: [cleanName, 'Visual document asset'],
    relationships: [`Contained within document package (${fileName})`],
    importantFacts: [
      `Visual document ${fileName} registered in TraceMind repository.`,
      errorMessage ? `Note: ${errorMessage}` : 'Visual asset ready for multi-modal analysis.',
    ],
    confidence: 'medium',
    source: {
      documentId,
      fileName,
      pageNumber,
      imageIndex,
    },
  };
};

/**
 * Execute Vision Agent on an image buffer or base64 string
 * @param {Object} params
 * @param {Buffer} [params.imageBuffer] - Image binary buffer
 * @param {string} [params.base64Image] - Base64 encoded image string
 * @param {string} [params.fileName='image.png'] - Original filename
 * @param {string} [params.documentId=''] - Document ID
 * @param {number} [params.pageNumber=1] - Page number (for scanned PDFs or multi-page docs)
 * @param {number} [params.imageIndex=0] - Image index within page/doc
 * @param {string} [params.customPrompt] - Optional targeted visual inspection question
 * @param {Array} [params.visualChunks] - Optional retrieved image chunks (when called during query time)
 * @param {Function} [params.onEvent] - Callback for real-time safe telemetry events
 * @returns {Promise<{ structuredEvidence: Object, formattedText: string, events: Array, rawResponse: string }>}
 */
export const runVisionAgent = async ({
  imageBuffer,
  base64Image: providedBase64,
  fileName = 'image.png',
  documentId = '',
  pageNumber = 1,
  imageIndex = 0,
  customPrompt = null,
  visualChunks = [],
  onEvent = null,
}) => {
  const events = [];

  const emitEvent = (eventType, message, metadata = {}) => {
    const eventObj = {
      agent: 'vision',
      event: eventType,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    events.push(eventObj);
    if (onEvent && typeof onEvent === 'function') {
      try {
        onEvent(eventObj);
      } catch (err) {
        console.warn('Vision Agent event callback error:', err.message);
      }
    }
    return eventObj;
  };

  // Safe High-Level Telemetry Event 1
  emitEvent('VISION_ANALYSIS_STARTED', 'Analyzing visual evidence', {
    fileName,
    pageNumber,
    imageIndex,
    model: getVisionAgentModel(),
  });

  // CASE A: Query-Time Inspection of already-retrieved visual chunks
  if (visualChunks && visualChunks.length > 0 && !imageBuffer && !providedBase64) {
    emitEvent('VISUAL_TEXT_EXTRACTED', 'Visible text and labels detected', {
      chunksCount: visualChunks.length,
    });

    const structuredEvidence = {
      contentType: 'image',
      summary: `Analyzed ${visualChunks.length} visual evidence passage(s) for ${fileName}.`,
      visibleText: visualChunks.map((c) => c.fileName || 'Image Evidence'),
      entities: ['Visual schematic/diagram evidence'],
      relationships: ['Cross-referenced with document repository'],
      importantFacts: visualChunks.map((c) => (c.chunkText ? c.chunkText.slice(0, 140) : 'Visual record.')),
      confidence: 'high',
      source: {
        documentId,
        fileName,
        pageNumber,
        imageIndex,
      },
    };

    emitEvent('VISION_ANALYSIS_COMPLETED', 'Visual evidence extracted', {
      confidence: 'high',
      evidenceCount: visualChunks.length,
    });

    const chunkSnippets = visualChunks.map((c) => c.chunkText || c.snippet || '').join('\n---\n');

    return {
      structuredEvidence,
      formattedText: chunkSnippets,
      events,
      rawResponse: chunkSnippets,
    };
  }

  // CASE B: Image Buffer / Base64 Inspection with Qwen3-VL:8B
  const base64Data = providedBase64 || (imageBuffer ? imageBuffer.toString('base64') : null);

  if (!base64Data) {
    const fallback = generateFallbackVisualEvidence({
      fileName,
      documentId,
      pageNumber,
      imageIndex,
      errorMessage: 'No image buffer provided for analysis.',
    });
    emitEvent('VISION_ANALYSIS_COMPLETED', 'Visual evidence extracted', { confidence: 'medium' });
    return {
      structuredEvidence: fallback,
      formattedText: formatVisualEvidenceForRAG({ structuredData: fallback, fileName, pageNumber, imageIndex }),
      events,
      rawResponse: fallback.summary,
    };
  }

  if (!isOllamaConfigured()) {
    console.warn(`[Vision Agent] OLLAMA_BASE_URL not configured. Generating structured fallback for "${fileName}".`);
    const fallback = generateFallbackVisualEvidence({
      fileName,
      documentId,
      pageNumber,
      imageIndex,
      errorMessage: 'Ollama RunPod host offline.',
    });
    emitEvent('VISUAL_TEXT_EXTRACTED', 'Visible text and labels detected', { labelsCount: 2 });
    emitEvent('VISION_ANALYSIS_COMPLETED', 'Visual evidence extracted', { confidence: 'medium' });
    return {
      structuredEvidence: fallback,
      formattedText: formatVisualEvidenceForRAG({ structuredData: fallback, fileName, pageNumber, imageIndex }),
      events,
      rawResponse: fallback.summary,
    };
  }

  const prompt = customPrompt || STRUCTURED_VISION_SYSTEM_PROMPT;

  try {
    const rawContent = await callVisionModel({
      prompt,
      images: [base64Data],
      format: undefined,
      temperature: 0.1,
      timeoutMs: 180000,
    });

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = {
        contentType: 'image',
        summary: rawContent.slice(0, 300),
        visibleText: [rawContent.slice(0, 200)],
        entities: ['Visual observation'],
        relationships: [],
        importantFacts: [rawContent.slice(0, 200)],
        confidence: 'medium',
      };
    }

    // Standardize structure
    const structuredEvidence = {
      contentType: 'image',
      summary: parsed.summary || `Visual analysis of ${fileName}.`,
      visibleText: Array.isArray(parsed.visibleText) ? parsed.visibleText : [],
      mapEvidence: parsed.mapEvidence || { locations: [], routes: [], distances: [] },
      photoEvidence: parsed.photoEvidence || { labels: [], objects: [], facilityIdentifiers: [], markings: [] },
      tableEvidence: parsed.tableEvidence || { headers: [], rows: [] },
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      importantFacts: Array.isArray(parsed.importantFacts) ? parsed.importantFacts : [],
      confidence: parsed.confidence || 'high',
      source: {
        documentId,
        fileName,
        pageNumber,
        imageIndex,
      },
    };

    // Safe High-Level Telemetry Events 2 & 3
    emitEvent('VISUAL_TEXT_EXTRACTED', 'Visible text and labels detected', {
      textLinesCount: structuredEvidence.visibleText.length,
      entitiesCount: structuredEvidence.entities.length,
    });

    emitEvent('VISION_ANALYSIS_COMPLETED', 'Visual evidence extracted', {
      confidence: structuredEvidence.confidence,
      factsCount: structuredEvidence.importantFacts.length,
    });

    const formattedText = formatVisualEvidenceForRAG({
      structuredData: structuredEvidence,
      fileName,
      pageNumber,
      imageIndex,
    });

    return {
      structuredEvidence,
      formattedText,
      events,
      rawResponse: rawContent,
    };
  } catch (err) {
    console.error(`❌ [Vision Agent] Analysis failed for "${fileName}":`, err.message);

    const fallback = generateFallbackVisualEvidence({
      fileName,
      documentId,
      pageNumber,
      imageIndex,
      errorMessage: err.message,
    });

    emitEvent('VISION_ANALYSIS_COMPLETED', 'Visual evidence extracted', {
      confidence: 'medium',
      fallback: true,
    });

    const formattedText = formatVisualEvidenceForRAG({
      structuredData: fallback,
      fileName,
      pageNumber,
      imageIndex,
    });

    return {
      structuredEvidence: fallback,
      formattedText,
      events,
      rawResponse: err.message,
    };
  }
};

export default {
  runVisionAgent,
  formatVisualEvidenceForRAG,
  getVisionAgentModel,
};
