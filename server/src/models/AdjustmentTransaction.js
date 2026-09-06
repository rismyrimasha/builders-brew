import mongoose from 'mongoose';

const adjustmentTransactionSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    points_delta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const AdjustmentTransaction = mongoose.model(
  'AdjustmentTransaction',
  adjustmentTransactionSchema
);
