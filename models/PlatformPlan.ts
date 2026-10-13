import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const platformPlanSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["ACTIVE", "COMING SOON"], default: "ACTIVE" },
    features: { type: [String], default: [] },
    modules: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type PlatformPlanDoc = InferSchemaType<typeof platformPlanSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.PlatformPlan || model("PlatformPlan", platformPlanSchema);
