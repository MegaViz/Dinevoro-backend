import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const subscriptionEventSchema = new Schema(
  {
    restaurantName: { type: String, required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    event: { type: String, required: true },
    plan: { type: String, required: true },
    amount: { type: String, default: "—" },
    tone: { type: String, enum: ["success", "info", "danger", "warning"], default: "info" },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type SubscriptionEventDoc = InferSchemaType<typeof subscriptionEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.SubscriptionEvent || model("SubscriptionEvent", subscriptionEventSchema);
