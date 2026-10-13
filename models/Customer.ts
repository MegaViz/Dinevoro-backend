import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const customerSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    totalVisits: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    loyaltyPointsRedeemed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: mongoose.Types.ObjectId };

export default models.Customer || model("Customer", customerSchema);
