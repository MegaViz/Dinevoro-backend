import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const menuItemSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    gst: { type: Number, required: true, default: 5 },
    foodType: { type: String, enum: ["Veg", "Non-Veg"], default: "Veg" },
    available: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type MenuItemDoc = InferSchemaType<typeof menuItemSchema> & { _id: mongoose.Types.ObjectId };

export default models.MenuItem || model("MenuItem", menuItemSchema);
