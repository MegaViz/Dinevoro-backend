import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const attendanceDaySchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    date: { type: Date, required: true },
    present: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    attendancePct: { type: Number, default: 0 },
  },
  { timestamps: true },
);

attendanceDaySchema.index({ restaurant: 1, date: 1 }, { unique: true });

export type AttendanceDayDoc = InferSchemaType<typeof attendanceDaySchema> & { _id: mongoose.Types.ObjectId };

export default models.AttendanceDay || model("AttendanceDay", attendanceDaySchema);
