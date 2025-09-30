/**
 * Document Repository - Simplified
 */

import { BaseRepository } from '../../infraestructure/mongo/baseRepository.js';
import { DocumentModel, type IDocument } from './documentEntity.js';

export class DocumentRepository extends BaseRepository<IDocument> {
  constructor() {
    super(DocumentModel);
  }

  async findByUserId(userId: string): Promise<IDocument[]> {
    return await DocumentModel.find({ uploadedBy: userId }).sort({ createdAt: -1 });
  }

  async findByUserIdPaginated(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ documents: IDocument[]; total: number }> {
    const [documents, total] = await Promise.all([
      DocumentModel.find({ uploadedBy: userId }).sort({ createdAt: -1 }).limit(limit).skip(offset),
      DocumentModel.countDocuments({ uploadedBy: userId })
    ]);

    return { documents, total };
  }
}
