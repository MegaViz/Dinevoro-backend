import { z } from "zod";

/** Currency amount in rupees with at most 2 decimal places (paise), stored rounded to paise. */
function money(label: string) {
  return z.coerce
    .number({ error: `${label} must be a number` })
    .refine((v) => Number.isFinite(v) && Math.abs(Math.round(v * 100) - v * 100) < 1e-6, {
      message: `${label} can have at most 2 decimal places`,
    })
    .transform((v) => Math.round(v * 100) / 100);
}

/** Quantity that may be fractional (e.g. 2.5 kg), up to 3 decimal places. */
function quantity(label: string) {
  return z.coerce
    .number({ error: `${label} must be a number` })
    .refine((v) => Number.isFinite(v) && Math.abs(Math.round(v * 1000) - v * 1000) < 1e-6, {
      message: `${label} can have at most 3 decimal places`,
    });
}

/** Free text shown back to users. HTML markup is rejected so it can never reach invoices, exports or messages. */
function plainText(label: string) {
  return z
    .string()
    .trim()
    .refine((v) => !/<[^>]*>|<\/?[a-z!]/i.test(v), { message: `${label} cannot contain HTML tags` });
}

export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export const MENU_CATEGORIES = ["Starters", "Main Course", "Breads", "Biryani", "Beverages", "Desserts", "Accompaniments"];

const gstSlab = z.coerce
  .number({ error: "GST must be a number" })
  .refine((v) => (GST_SLABS as readonly number[]).includes(v), { message: "GST must be one of 0, 5, 12, 18 or 28%" });

/** 15-character GSTIN: state code, PAN, entity number, 'Z', check character. */
export const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Keeps only the fields the client actually sent. Partial schemas still fill in defaults
 * (e.g. email ""), which must not overwrite saved values on an update.
 */
export function onlyProvided<T extends Record<string, unknown>>(data: T, body: unknown): Partial<T> {
  const sent = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return Object.fromEntries(Object.entries(data).filter(([key]) => sent[key] !== undefined)) as Partial<T>;
}

export const registerSchema = z.object({
  fullName: plainText("Full name").pipe(z.string().min(2, "Full name is too short")),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  restaurantName: plainText("Restaurant name").pipe(z.string().min(2, "Restaurant name is too short")),
  businessType: z.string().trim().min(1, "Select a business type"),
  city: z.string().trim().min(1, "City is required"),
  phone: z
    .string()
    .trim()
    .refine((v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), { message: "Enter a valid 10-digit mobile number" }),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GSTIN_PATTERN.test(v), { message: "Enter a valid 15-character GSTIN" })
    .optional()
    .default(""),
  plan: z.enum(["Basic", "Standard", "Premium", "Classic", "Advanced"]).default("Classic"),
  billingCycle: z.enum(["Monthly", "Annual"]).default("Monthly"),
  // The website signup sends acceptTerms: true once the checkbox is ticked. Older cached copies of the
  // site have no checkbox and omit the field, so only an explicit "false" is rejected.
  acceptTerms: z
    .boolean()
    .optional()
    .refine((v) => v !== false, { message: "Accept the Terms of Service and Privacy Policy to create an account" }),
});

export const SubscriptionSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid admin email"),
  restaurantEmail: z.string().trim().toLowerCase().email("Enter a valid restaurant email"),
  subscriptionEndsAt: z.coerce.date({error: "Enter a valid subscription end date"}),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const menuItemSchema = z.object({
  name: plainText("Item name").pipe(z.string().min(1, "Item name is required")),
  category: z.string().trim().min(1, "Category is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  gst: gstSlab.default(5),
  foodType: z.enum(["Veg", "Non-Veg"]).default("Veg"),
  available: z.coerce.boolean().default(true),
});

/** Partial update must NOT re-apply defaults (e.g. gst:5) when fields are omitted. */
export const menuItemUpdateSchema = z.object({
  name: plainText("Item name").pipe(z.string().min(1, "Item name is required")).optional(),
  category: z.string().trim().min(1, "Category is required").optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  gst: gstSlab.optional(),
  foodType: z.enum(["Veg", "Non-Veg"]).optional(),
  available: z.coerce.boolean().optional(),
});

const objectId = /^[0-9a-f]{24}$/i;

const orderLineInput = z.object({
  menuItemId: z
    .string()
    .optional()
    .transform((v) => (v && objectId.test(v) ? v : undefined)),
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  gst: z.coerce.number().min(0),
  qty: z.coerce.number().min(1),
});

export const orderSchema = z.object({
  tableId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || objectId.test(v), { message: "Unknown table" }),
  tableOrNo: z.string().trim().optional().default(""),
  customerName: plainText("Customer name").optional().default("Walk-in"),
  /** Links the bill to a CRM customer (matched by phone, created if new). */
  customerPhone: z.string().trim().optional().default(""),
  items: z.array(orderLineInput).min(1, "Add at least one item"),
  mode: z.enum(["Cash", "UPI", "Card"]).default("Cash"),
  status: z.enum(["Paid", "Pending", "Refunded"]).default("Paid"),
  kitchenStatus: z.enum(["New", "Preparing", "Ready", "Served"]).optional(),
  orderType: z.enum(["Dine-in", "Takeaway", "Online", "Parcel"]).default("Dine-in"),
  priority: z.coerce.boolean().default(false),
  notes: z.string().trim().optional().default(""),
  createdAt: z.string().trim().optional(),
});

export const orderUpdateSchema = z.object({
  status: z.enum(["Paid", "Pending", "Refunded", "Void"]).optional(),
  /** Refund amount; omit to refund everything received. */
  refundAmount: money("Refund amount").refine((v) => v > 0, { message: "Refund amount must be greater than 0" }).optional(),
  /** Required for refunds and voids, kept for the audit trail. */
  reason: plainText("Reason").optional(),
  /** Amount received now. Omit to collect the full outstanding balance. */
  amount: money("Amount").refine((v) => v > 0, { message: "Amount must be greater than 0" }).optional(),
  kitchenStatus: z.enum(["New", "Preparing", "Ready", "Served"]).optional(),
  mode: z.enum(["Cash", "UPI", "Card"]).optional(),
  channelStatus: z.string().trim().optional(),
  deliveryAgentId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || objectId.test(v), { message: "Unknown delivery agent" }),
  eta: z.coerce.number().optional(),
});

export const channelOrderCreateSchema = z.object({
  tableId: z.string().trim().optional(),
  tableOrNo: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  deliveryAddress: z.string().trim().optional(),
  items: z.array(orderLineInput).min(1),
  channel: z.enum(["QR", "Swiggy", "Zomato", "Website"]),
  channelStatus: z.string().trim().optional(),
});

export const deliveryAgentSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  status: z.enum(["Active", "Idle", "Off Duty"]).default("Active"),
});

export const deliveryAgentUpdateSchema = deliveryAgentSchema.partial();

export const tableSchema = z.object({
  number: plainText("Table number").pipe(z.string().min(1, "Table number is required")),
  seats: z.coerce.number().min(1, "Seats must be at least 1"),
  area: z.enum(["Indoor", "Outdoor", "Private"]).default("Indoor"),
});

export const tableUpdateSchema = z.object({
  number: plainText("Table number").pipe(z.string().min(1, "Table number is required")).optional(),
  status: z.enum(["Available", "Occupied", "Reserved", "Billing"]).optional(),
  customerName: plainText("Customer name").optional(),
  customerPhone: z.string().trim().optional(),
  /** Reservation date and time (ISO string). */
  reservedAt: z.string().trim().optional(),
  seats: z.coerce.number().min(1).optional(),
  area: z.enum(["Indoor", "Outdoor", "Private"]).optional(),
});

export const stockEntrySchema = z.object({
  item: z.string().trim().min(1, "Select an item"),
  quantity: quantity("Quantity").refine((v) => v > 0, { message: "Quantity must be greater than 0" }),
  unit: z.string().trim().min(1, "Unit is required"),
  supplier: z.string().trim().optional().default(""),
  /** Only used when the stock-in creates a new item. */
  reorderLevel: quantity("Reorder level").refine((v) => v >= 0, { message: "Reorder level cannot be negative" }).optional(),
  cost: money("Purchase cost").refine((v) => v >= 0, { message: "Purchase cost cannot be negative" }).default(0),
});

export const inventoryUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  quantity: quantity("Quantity").refine((v) => v >= 0, { message: "Quantity cannot be negative" }).optional(),
  reorderLevel: quantity("Reorder level").refine((v) => v >= 0, { message: "Reorder level cannot be negative" }).optional(),
});

export const accountingActionSchema = z.object({
  action: z.enum(["fileGst", "toggleIntegration", "connectIntegration", "disconnectIntegration", "syncIntegration"]),
  period: z.string().trim().optional(),
  integrationId: z.enum(["tally", "quickbooks", "zoho", "bank"]).optional(),
});

export const subscriptionChangeSchema = z.object({
  plan: z.enum(["Basic", "Standard", "Premium", "Classic", "Advanced"]),
});

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  category: z.enum(["Raw Materials", "Fuel", "Payroll", "Utilities", "Operations", "Maintenance", "Other"]),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Online", "Bank Transfer"]).default("Cash"),
  hasBill: z.coerce.boolean().default(false),
  billUrl: z.string().trim().optional().default(""),
  amount: money("Amount").refine((v) => v > 0, { message: "Amount must be greater than 0" }),
  createdAt: z.string().trim().optional(),
});

export const expenseUpdateSchema = expenseSchema.partial();

/** Normalize to 10-digit Indian mobile (strips +91 / 91 / leading 0). */
function normalizeIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

const indianMobileSchema = z
  .string()
  .trim()
  .transform(normalizeIndianMobile)
  .refine((v) => /^[6-9]\d{9}$/.test(v), {
    message: "Enter a valid 10-digit mobile number",
  });

export const customerSchema = z.object({
  name: plainText("Name").pipe(z.string().min(1, "Name is required")),
  phone: indianMobileSchema,
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional().default(""),
  address: plainText("Address").optional().default(""),
  notes: plainText("Notes").optional().default(""),
  totalVisits: z.coerce.number().min(0).default(0),
  totalSpent: z.coerce.number().min(0).default(0),
});

export const customerUpdateSchema = customerSchema.partial();

export const loyaltyRedeemSchema = z.object({
  points: z.coerce.number().int().min(1, "Enter at least 1 point to redeem"),
});

const recipeIngredientSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required"),
  qty: z.string().trim().min(1, "Quantity is required"),
  /** Stock item this ingredient is drawn from; sales deduct `amount` `unit` per portion. */
  inventoryItemId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || objectId.test(v), { message: "Unknown stock item" }),
  amount: quantity("Ingredient quantity").refine((v) => v > 0, { message: "Ingredient quantity must be greater than 0" }).optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  cost: money("Ingredient cost").refine((v) => v >= 0, { message: "Cost must be positive" }),
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "Dish name is required"),
  category: z.string().trim().min(1, "Category is required"),
  salePrice: z.coerce.number().min(0, "Sale price must be positive"),
  ingredients: z.array(recipeIngredientSchema).min(1, "Add at least one ingredient"),
  menuItemId: z
    .string()
    .trim()
    .min(1, "Select a menu item for this recipe")
    .refine((v) => objectId.test(v), { message: "Select a menu item that exists on your menu" }),
});

export const recipeUpdateSchema = recipeSchema.partial();

export const staffSchema = z.object({
  name: plainText("Name").pipe(z.string().min(1, "Name is required")),
  role: plainText("Role").pipe(z.string().min(1, "Role is required")),
  // Same mobile rule as customers; phone stays optional for staff.
  phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => /^[+\d\s()-]*$/.test(v), { message: "Enter a valid 10-digit mobile number" })
    .transform(normalizeIndianMobile)
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), {
      message: "Enter a valid 10-digit mobile number",
    }),
  shift: z.enum(["Morning", "Evening"]).default("Morning"),
});

export const staffUpdateSchema = staffSchema.partial().extend({
  action: z.enum(["check-in", "check-out"]).optional(),
  status: z.enum(["Present", "Late", "Absent", "Off Duty", "Not Checked In"]).optional(),
});

const optionalEmail = z.union([z.string().trim().email("Enter a valid email"), z.literal("")]);

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Restaurant name is required").optional(),
    ownerName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: optionalEmail.optional(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || GSTIN_PATTERN.test(v), { message: "Enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5)" })
      .optional(),
    fssai: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    address: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    gstEnabled: z.boolean().optional(),
    cgst: z.coerce.number().min(0).optional(),
    sgst: z.coerce.number().min(0).optional(),
    igst: z.coerce.number().min(0).optional(),
    gstInclusive: z.boolean().optional(),
    invoicePrefix: z.string().trim().optional(),
    invoiceStartNumber: z.coerce.number().int().min(1, "Starting number must be at least 1").optional(),
    invoiceFooterText: z.string().trim().optional(),
    invoiceTerms: z.string().trim().optional(),
    showLogoOnInvoice: z.boolean().optional(),
    digitalSignature: z.boolean().optional(),
    loyalty: z
      .object({
        spendPerPoint: z.coerce.number().positive("Spend per point must be greater than 0"),
        pointValue: z.coerce.number().positive("Point value must be greater than 0"),
        silverMin: z.coerce.number().min(0),
        goldMin: z.coerce.number().min(0),
        platinumMin: z.coerce.number().min(0),
        silverMultiplier: z.coerce.number().min(1, "Multipliers must be at least 1"),
        goldMultiplier: z.coerce.number().min(1, "Multipliers must be at least 1"),
        platinumMultiplier: z.coerce.number().min(1, "Multipliers must be at least 1"),
      })
      .refine((l) => l.silverMin < l.goldMin && l.goldMin < l.platinumMin, {
        message: "Tier thresholds must increase: Silver < Gold < Platinum",
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
