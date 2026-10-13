import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const orderLineSchema = new Schema(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    gst: { type: Number, required: true },
    qty: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    billNo: { type: Number, required: true },
    table: { type: Schema.Types.ObjectId, ref: "Table" },
    tableOrNo: { type: String, default: "" },
    customerName: { type: String, default: "Walk-in" },
    items: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    mode: { type: String, enum: ["Cash", "UPI", "Card"], default: "Cash" },
    status: { type: String, enum: ["Paid", "Pending", "Refunded"], default: "Paid" },
    kitchenStatus: { type: String, enum: ["New", "Preparing", "Ready", "Served"], default: "New" },
    orderType: { type: String, enum: ["Dine-in", "Takeaway", "Online", "Parcel"], default: "Dine-in" },
    channel: { type: String, enum: ["POS", "QR", "Swiggy", "Zomato", "Website"], default: "POS", index: true },
    channelStatus: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    deliveryAgent: { type: Schema.Types.ObjectId, ref: "DeliveryAgent" },
    eta: { type: Number },
    externalId: { type: String, default: "" },
    priority: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: mongoose.Types.ObjectId };

export default models.Order || model("Order", orderSchema);
