import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const tableSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    number: { type: String, required: true, trim: true },
    seats: { type: Number, required: true, min: 1 },
    area: { type: String, enum: ["Indoor", "Outdoor", "Private"], default: "Indoor" },
    status: { type: String, enum: ["Available", "Occupied", "Reserved", "Billing"], default: "Available" },
    customerName: { type: String, default: "" },
    reservedAt: { type: String, default: "" },
    occupiedAt: { type: Date },
    currentOrder: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

tableSchema.index({ restaurant: 1, number: 1 }, { unique: true });

export type TableDoc = InferSchemaType<typeof tableSchema> & { _id: mongoose.Types.ObjectId };

export default models.Table || model("Table", tableSchema);
