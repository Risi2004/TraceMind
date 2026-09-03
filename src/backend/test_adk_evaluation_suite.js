import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Document from './models/Document.js';
import { processDocumentForRag } from './services/ingestion.service.js';
import { executeAdkInvestigation } from './agents/adkOrchestrator.js';
import { deleteDocumentVectors } from './services/qdrant.service.js';

dotenv.config();

/**
 * TraceMind Google ADK Multi-Scenario Evaluation & Reliability Benchmark
 * Tests 5 Core Evaluation Cases:
 * 1. Simple question requiring one source (Single-round pass)
 * 2. Question requiring information across multiple documents (Multi-document synthesis)
 * 3. Question requiring multiple search rounds (Missing detail triggering Follow-up search)
 * 4. Conflicting information between documents (Conflict Agent detection & disclosure)
 * 5. Question with insufficient evidence (Cleanly admits lack of evidence without hallucination)
 */

async function runEvaluationBenchmark() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 TRACEMIND AGENTIC RAG (GOOGLE ADK) EVALUATION & RELIABILITY TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const testUser = await User.create({
    name: 'Evaluation Suite Tester',
    email: `eval_test_${Date.now()}@example.com`,
    password: 'Password@123',
    isEmailVerified: true,
  });

  const createdDocs = [];

  // Helper to ingest test documents into Qdrant
  const ingestDoc = async (title, filename, content) => {
    const docId = new mongoose.Types.ObjectId();
    const docRecord = await Document.create({
      _id: docId,
      userId: testUser._id,
      title,
      filename,
      originalName: filename,
      fileType: 'MD',
      sizeBytes: Buffer.byteLength(content),
      r2Key: `users/${testUser._id}/documents/${docId}/${filename}`,
      status: 'uploaded',
    });
    createdDocs.push(docRecord);

    await processDocumentForRag({
      documentId: docId,
      userId: testUser._id,
      buffer: Buffer.from(content),
      filename,
      fileType: 'MD',
    });
    return docRecord;
  };

  try {
    console.log('📦 Ingesting Multi-Scenario Benchmark Documents...');

    // Document A: Primary Exam Timetable
    const docA = await ingestDoc(
      'SLIIT Exam Timetable Malabe 2026',
      'SLIIT_Exam_Timetable_2026.md',
      `# SLIIT Examination Schedule - Semester 1, 2026
## Module Timetable
- Software Architecture (IE3010): 29th August 2026, 09:00 AM - 11:00 AM in Examination Hall 301.
- Cloud Computing (IT3040): 31st August 2026, 01:00 PM - 03:00 PM in Computer Lab 04.
- Deep Learning (AI3080): 02nd September 2026, 09:00 AM - 11:00 AM in Main Auditorium.`
    );

    // Document B: Hall Regulations & Equipment
    const docB = await ingestDoc(
      'Examination Hall Regulations 2026',
      'Exam_Hall_Regulations_2026.md',
      `# SLIIT Examination Hall Regulations & Required Items
## Mandatory Candidate Items
All registered students entering examination halls must present:
1. Valid SLIIT Student Identity Card.
2. Official Examination Admission Slip signed by the registrar.
3. Permitted Stationery: Non-programmable scientific calculator only for AI3080.`
    );

    // Document C: Rescheduled Emergency Notice (Conflicting with Doc A for Cloud Computing)
    const docC = await ingestDoc(
      'Urgent Amendment: Cloud Computing Exam Rescheduled',
      'Urgent_Rescheduled_CloudComputing_Notice_Final.md',
      `# Official Examination Amendment Notice - Urgent Update
## Cloud Computing (IT3040) Rescheduling
Due to scheduled server maintenance in Lab 04, the Cloud Computing (IT3040) examination previously set for 31st August 2026 has been officially rescheduled to 05th September 2026, from 09:00 AM to 11:00 AM in Examination Hall 502.`
    );

    console.log('✅ Ingested 3 test documents into Qdrant Cloud successfully.\n');

    // ---------------------------------------------------------------------------------
    // TEST CASE 1: Simple Question Requiring One Source
    // ---------------------------------------------------------------------------------
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log('🧪 TEST CASE 1: Simple Question (Single Document Scope)');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const res1 = await executeAdkInvestigation({
      query: 'When is the Software Architecture exam scheduled?',
      userId: testUser._id,
      documentId: docA._id,
      maxRounds: 4,
    });
    console.log(`\n📋 Case 1 Result:`);
    console.log(`- Rounds: ${res1.roundsCount}`);
    console.log(`- Sources Used: ${res1.sources.length}`);
    console.log(`- Answer: ${res1.answer.slice(0, 150)}...`);
    console.log(`- Assessment: ${res1.roundsCount === 1 ? '✅ PASS (Resolved in Round 1)' : '⚠️ MULTI-ROUND'}`);

    // ---------------------------------------------------------------------------------
    // TEST CASE 2: Multi-Document Synthesis
    // ---------------------------------------------------------------------------------
    console.log('\n─────────────────────────────────────────────────────────────────────────────');
    console.log('🧪 TEST CASE 2: Question Requiring Information Across Multiple Documents');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const res2 = await executeAdkInvestigation({
      query: 'When is the Deep Learning exam, and what mandatory items must I bring to the hall?',
      userId: testUser._id,
      maxRounds: 4,
    });
    console.log(`\n📋 Case 2 Result:`);
    console.log(`- Rounds: ${res2.roundsCount}`);
    console.log(`- Sources Used: ${res2.sources.length}`);
    console.log(`- Documents Cited: ${[...new Set(res2.sources.map(s => s.fileName))].join(', ')}`);
    console.log(`- Answer: ${res2.answer.slice(0, 180)}...`);
    console.log(`- Assessment: ${res2.sources.length >= 2 ? '✅ PASS (Cross-Document Evidence Synthesized)' : '⚠️ SINGLE-SOURCE'}`);

    // ---------------------------------------------------------------------------------
    // TEST CASE 3: Multi-Round Iterative Search
    // ---------------------------------------------------------------------------------
    console.log('\n─────────────────────────────────────────────────────────────────────────────');
    console.log('🧪 TEST CASE 3: Multi-Part Query Requiring Iterative Search Follow-Up');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const res3 = await executeAdkInvestigation({
      query: 'Find the time for Software Architecture and also find the rules for permitted calculators.',
      userId: testUser._id,
      maxRounds: 4,
    });
    console.log(`\n📋 Case 3 Result:`);
    console.log(`- Rounds: ${res3.roundsCount}`);
    console.log(`- Total Evidence Chunks: ${res3.totalEvidenceChunks}`);
    console.log(`- Assessment: ${res3.totalEvidenceChunks >= 2 ? '✅ PASS (Iterative Follow-Up Succeeded)' : '⚠️ INCOMPLETE'}`);

    // ---------------------------------------------------------------------------------
    // TEST CASE 4: Conflicting Information Between Documents
    // ---------------------------------------------------------------------------------
    console.log('\n─────────────────────────────────────────────────────────────────────────────');
    console.log('🧪 TEST CASE 4: Conflicting Information Across Two Documents');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const res4 = await executeAdkInvestigation({
      query: 'What date and location is the Cloud Computing (IT3040) exam scheduled for?',
      userId: testUser._id,
      maxRounds: 4,
    });
    console.log(`\n📋 Case 4 Result:`);
    console.log(`- Conflict Detected: ${res4.conflictDetected ? '✅ YES (Discrepancy Caught)' : '❌ NO'}`);
    if (res4.conflictReport) {
      console.log(`- Conflict Assessment: ${res4.conflictReport.assessment}`);
    }
    console.log(`- Answer: ${res4.answer.slice(0, 220)}...`);
    console.log(`- Assessment: ${res4.conflictDetected ? '✅ PASS (Conflict Reported & Cited)' : '⚠️ CONFLICT MISSED'}`);

    // ---------------------------------------------------------------------------------
    // TEST CASE 5: Insufficient Evidence Handling
    // ---------------------------------------------------------------------------------
    console.log('\n─────────────────────────────────────────────────────────────────────────────');
    console.log('🧪 TEST CASE 5: Question with Insufficient Evidence (Out of Scope)');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const res5 = await executeAdkInvestigation({
      query: 'What is the bus shuttle schedule from Kandy to Colombo campus for graduation?',
      userId: testUser._id,
      maxRounds: 4,
    });
    console.log(`\n📋 Case 5 Result:`);
    console.log(`- Rounds Reached: ${res5.roundsCount}`);
    console.log(`- Answer: ${res5.answer}`);
    const mentionsInsufficient = res5.answer.toLowerCase().includes('not enough information') || res5.answer.toLowerCase().includes('not contain') || res5.answer.toLowerCase().includes('no document evidence');
    console.log(`- Assessment: ${mentionsInsufficient ? '✅ PASS (Grounded Anti-Hallucination Verified)' : '⚠️ HALLUCINATION RISK'}`);

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 5 EVALUATION TEST BENCHMARK CASES COMPLETED!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  } finally {
    // Cleanup test data
    console.log('🧹 Cleaning up benchmark vectors & database records...');
    for (const doc of createdDocs) {
      await deleteDocumentVectors(doc._id).catch(() => {});
      await doc.deleteOne().catch(() => {});
    }
    await testUser.deleteOne().catch(() => {});
    await mongoose.disconnect();
    console.log('✨ Cleanup complete.');
  }
}

runEvaluationBenchmark().catch(err => {
  console.error('❌ Evaluation suite error:', err);
  process.exit(1);
});
