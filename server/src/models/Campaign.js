import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 621 },
    audience: { type: String, enum: ['all'], default: 'all' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
    status: {
      type: String,
      enum: ['draft', 'sending', 'sent', 'failed'],
      default: 'draft',
      index: true,
    },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    error: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

campaignSchema.index({ created_at: -1 });

export const Campaign = mongoose.model('Campaign', campaignSchema);
