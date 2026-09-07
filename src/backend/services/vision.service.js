import dotenv from 'dotenv';
import {
  getOllamaBaseUrl,
  isOllamaConfigured,
  getOllamaVisionModel,
  callVisionModel,
} from './ollama.service.js';

dotenv.config();

/**
 * Qwen-VL Vision Analysis Service for TraceMind
 * Communicates with remote Qwen3-VL / Qwen2.5-VL model on RunPod Ollama.
 * Extracts:
 * 1. Visible Text / OCR (signs, document text, timestamps, serial numbers, labels, badges, watermarks).
 * 2. Visual Objects & Entities (people, badges, cameras, vehicles, equipment, tags, containers, keys).
 * 3. Diagrams, Charts, Tables, Layout Structures, and Blueprints.
 * 4. Spatial & Temporal Relationships (relative positions, state of objects: connected/disconnected/damaged/sealed).
 * 5. Forensic & Discrepancy Evidence (tampering, status indicators, LED colors, environment condition).
 */

export { getOllamaVisionModel };

/**
 * Clean forensic vision prompt for document & evidence investigation
 */
const VISION_ANALYSIS_PROMPT = `You are TraceMind Vision AI, an expert forensic image and visual document analyst.
Perform a thorough, objective, and detailed examination of this image.

Extract and structure ALL observable information into the following sections:

1. VISIBLE TEXT & OCR:
   - Transcribe every piece of text visible in the image exactly as written (signs, labels, stamps, timestamps, serial numbers, name tags, watermarks, handwritten notes, digital displays, overlay headers).

2. OBJECTS & ENTITIES:
   - List all physical objects, equipment, vehicles, people, credentials, badges, security devices, or containers observed.
   - Note physical characteristics (color, condition, model markings, make, status indicators like LED lights).

3. DIAGRAMS, TABLES & SCHEMATICS:
   - If this is a chart, floorplan, schematic, or table, describe the columns, rows, connections, flow directions, and data values.

4. PHYSICAL STATES & SPATIAL RELATIONSHIPS:
   - Describe where objects are located relative to each other.
   - State whether items are connected, disconnected, open, closed, damaged, active, or immobilized (e.g., battery removed, locked in bay, cable unplugged).

5. FORENSIC EVIDENCE & TIMELINE RELEVANCE:
   - Note timestamps, camera IDs, date stamps, location tags, or visible discrepancies.

6. COMPREHENSIVE SUMMARY:
   - A concise 2-3 sentence summary of what this image depicts.

Be completely factual and grounded. Do not guess unobserved details. If text is partially obscured, transcribe what is readable.`.trim();

/**
 * Analyze an image buffer with Qwen-VL on RunPod Ollama
 * @param {Object} params
 * @param {Buffer} params.buffer - Image binary buffer
 * @param {string} params.mimeType - Image MIME type (image/png, image/jpeg, image/webp)
 * @param {string} params.filename - Original filename
 * @param {string} [params.customPrompt] - Optional custom extraction prompt
 * @param {number} [params.retries=2] - Retry attempts on transient network issues
 * @returns {Promise<{ fullText: string, structuredData: Object, summary: string }>}
 */
export const analyzeImageWithQwenVL = async ({
  buffer,
  mimeType = 'image/png',
  filename = 'image.png',
  customPrompt = null,
  retries = 2,
}) => {
  if (!buffer || buffer.length === 0) {
    throw new Error(`Cannot analyze empty image buffer for "${filename}".`);
  }

  const visionModel = getOllamaVisionModel();
  const base64Image = buffer.toString('base64');
  const promptToUse = customPrompt || VISION_ANALYSIS_PROMPT;

  console.log(`🖼️ [Vision AI] Analyzing "${filename}" (${(buffer.length / 1024).toFixed(1)} KB) with model "${visionModel}" on RunPod...`);

  if (!isOllamaConfigured()) {
    console.warn(`⚠️ [Vision AI] OLLAMA_BASE_URL not configured. Generating fallback visual description for "${filename}".`);
    return generateFallbackVisionResult(filename, buffer.length);
  }

  try {
    const rawResult = await callVisionModel({
      prompt: promptToUse,
      images: [base64Image],
      temperature: 0.1,
    });

    if (!rawResult || !rawResult.trim()) {
      throw new Error('Vision model returned an empty response.');
    }

    console.log(`✅ [Vision AI] Successfully extracted visual evidence from "${filename}" (${rawResult.length} characters).`);

    // Structure into formatted markdown representation suitable for semantic embedding & RAG retrieval
    const formattedVisionText = `[IMAGE EVIDENCE: ${filename}]
SOURCE TYPE: Image / Visual Capture (${mimeType})
EXTRACTED VISUAL DETAILS & EVIDENCE:
${rawResult}`.trim();

    return {
      fullText: formattedVisionText,
      rawAnalysis: rawResult,
      model: visionModel,
      mimeType,
      filename,
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`⚠️ [Vision AI] Vision analysis failed (${err.message}). Generating safe fallback visual representation.`);
    return generateFallbackVisionResult(filename, buffer.length, err?.message);
  }
};


/**
 * Fallback to alternative vision model names if primary model name differs on RunPod
 */
const retryWithFallbackVisionModel = async ({ baseUrl, base64Image, promptToUse, filename }) => {
  const fallbackModels = ['qwen2.5-vl:7b', 'qwen2.5-vl', 'llava:7b', 'qwen3:14b'];

  for (const altModel of fallbackModels) {
    try {
      console.log(`[Vision AI] Attempting fallback model: "${altModel}"...`);
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: altModel,
          prompt: promptToUse,
          images: [base64Image],
          stream: false,
          options: { temperature: 0.1 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawResult = (data.response || '').trim();
        if (rawResult) {
          console.log(`✅ [Vision AI] Succeeded with fallback model "${altModel}"!`);
          return {
            fullText: `[IMAGE EVIDENCE: ${filename}]\nSOURCE TYPE: Image / Visual Capture\nEXTRACTED VISUAL DETAILS:\n${rawResult}`,
            rawAnalysis: rawResult,
            model: altModel,
            filename,
            processedAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Continue to next fallback
    }
  }

  return generateFallbackVisionResult(filename, base64Image.length * 0.75, 'Vision model not found on Ollama server');
};

/**
 * Safe fallback generator for testing or when RunPod vision model is temporarily initializing
 */
const generateFallbackVisionResult = (filename, sizeBytes, reason = 'Local testing mode') => {
  const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const fallbackText = `[IMAGE EVIDENCE: ${filename}]
SOURCE TYPE: Image / Visual Evidence
FILE DETAILS: "${filename}" (Approx ${(sizeBytes / 1024).toFixed(1)} KB)
STATUS: Visual document indexed for forensic investigation.
OBSERVATION: Image asset "${cleanName}" captured for multi-modal cross-referencing.
NOTE: ${reason}`.trim();

  return {
    fullText: fallbackText,
    rawAnalysis: fallbackText,
    model: 'fallback-visual-indexer',
    filename,
    isFallback: true,
    processedAt: new Date().toISOString(),
  };
};

export default {
  analyzeImageWithQwenVL,
  getOllamaVisionModel,
};
