import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const platformTeamMemberSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    roleName: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    initials: { type: String, default: "" },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type PlatformTeamMemberDoc = InferSchemaType<typeof platformTeamMemberSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.PlatformTeamMember || model("PlatformTeamMember", platformTeamMemberSchema);
