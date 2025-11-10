import { z } from 'zod';

/**
 * Core PDF domain types
 */
export namespace Domain {
  export interface PdfConfig {
    format?: 'A4' | 'A5' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    headerTemplate?: string;
    footerTemplate?: string;
  }

  export interface PdfGenerationOptions {
    config?: PdfConfig;
    template: string;
    data: Record<string, unknown>;
  }

  export interface PdfMetadata {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate: Date;
    modificationDate?: Date;
    fileSize: number;
    pageCount: number;
  }

  export interface PdfDocument {
    id: string;
    filename: string;
    contentType: 'application/pdf';
    content: Uint8Array;
    metadata: PdfMetadata;
  }
}

const configSchema = z.object({
  format: z.enum(['A4', 'A5', 'Letter']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  margins: z.object({
    top: z.number().min(0).optional(),
    right: z.number().min(0).optional(),
    bottom: z.number().min(0).optional(),
    left: z.number().min(0).optional()
  }).optional(),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional()
});

const metadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  creationDate: z.date(),
  modificationDate: z.date().optional(),
  fileSize: z.number().min(0),
  pageCount: z.number().min(1)
});

/**
 * Validation schemas for PDF generation
 */
export const PdfSchema = {
  config: configSchema,

  generationOptions: z.object({
    config: configSchema.optional(),
    template: z.string(),
    data: z.record(z.string(), z.unknown())
  }),

  metadata: metadataSchema,

  document: z.object({
    id: z.string().uuid(),
    filename: z.string(),
    contentType: z.literal('application/pdf'),
    content: z.instanceof(Uint8Array),
    metadata: metadataSchema
  })
};

/**
 * Type inference helpers
 */
export type PdfConfig = z.infer<typeof PdfSchema.config>;
export type PdfGenerationOptions = z.infer<typeof PdfSchema.generationOptions>;
export type PdfMetadata = z.infer<typeof PdfSchema.metadata>;
export type PdfDocument = z.infer<typeof PdfSchema.document>;