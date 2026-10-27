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

const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    mode: { type: String, enum: ["Cash", "UPI", "Card"], required: true },
    paidAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    billNo: { type: Number, required: true },
    /** Full invoice number (prefix + bill number) fixed when the bill is issued. */
    invoiceNo: { type: String, default: "" },
    table: { type: Schema.Types.ObjectId, ref: "Table" },
    tableOrNo: { type: String, default: "" },
    customerName: { type: String, default: "Walk-in" },
    items: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    /** True when line prices already include GST (subtotal is the taxable value). */
    gstInclusive: { type: Boolean, default: false },
    amountPaid: { type: Number, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    /** Whether this bill has been added to the customer's visits/spend (and so loyalty points). No default: older bills predate tracking. */
    customerCredited: { type: Boolean },
    refundedAt: { type: Date },
    /** Money returned to the customer; a part refund keeps the bill Paid with the rest kept as revenue. */
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: "" },
    voidedAt: { type: Date },
    voidReason: { type: String, default: "" },
    /** Recipe ingredients for this bill have been taken out of stock. */
    stockDeducted: { type: Boolean, default: false },
    mode: { type: String, enum: ["Cash", "UPI", "Card"], default: "Cash" },
    status: { type: String, enum: ["Paid", "Pending", "Refunded", "Void"], default: "Paid" },
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
