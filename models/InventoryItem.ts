import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const inventoryItemSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, required: true, default: 10 },
  },
  { timestamps: true },
);

export type InventoryItemDoc = InferSchemaType<typeof inventoryItemSchema> & { _id: mongoose.Types.ObjectId };

export default models.InventoryItem || model("InventoryItem", inventoryItemSchema);
