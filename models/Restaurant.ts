import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const restaurantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    businessType: { type: String, required: true },
    city: { type: String, required: true },
    phone: { type: String, required: true },
    gstin: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: {
      type: String,
      enum: ["Basic", "Standard", "Premium", "Classic", "Advanced"],
      default: "Standard",
    },
    billingCycle: { type: String, enum: ["Monthly", "Annual"], default: "Monthly" },
    trialEndsAt: { type: Date, required: true },

    ownerName: { type: String, default: "" },
    email: { type: String, default: "" },
    fssai: { type: String, default: "" },
    state: { type: String, default: "" },
    address: { type: String, default: "" },
    logoUrl: { type: String, default: "" },

    gstEnabled: { type: Boolean, default: true },
    cgst: { type: Number, default: 2.5 },
    sgst: { type: Number, default: 2.5 },
    igst: { type: Number, default: 5 },
    gstInclusive: { type: Boolean, default: false },

    invoicePrefix: { type: String, default: "INV" },
    invoiceStartNumber: { type: Number, default: 1001 },
    invoiceFooterText: { type: String, default: "Thank you for dining with us!" },
    invoiceTerms: { type: String, default: "" },
    showLogoOnInvoice: { type: Boolean, default: true },
    digitalSignature: { type: Boolean, default: false },
    tenantStatus: {
      type: String,
      enum: ["Active", "Trial", "Inactive"],
      default: "Active",
    },
    enabledModules: {
      type: [String],
      default: () => ["Operations", "Billing", "Menu"],
    },
    tenantCode: { type: String, default: "" },
    /** When the owner accepted the Terms of Service and Privacy Policy at sign-up. */
    termsAcceptedAt: { type: Date },
    loyalty: {
      /** Rupees a customer spends to earn one point at the base tier. */
      spendPerPoint: { type: Number, default: 10 },
      /** Value of one point in rupees when redeemed. */
      pointValue: { type: Number, default: 1 },
      silverMin: { type: Number, default: 8000 },
      goldMin: { type: Number, default: 15000 },
      platinumMin: { type: Number, default: 30000 },
      silverMultiplier: { type: Number, default: 1.5 },
      goldMultiplier: { type: Number, default: 2 },
      platinumMultiplier: { type: Number, default: 3 },
    },
  },
  { timestamps: true },
);

export type RestaurantDoc = InferSchemaType<typeof restaurantSchema> & { _id: mongoose.Types.ObjectId };

export default models.Restaurant || model("Restaurant", restaurantSchema);
