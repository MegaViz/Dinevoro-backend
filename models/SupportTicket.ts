import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const supportTicketSchema = new Schema(
  {
    ticketNo: { type: String, required: true, unique: true },
    tenantName: { type: String, required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    issue: { type: String, required: true },
    status: { type: String, enum: ["Open", "In Progress", "Resolved"], default: "Open" },
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    response: { type: String, default: "" },
    assignedTo: { type: String, default: "" },
  },
  { timestamps: true },
);

export type SupportTicketDoc = InferSchemaType<typeof supportTicketSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default models.SupportTicket || model("SupportTicket", supportTicketSchema);
