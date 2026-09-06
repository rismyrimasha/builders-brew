import mongoose from 'mongoose';

const redemptionTransactionSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    reward_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
    points_spent: { type: Number, required: true, min: 1 },
    /** Audit ref — staff-direct redemptions use S-xxxxxx codes. */
    redemption_code: { type: String, required: true, unique: true, uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'cancelled'],
      default: 'completed',
      index: true,
    },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    expires_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const RedemptionTransaction = mongoose.model(
  'RedemptionTransaction',
  redemptionTransactionSchema
);
