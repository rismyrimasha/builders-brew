import mongoose from 'mongoose';

const messageLogSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    phone: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['order_earned', 'promo', 'redemption', 'system'],
      required: true,
      index: true,
    },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    earn_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EarnTransaction',
    },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    provider: { type: String, default: 'notify.lk' },
    error: { type: String, default: '' },
    provider_response: { type: String, default: '' },
    sent_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

messageLogSchema.index({ earn_transaction_id: 1 }, { unique: true, sparse: true });
messageLogSchema.index({ created_at: -1 });

export const MessageLog = mongoose.model('MessageLog', messageLogSchema);

