import type { Types } from 'mongoose';

export interface DocumentWithId {
  readonly _id: Types.ObjectId | string;
}

export const getDocumentId = (document: DocumentWithId): string => document._id.toString();
