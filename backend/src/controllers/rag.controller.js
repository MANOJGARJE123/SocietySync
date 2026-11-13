const ragService = require('../services/rag.service');
const AppError = require('../utils/AppError');

// Controller layer: handles HTTP req/res only and delegates to service layer.
const ragController = {
  async uploadPdf(req, res) {
    const file = req.file;

    if (!file) {
      throw new AppError('PDF file is required under field name "file"', 400);
    }

    const result = await ragService.uploadPdfAndIndex(file.buffer);

    return res.status(201).json({
      success: true,
      message: 'PDF processed and indexed successfully',
      data: result
    });
  },

  async queryRag(req, res) {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new AppError('Question is required in request body', 400);
    }

    const result = await ragService.answerQuestion(question, req.user);

    return res.status(200).json({
      success: true,
      data: result
    });
  }
};

module.exports = ragController;
