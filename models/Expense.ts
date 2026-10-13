import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const expenseSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Raw Materials", "Fuel", "Payroll", "Utilities", "Operations", "Maintenance", "Other"],
      default: "Other",
    },
    paymentMode: { type: String, enum: ["Cash", "UPI", "Card", "Online", "Bank Transfer"], default: "Cash" },
    hasBill: { type: Boolean, default: false },
    billUrl: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & { _id: mongoose.Types.ObjectId };

export default models.Expense || model("Expense", expenseSchema);
