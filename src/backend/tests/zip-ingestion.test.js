import AdmZip from 'adm-zip';
import assert from 'assert';
import {
  validateAndExtractZip,
  validateAndNormalizeZipPath,
  hasValidZipSignature,
  detectFileType,
  SUPPORTED_EXTENSIONS,
} from '../services/zip.service.js';
import { createDocumentChunks } from '../services/chunking.service.js';
import { buildGroundedPrompt } from '../services/qwen.service.js';

// Minimal mock binary buffers
const MOCK_PDF_BUFFER = Buffer.from('%PDF-1.4 sample pdf content for investigation testing');
const MOCK_DOCX_BUFFER = Buffer.from('PK\x03\x04 mock docx binary payload');
const MOCK_TXT_BUFFER = Buffer.from('Confidential report notes. Meeting at 14:00 near dock 4.');
const MOCK_MD_BUFFER = Buffer.from('# Evidence Summary\n\nKey findings from the scene analysis.');
const MOCK_PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const MOCK_JPG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 TRACEMIND ZIP INGESTION & SECURITY VALIDATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: ZIP containing only PDFs
  await test('1. ZIP containing only PDFs', async () => {
    const zip = new AdmZip();
    zip.addFile('document1.pdf', MOCK_PDF_BUFFER);
    zip.addFile('document2.pdf', MOCK_PDF_BUFFER);
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'only-pdfs.zip');
    assert.strictEqual(res.archive, 'only-pdfs.zip');
    assert.strictEqual(res.totalFiles, 2);
    assert.strictEqual(res.processed, 2);
    assert.strictEqual(res.skipped, 0);
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(res.files.length, 2);
    assert.strictEqual(res.files[0].fileType, 'PDF');
    assert.strictEqual(res.files[1].fileType, 'PDF');
    assert.strictEqual(res.files[0].isImage, false);
    assert.strictEqual(res.files[0].mimeType, 'application/pdf');
  });

  // TEST 2: ZIP containing PDFs + DOCX + TXT
  await test('2. ZIP containing PDFs + DOCX + TXT', async () => {
    const zip = new AdmZip();
    zip.addFile('incident.pdf', MOCK_PDF_BUFFER);
    zip.addFile('statement.docx', MOCK_DOCX_BUFFER);
    zip.addFile('field-notes.txt', MOCK_TXT_BUFFER);
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'mixed-documents.zip');
    assert.strictEqual(res.totalFiles, 3);
    assert.strictEqual(res.processed, 3);
    assert.strictEqual(res.skipped, 0);
    assert.strictEqual(res.failed, 0);

    const types = res.files.map(f => f.fileType).sort();
    assert.deepStrictEqual(types, ['DOCX', 'PDF', 'TXT']);
  });

  // TEST 3: ZIP containing documents + PNG/JPG images
  await test('3. ZIP containing documents + PNG/JPG images (Vision Agent Routing)', async () => {
    const zip = new AdmZip();
    zip.addFile('manifest.pdf', MOCK_PDF_BUFFER);
    zip.addFile('harbor-map.png', MOCK_PNG_BUFFER);
    zip.addFile('warehouse.jpg', MOCK_JPG_BUFFER);
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'investigation-bundle.zip');
    assert.strictEqual(res.totalFiles, 3);
    assert.strictEqual(res.processed, 3);

    const images = res.files.filter(f => f.isImage);
    const docs = res.files.filter(f => !f.isImage);
    assert.strictEqual(images.length, 2);
    assert.strictEqual(docs.length, 1);

    // Verify correct Vision Agent category & mimeType routing
    const mapImg = images.find(i => i.originalFileName === 'harbor-map.png');
    assert.strictEqual(mapImg.category, 'image');
    assert.strictEqual(mapImg.fileType, 'IMAGE');
    assert.strictEqual(mapImg.mimeType, 'image/png');

    const photoImg = images.find(i => i.originalFileName === 'warehouse.jpg');
    assert.strictEqual(photoImg.category, 'image');
    assert.strictEqual(photoImg.fileType, 'IMAGE');
    assert.strictEqual(photoImg.mimeType, 'image/jpeg');
  });

  // TEST 4: ZIP containing nested folders
  await test('4. ZIP containing nested folders (Relative Path Preservation)', async () => {
    const zip = new AdmZip();
    zip.addFile('reports/finance/q1.pdf', MOCK_PDF_BUFFER);
    zip.addFile('evidence/photos/scene1.png', MOCK_PNG_BUFFER);
    zip.addFile('investigation/notes/interview.txt', MOCK_TXT_BUFFER);
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'deep-structure.zip');
    assert.strictEqual(res.processed, 3);

    const paths = res.files.map(f => f.relativePath).sort();
    assert.deepStrictEqual(paths, [
      'evidence/photos/scene1.png',
      'investigation/notes/interview.txt',
      'reports/finance/q1.pdf'
    ]);
  });

  // TEST 5: ZIP containing unsupported files
  await test('5. ZIP containing unsupported files (Safe Skipping without Crash)', async () => {
    const zip = new AdmZip();
    zip.addFile('valid-report.pdf', MOCK_PDF_BUFFER);
    zip.addFile('malicious-payload.exe', Buffer.from('MZ binary dummy'));
    zip.addFile('exploit.sh', Buffer.from('#!/bin/bash\necho hack'));
    zip.addFile('audio-recording.mp3', Buffer.from('mock mp3 data'));
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'mixed-with-unsupported.zip');
    assert.strictEqual(res.totalFiles, 4);
    assert.strictEqual(res.processed, 1); // Only valid-report.pdf
    assert.strictEqual(res.skipped, 3);   // exe, sh, mp3 skipped
    assert.strictEqual(res.failed, 0);

    assert.strictEqual(res.files[0].originalFileName, 'valid-report.pdf');
    assert.strictEqual(res.skippedFiles.length, 3);
    const skippedNames = res.skippedFiles.map(s => s.originalFileName).sort();
    assert.deepStrictEqual(skippedNames, ['audio-recording.mp3', 'exploit.sh', 'malicious-payload.exe']);
  });

  // TEST 6: Corrupted ZIP
  await test('6. Corrupted ZIP (Magic Byte & Header Validation)', async () => {
    const corruptedBuffer = Buffer.from('THIS_IS_DEFINITELY_NOT_A_VALID_ZIP_ARCHIVE_HEADER');
    let errorThrown = false;

    try {
      await validateAndExtractZip(corruptedBuffer, 'corrupted.zip');
    } catch (err) {
      errorThrown = true;
      assert.ok(err.message.includes('Corrupted archive'));
    }

    assert.strictEqual(errorThrown, true, 'Corrupted ZIP must throw descriptive error');
  });

  // TEST 7: Malicious path traversal ZIP (Zip Slip defense)
  await test('7. Malicious path traversal ZIP (Zip Slip / Absolute / Dot-Dot Blocking)', async () => {
    const zip = new AdmZip();
    zip.addFile('safe-report.pdf', MOCK_PDF_BUFFER);
    zip.addFile('fake1.pdf', MOCK_PDF_BUFFER);
    zip.addFile('fake2.pdf', MOCK_PDF_BUFFER);
    const entries = zip.getEntries();
    entries[1].entryName = '../../etc/passwd.pdf';
    entries[2].entryName = '..\\Windows\\System32\\calc.exe';
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'traversal-attack.zip');
    assert.strictEqual(res.processed, 1);
    assert.strictEqual(res.failed, 2);
    assert.strictEqual(res.files[0].originalFileName, 'safe-report.pdf');

    const failedErrors = res.failedFiles.map(f => f.error);
    assert.ok(failedErrors.some(e => e.includes('Zip Slip rejected')));
  });

  // TEST 8: ZIP containing duplicate filenames
  await test('8. ZIP containing duplicate filenames (Disambiguation & Path Preservation)', async () => {
    const zip = new AdmZip();
    zip.addFile('folderA/notes.txt', Buffer.from('Notes from Folder A'));
    zip.addFile('folderB/notes.txt', Buffer.from('Notes from Folder B'));
    zip.addFile('notes1.txt', Buffer.from('Root Notes 1'));
    zip.addFile('notes2.txt', Buffer.from('Root Notes 2 duplicate'));
    const entries = zip.getEntries();
    entries[2].entryName = 'notes.txt';
    entries[3].entryName = 'notes.txt';
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'duplicates.zip');
    assert.strictEqual(res.processed, 4);

    // Ensure all 4 files have unique relativePaths
    const relativePaths = res.files.map(f => f.relativePath);
    const uniquePaths = new Set(relativePaths);
    assert.strictEqual(uniquePaths.size, 4, 'All duplicate entries must receive disambiguated unique paths');
  });

  // TEST 9: ZIP where one file fails but others succeed
  await test('9. ZIP where one file fails but others succeed (Partial Batch Resilience)', async () => {
    const zip = new AdmZip();
    zip.addFile('valid-doc1.pdf', MOCK_PDF_BUFFER);
    zip.addFile('valid-doc2.txt', MOCK_TXT_BUFFER);
    zip.addFile('failing.pdf', MOCK_PDF_BUFFER);
    const entries = zip.getEntries();
    entries[2].entryName = '../../escaped.pdf';
    const buffer = zip.toBuffer();

    const res = await validateAndExtractZip(buffer, 'partial-success.zip');
    assert.strictEqual(res.totalFiles, 3);
    assert.strictEqual(res.processed, 2);
    assert.strictEqual(res.failed, 1);

    const processedNames = res.files.map(f => f.originalFileName);
    assert.ok(processedNames.includes('valid-doc1.pdf'));
    assert.ok(processedNames.includes('valid-doc2.txt'));
  });

  // TEST 10: Normal non-ZIP upload regression test
  await test('10. Normal non-ZIP upload regression test', async () => {
    // Verify direct file detection
    const pdfType = detectFileType('quarterly-report.pdf');
    assert.strictEqual(pdfType.fileType, 'PDF');
    assert.strictEqual(pdfType.isSupported, true);
    assert.strictEqual(pdfType.isImage, false);

    const imgType = detectFileType('site-inspection.png');
    assert.strictEqual(imgType.fileType, 'IMAGE');
    assert.strictEqual(imgType.isSupported, true);
    assert.strictEqual(imgType.isImage, true);
    assert.strictEqual(imgType.mimeType, 'image/png');

    // Verify standalone chunking
    const chunks = createDocumentChunks({
      fullText: 'Section 1: Facility Status. Section 2: Security Assessment.',
      documentId: 'doc_standalone_123',
      userId: 'user_456',
      fileName: 'quarterly-report.pdf',
    });
    assert.ok(chunks.length > 0);
    assert.strictEqual(chunks[0].fileName, 'quarterly-report.pdf');
    assert.strictEqual(chunks[0].archiveName, null);
    assert.strictEqual(chunks[0].relativePath, null);

    // Verify standalone citation generation
    const standalonePrompt = buildGroundedPrompt({
      question: 'What is the facility status?',
      contextChunks: [
        {
          fileName: 'quarterly-report.pdf',
          chunkText: 'The facility status is active and nominal.',
          pageNumber: 1,
          isImage: false,
        },
      ],
    });
    assert.ok(standalonePrompt.userPrompt.includes('[Doc: quarterly-report.pdf | Page 1]'));
  });

  // BONUS TEST: End-to-End Traceable ZIP Citations Test
  await test('Bonus: Traceable Citation Generation for Extracted ZIP Files', async () => {
    // 1. Test chunks created with archive metadata
    const zipChunks = createDocumentChunks({
      fullText: 'Discrepancy observed in cargo container AE-7785.',
      documentId: 'doc_zip_789',
      userId: 'user_456',
      fileName: 'incident-report.pdf',
      archiveName: 'investigation.zip',
      relativePath: 'reports/finance/incident-report.pdf',
    });
    assert.strictEqual(zipChunks[0].archiveName, 'investigation.zip');
    assert.strictEqual(zipChunks[0].relativePath, 'reports/finance/incident-report.pdf');

    // 2. Test prompt citation builder formats archive paths
    const groundedPrompt = buildGroundedPrompt({
      question: 'Where was cargo AE-7785 located?',
      contextChunks: [
        {
          fileName: 'incident-report.pdf',
          archiveName: 'investigation.zip',
          relativePath: 'reports/finance/incident-report.pdf',
          chunkText: 'Cargo container AE-7785 was located in dock bay 4.',
          pageNumber: 3,
          isImage: false,
        },
        {
          fileName: 'harbor-map.png',
          archiveName: 'investigation.zip',
          relativePath: 'evidence/harbor-map.png',
          chunkText: 'Map depicts primary route from Northreach to Blackridge.',
          pageNumber: 1,
          isImage: true,
        }
      ],
    });

    assert.ok(
      groundedPrompt.userPrompt.includes('[Doc: investigation.zip/reports/finance/incident-report.pdf | Page 3]'),
      'Prompt must contain structured archive document citation'
    );
    assert.ok(
      groundedPrompt.userPrompt.includes('[Image: investigation.zip/evidence/harbor-map.png | Visual Evidence]'),
      'Prompt must contain structured archive image citation'
    );
  });

  console.log('\n================================================================');
  console.log(`🎯 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
