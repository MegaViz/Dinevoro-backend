import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const staffSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    shift: { type: String, enum: ["Morning", "Evening"], default: "Morning" },
    status: { type: String, enum: ["Present", "Late", "Absent", "Off Duty"], default: "Absent" },
    checkIn: { type: String, trim: true, default: "" },
    checkOut: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type StaffDoc = InferSchemaType<typeof staffSchema> & { _id: mongoose.Types.ObjectId };

export default models.Staff || model("Staff", staffSchema);
