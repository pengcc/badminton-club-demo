import { Document, Types } from 'mongoose';
import { Domain } from '@club/shared-types/domain/pdf';

/**
 * Persistence layer types for PDF documents
 */
export namespace Persistence {
  export interface PdfDocument extends Document {
    _id: Types.ObjectId;
    filename: string;
    contentType: 'application/pdf';
    content: Uint8Array;
    metadata: Domain.PdfMetadata;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface PdfTemplate extends Document {
    _id: Types.ObjectId;
    name: string;
    content: string;
    description?: string;
    version: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface PdfModel {
    findByName(name: string): Promise<PdfTemplate | null>;
    findLatestVersion(name: string): Promise<PdfTemplate | null>;
    createDocument(doc: Partial<PdfDocument>): Promise<PdfDocument>;
  }
}
