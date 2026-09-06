import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    /** Optional — customers no longer log in; staff manage membership. */
    pin_hash: { type: String, default: null },
    sms_opt_out: { type: Boolean, default: false },
    sms_opt_out_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Customer = mongoose.model('Customer', customerSchema);
