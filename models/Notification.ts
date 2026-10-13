import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const notificationSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, enum: ["Payments", "Customers", "Inventory", "System"], required: true },
    severity: { type: String, enum: ["warning", "info", "success"], default: "info" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & { _id: mongoose.Types.ObjectId };

export default models.Notification || model("Notification", notificationSchema);
