const fs = require('fs/promises');
const path = require('path');
const { connectDatabase, closeDatabase } = require('../src/config/db');
const ragService = require('../src/services/rag.service');

const testDataDir = path.join(__dirname, '../test-data');

const findFirstPdf = async () => {
  const entries = await fs.readdir(testDataDir, { withFileTypes: true });
  const pdf = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'));
  return pdf ? path.join(testDataDir, pdf.name) : null;
};

const resolvePdfPath = async (inputPath) => {
  if (inputPath) {
    return path.resolve(process.cwd(), inputPath);
  }

  return findFirstPdf();
};

const run = async () => {
  const pdfPath = await resolvePdfPath(process.argv[2]);

  try {
    await connectDatabase();
    if (!pdfPath) {
      throw new Error('No PDF found in test-data folder. Pass a PDF path to seed.');
    }
    const pdfBuffer = await fs.readFile(pdfPath);
    const result = await ragService.uploadPdfAndIndex(pdfBuffer);
    console.log(`RAG seed complete. Inserted ${result.insertedCount} chunks from ${pdfPath}`);
  } catch (error) {
    console.error('RAG seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
};

run();
