import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const stockEntrySchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    item: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    supplier: { type: String, default: "" },
    cost: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type StockEntryDoc = InferSchemaType<typeof stockEntrySchema> & { _id: mongoose.Types.ObjectId };

export default models.StockEntry || model("StockEntry", stockEntrySchema);
