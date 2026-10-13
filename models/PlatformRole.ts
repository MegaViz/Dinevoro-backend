import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

export const PLATFORM_PERMISSIONS = [
  "Dashboard",
  "Tenant Management",
  "Leads & CRM",
  "Reports & Analytics",
  "Support Tickets",
  "Billing & Subscriptions",
  "Module Management",
  "Platform Settings",
] as const;

const platformRoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type PlatformRoleDoc = InferSchemaType<typeof platformRoleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.PlatformRole || model("PlatformRole", platformRoleSchema);
