import type { Router } from 'express';
import express from 'express';
import { PDFController } from '../controllers/pdfController';
import { protect, authorize } from '../middleware/auth';
import { ADMIN_ROLES } from '../utils/roles';
import { asyncHandler } from '../utils/controllerHelpers';

const router: Router = express.Router();

// Public routes for PDF generation from form data
// These are used when users submit the membership form

/**
 * Generate membership application PDF from form data
 * @route POST /api/pdf/membership-application
 * @access Public
 * @description Generate a membership application PDF from submitted form data
 */
router.post('/membership-application', PDFController.generateMembershipApplicationPDF);

/**
 * Generate SEPA mandate PDF from form data
 * @route POST /api/pdf/sepa-mandate
 * @access Public
 * @description Generate a SEPA direct debit mandate PDF from submitted banking information
 */
router.post('/sepa-mandate', PDFController.generateSEPAMandatePDF);

/**
 * Generate complete membership package (both application and SEPA PDFs)
 * @route POST /api/pdf/membership-package
 * @access Public
 * @description Generate both membership application and SEPA mandate PDFs
 */
router.post('/membership-package', PDFController.generateMembershipPackage);

// Protected routes for generating PDFs from existing applications
// These are used by admins to regenerate PDFs for stored applications

/**
 * Generate PDFs for existing membership application
 * @route GET /api/pdf/membership-application/:id
 * @access Private/Admin
 * @query type - 'application' (default) or 'sepa' to specify which PDF to generate
 * @description Generate PDFs from an existing membership application record
 */
router.get('/membership-application/:id', protect, authorize(ADMIN_ROLES), asyncHandler(async (req, res) => {
  await PDFController.generatePDFsForApplication(req, res);
}));

export default router;