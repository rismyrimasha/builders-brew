import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    points_cost: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['menu_item', 'cash_credit'], required: true },
    linked_menu_item_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    cash_value: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Reward = mongoose.model('Reward', rewardSchema);
