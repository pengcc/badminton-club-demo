import { z } from 'zod';

/**
 * View layer interfaces for PDF documents
 */
export interface PdfDocumentView {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  fileSize: number;
  contentType: string;
  pageCount?: number;
  status: 'draft' | 'published' | 'archived';
}

export interface PdfTemplateView {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  variables: PdfTemplateVariableView[];
  defaultValues?: Record<string, string>;
  category?: string;
  version: string;
  status: 'active' | 'deprecated' | 'draft';
}

export interface PdfTemplateVariableView {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  description?: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Zod validation schemas for PDF view types
 */
export const pdfDocumentViewSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string().url(),
  fileSize: z.number().min(0),
  contentType: z.string(),
  pageCount: z.number().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived'])
});

export const pdfTemplateVariableViewSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'date', 'boolean']),
  description: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.string().optional()
});

export const pdfTemplateViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  variables: z.array(pdfTemplateVariableViewSchema),
  defaultValues: z.record(z.string(), z.string()).optional(),
  category: z.string().optional(),
  version: z.string(),
  status: z.enum(['active', 'deprecated', 'draft'])
});