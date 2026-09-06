import mongoose from 'mongoose';

const earnTransactionSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount_paid: { type: Number, required: true, min: 0 },
    points_earned: { type: Number, required: true, min: 0 },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
    order_ref: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

earnTransactionSchema.index({ created_at: -1 });

export const EarnTransaction = mongoose.model('EarnTransaction', earnTransactionSchema);
