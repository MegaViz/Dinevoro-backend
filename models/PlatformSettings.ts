import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const platformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    platformName: { type: String, default: "Dinevor" },
    companyName: { type: String, default: "Dinevor Technologies Pvt. Ltd." },
    supportEmail: { type: String, default: "support@dinevor.in" },
    billingContact: { type: String, default: "billing@dinevor.in" },
    gstNumber: { type: String, default: "27AABCD1234F1Z8" },
    notifications: {
      newTenantRegistrations: { type: Boolean, default: true },
      trialExpiryAlerts: { type: Boolean, default: true },
      paymentFailures: { type: Boolean, default: true },
      supportTicketAlerts: { type: Boolean, default: false },
      monthlyRevenueReport: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type PlatformSettingsDoc = InferSchemaType<typeof platformSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.PlatformSettings || model("PlatformSettings", platformSettingsSchema);
