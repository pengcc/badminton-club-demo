import type { Request, Response } from 'express';
import type { MembershipApplicationData, PersonalInfo, BankingInfo } from '../services/pdfService.js';
import { PDFService } from '../services/pdfService.js';
import { MembershipApplication } from '../models/MembershipApplication.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class PDFController {
  /**
   * Generate membership application PDF from form data
   * @route POST /api/pdf/membership-application
   * @access Public
   */
  static async generateMembershipApplicationPDF(req: Request, res: Response): Promise<void> {
    try {
      const applicationData: MembershipApplicationData = req.body;

      // Validate required fields
      if (!applicationData.personalInfo || !applicationData.membershipType) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: personalInfo and membershipType are required'
        });
        return;
      }

      // Validate personal info structure
      const { personalInfo } = applicationData;
      const requiredPersonalFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender'];
      const missingFields = requiredPersonalFields.filter(field => !personalInfo[field as keyof PersonalInfo]);

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required personal info fields: ${missingFields.join(', ')}`
        });
        return;
      }

      // Validate address structure
      if (!personalInfo.address || !personalInfo.address.street || !personalInfo.address.city || !personalInfo.address.postalCode || !personalInfo.address.country) {
        res.status(400).json({
          success: false,
          message: 'Missing required address fields: street, city, postalCode, and country are required'
        });
        return;
      }

      // Generate PDF
      const pdfBuffer = await PDFService.createMembershipApplicationPDF(applicationData);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${personalInfo.firstName}_${personalInfo.lastName}_Aufnahmeantrag_${timestamp}.pdf`;

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.status(200).send(pdfBuffer);
    } catch (error) {
      console.error('Error generating membership application PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate SEPA mandate PDF from form data
   * @route POST /api/pdf/sepa-mandate
   * @access Public
   */
  static async generateSEPAMandatePDF(req: Request, res: Response): Promise<void> {
    try {
      const { personalInfo, bankingInfo }: { personalInfo: PersonalInfo; bankingInfo: BankingInfo } = req.body;

      // Validate required fields
      if (!personalInfo || !bankingInfo) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: personalInfo and bankingInfo are required'
        });
        return;
      }

      // Validate personal info
      const requiredPersonalFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender'];
      const missingPersonalFields = requiredPersonalFields.filter(field => !personalInfo[field as keyof PersonalInfo]);

      if (missingPersonalFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required personal info fields: ${missingPersonalFields.join(', ')}`
        });
        return;
      }

      // Validate banking info
      const requiredBankingFields = ['accountHolder', 'iban', 'bankName', 'accountHolderAddress'];
      const missingBankingFields = requiredBankingFields.filter(field => !bankingInfo[field as keyof BankingInfo]);

      if (missingBankingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required banking info fields: ${missingBankingFields.join(', ')}`
        });
        return;
      }

      // Validate IBAN format (basic validation)
      const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
      if (!ibanRegex.test(bankingInfo.iban.replace(/\s+/g, ''))) {
        res.status(400).json({
          success: false,
          message: 'Invalid IBAN format'
        });
        return;
      }

      // Generate PDF
      const pdfBuffer = await PDFService.createSEPAMandatePDF(personalInfo, bankingInfo);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${personalInfo.firstName}_${personalInfo.lastName}_SEPA_Mandat_${timestamp}.pdf`;

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.status(200).send(pdfBuffer);
    } catch (error) {
      console.error('Error generating SEPA mandate PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate PDFs for existing membership application by ID
   * @route GET /api/pdf/membership-application/:id
   * @access Private/Admin
   */
  static async generatePDFsForApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type } = req.query; // 'application' or 'sepa' or 'both'

      // Find the membership application
      const application = await MembershipApplication.findById(id);
      if (!application || !application.isActive) {
        res.status(404).json({
          success: false,
          message: 'Membership application not found'
        });
        return;
      }

      // Transform database model to PDF service format
      const applicationData: MembershipApplicationData = {
        personalInfo: {
          firstName: application.personalInfo.firstName,
          lastName: application.personalInfo.lastName,
          email: application.personalInfo.email,
          phone: application.personalInfo.phone,
          dateOfBirth: application.personalInfo.dateOfBirth,
          gender: application.personalInfo.gender,
          address: application.personalInfo.address
        },
        membershipType: application.membershipType,
        motivation: application.motivation,
        bankingInfo: application.bankingInfo ? {
          accountHolder: application.bankingInfo.accountHolder,
          iban: application.bankingInfo.iban,
          bic: application.bankingInfo.bic,
          bankName: application.bankingInfo.bankName,
          accountHolderAddress: `${application.personalInfo.address.street}, ${application.personalInfo.address.postalCode} ${application.personalInfo.address.city}, ${application.personalInfo.address.country}`
        } : undefined
      };

      const timestamp = new Date().toISOString().slice(0, 10);
      const baseFilename = `${application.personalInfo.firstName}_${application.personalInfo.lastName}_${timestamp}`;

      switch (type) {
        case 'sepa':
          if (!application.bankingInfo) {
            res.status(400).json({
              success: false,
              message: 'No banking information available for SEPA mandate'
            });
            return;
          }

          const sepaPdfBuffer = await PDFService.createSEPAMandatePDF(
            applicationData.personalInfo,
            {
              accountHolder: application.bankingInfo.accountHolder,
              iban: application.bankingInfo.iban,
              bic: application.bankingInfo.bic,
              bankName: application.bankingInfo.bankName,
              accountHolderAddress: `${application.personalInfo.address.street}, ${application.personalInfo.address.postalCode} ${application.personalInfo.address.city}, ${application.personalInfo.address.country}`
            }
          );

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}_SEPA_Mandat.pdf"`);
          res.setHeader('Content-Length', sepaPdfBuffer.length);
          res.status(200).send(sepaPdfBuffer);
          break;

        case 'application':
        default:
          const applicationPdfBuffer = await PDFService.createMembershipApplicationPDF(applicationData);

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}_Aufnahmeantrag.pdf"`);
          res.setHeader('Content-Length', applicationPdfBuffer.length);
          res.status(200).send(applicationPdfBuffer);
          break;
      }
    } catch (error) {
      console.error('Error generating PDF for application:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate combined PDF package (both application and SEPA)
   * @route POST /api/pdf/membership-package
   * @access Public
   */
  static async generateMembershipPackage(req: Request, res: Response): Promise<void> {
    try {
      const applicationData: MembershipApplicationData = req.body;

      // Validate that both application and banking info are present
      if (!applicationData.personalInfo || !applicationData.bankingInfo) {
        res.status(400).json({
          success: false,
          message: 'Both personal and banking information are required for membership package'
        });
        return;
      }

      // Generate both PDFs
      const [applicationPdfBuffer, _sepaPdfBuffer] = await Promise.all([
        PDFService.createMembershipApplicationPDF(applicationData),
        PDFService.createSEPAMandatePDF(applicationData.personalInfo, applicationData.bankingInfo)
      ]);

      // For now, we'll return the application PDF as the primary document
      // In the future, you might want to combine them into a single PDF or create a ZIP file
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${applicationData.personalInfo.firstName}_${applicationData.personalInfo.lastName}_Mitgliedschaftspaket_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', applicationPdfBuffer.length);

      // Return application PDF (could be enhanced to combine both PDFs)
      res.status(200).send(applicationPdfBuffer);
    } catch (error) {
      console.error('Error generating membership package:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate membership package'
      });
    }
  }
}