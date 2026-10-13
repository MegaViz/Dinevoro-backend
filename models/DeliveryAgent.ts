import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const deliveryAgentSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Idle", "Off Duty"], default: "Active" },
    todayRuns: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
  },
  { timestamps: true },
);

export type DeliveryAgentDoc = InferSchemaType<typeof deliveryAgentSchema> & { _id: mongoose.Types.ObjectId };

export default models.DeliveryAgent || model("DeliveryAgent", deliveryAgentSchema);
