import { z } from 'zod';
import type { Domain } from '../../domain/pdf';
import { BaseTransformer } from './base';

// View layer interfaces
export interface PdfDocumentView {
  id: string;
  filename: string;
  contentType: 'application/pdf';
  metadata: PdfMetadataView;
}

export interface PdfMetadataView {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: string;
  modificationDate?: string;
  fileSize: number;
  pageCount: number;
}

export interface PdfTemplateView {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * View layer transformer for PDF data
 */
export class PdfTransformer extends BaseTransformer {
  public static readonly metadataViewSchema = z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    subject: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    creationDate: z.string().optional(),
    modificationDate: z.string().optional(),
    fileSize: z.number().min(0),
    pageCount: z.number().min(1)
  });

  public static readonly documentViewSchema = z.object({
    id: z.string().uuid(),
    filename: z.string(),
    contentType: z.literal('application/pdf'),
    metadata: this.metadataViewSchema
  });

  public static readonly templateViewSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    version: z.number().min(1),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
  });

  /**
   * Transform PDF document for frontend display
   */
  public static toDocumentView(doc: Domain.PdfDocument): PdfDocumentView {
    const view: PdfDocumentView = {
      id: doc.id,
      filename: doc.filename,
      contentType: doc.contentType,
      metadata: {
        title: doc.metadata.title,
        author: doc.metadata.author,
        subject: doc.metadata.subject,
        keywords: doc.metadata.keywords,
        creationDate: this.toDate(doc.metadata.creationDate),
        modificationDate: doc.metadata.modificationDate
          ? this.toDate(doc.metadata.modificationDate)
          : undefined,
        fileSize: doc.metadata.fileSize,
        pageCount: doc.metadata.pageCount
      }
    };

    return this.validate(view, this.documentViewSchema);
  }

  /**
   * Transform arrays of entities
   */
  public static toDocumentViews(docs: Domain.PdfDocument[]): PdfDocumentView[] {
    return docs.map(doc => this.toDocumentView(doc));
  }
}

// Type inference helpers
export type PdfDocumentViewType = z.infer<typeof PdfTransformer.documentViewSchema>;
export type PdfTemplateViewType = z.infer<typeof PdfTransformer.templateViewSchema>;
export type PdfMetadataViewType = z.infer<typeof PdfTransformer.metadataViewSchema>;