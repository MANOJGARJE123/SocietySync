const path = require('path');
const fs = require('fs');
const complaintService = require('../services/complaint.service');
const AppError = require('../utils/AppError');

const complaintController = {
  async createComplaint(req, res) {
    const imageUrl = req.file ? `/uploads/complaints/${req.file.filename}` : undefined;
    const complaint = await complaintService.createComplaint(
      req.body, req.user._id, imageUrl, req.user.societyId
    );
    return res.status(201).json({ success: true, message: 'Complaint created', data: complaint });
  },
  async getAllComplaints(req, res) {
    return res.status(200).json({ success: true, data: await complaintService.getAllComplaints(req.user) });
  },
  async getMyComplaints(req, res) {
    return res.status(200).json({ success: true, data: await complaintService.getMyComplaints(req.user._id) });
  },
  async updateComplaintStatus(req, res) {
    const data = await complaintService.updateComplaintStatus(req.params.id, req.body.status, req.user);
    return res.status(200).json({ success: true, message: 'Complaint updated', data });
  },
  async editComplaint(req, res) {
    const data = await complaintService.editComplaint(req.params.id, req.body, req.user._id);
    return res.status(200).json({ success: true, message: 'Complaint updated', data });
  },
  async deleteComplaint(req, res) {
    const data = await complaintService.deleteComplaint(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Complaint deleted', data });
  },
  // Serve attachment with auth check
  async serveAttachment(req, res) {
    const filename = req.params.filename;
    if (!filename || filename.includes('..') || filename.includes('/'))
      throw new AppError('Invalid filename', 400);
    const filePath = path.join(__dirname, '../../uploads/complaints', filename);
    if (!fs.existsSync(filePath)) throw new AppError('File not found', 404);
    return res.sendFile(filePath);
  },
};
module.exports = complaintController;
