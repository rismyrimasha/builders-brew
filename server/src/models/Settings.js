import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    points_per_100: { type: Number, required: true, default: 1, min: 0 },
    minimum_spend: { type: Number, required: true, default: 100, min: 0 },
    redemption_code_expiry_minutes: { type: Number, required: true, default: 5, min: 1 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Settings = mongoose.model('Settings', settingsSchema);

export async function getSettings() {
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
  }
  return settings;
}
