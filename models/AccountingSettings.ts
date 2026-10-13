import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const integrationStateSchema = new Schema(
  {
    connected: { type: Boolean, default: false },
    lastSyncAt: { type: Date },
  },
  { _id: false },
);

const accountingSettingsSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, unique: true, index: true },
    filedGstPeriods: { type: [String], default: [] },
    integrations: {
      tally: { type: integrationStateSchema, default: () => ({ connected: false }) },
      quickbooks: { type: integrationStateSchema, default: () => ({ connected: false }) },
      zoho: { type: integrationStateSchema, default: () => ({ connected: true }) },
      bank: { type: integrationStateSchema, default: () => ({ connected: true }) },
    },
  },
  { timestamps: true },
);

export type AccountingSettingsDoc = InferSchemaType<typeof accountingSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.AccountingSettings || model("AccountingSettings", accountingSettingsSchema);
