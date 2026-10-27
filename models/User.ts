import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["Owner", "Manager", "Cashier", "Kitchen Staff", "SuperAdmin"],
      default: "Owner",
    },
    subscriptionEndsAt: {type: Date},
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    /** Staff accounts can be switched off by the owner without deleting them. */
    active: { type: Boolean, default: true },
    passwordResetRequestedAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export default models.User || model("User", userSchema);
