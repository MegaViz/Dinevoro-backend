import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const salesLeadSchema = new Schema(
  {
    contactName: { type: String, required: true },
    businessName: { type: String, required: true },
    phone: { type: String, required: true },
    software: { type: String, default: "" },
    renewalDate: { type: String, default: "" },
    renewalSoon: { type: Boolean, default: false },
    interest: {
      type: String,
      enum: ["Hot", "Warm", "Cold", "Converted"],
      default: "Warm",
    },
    assignedTo: { type: String, required: true },
    assignedInitials: { type: String, default: "" },
    notes: { type: String, default: "" },
    lastContactAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type SalesLeadDoc = InferSchemaType<typeof salesLeadSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default models.SalesLead || model("SalesLead", salesLeadSchema);
