import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  restaurantName: z.string().trim().min(2, "Restaurant name is too short"),
  businessType: z.string().trim().min(1, "Select a business type"),
  city: z.string().trim().min(1, "City is required"),
  phone: z.string().trim().min(6, "Enter a valid phone number"),
  gstin: z.string().trim().optional().default(""),
  plan: z.enum(["Basic", "Standard", "Premium"]).default("Standard"),
  billingCycle: z.enum(["Monthly", "Annual"]).default("Monthly"),
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
  name: z.string().trim().min(1, "Item name is required"),
  category: z.string().trim().min(1, "Category is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  gst: z.coerce.number().min(0, "GST cannot be negative").max(28, "GST must be between 0 and 28%").default(5),
  foodType: z.enum(["Veg", "Non-Veg"]).default("Veg"),
  available: z.coerce.boolean().default(true),
});

/** Partial update must NOT re-apply defaults (e.g. gst:5) when fields are omitted. */
export const menuItemUpdateSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").optional(),
  category: z.string().trim().min(1, "Category is required").optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  gst: z.coerce.number().min(0, "GST cannot be negative").max(28, "GST must be between 0 and 28%").optional(),
  foodType: z.enum(["Veg", "Non-Veg"]).optional(),
  available: z.coerce.boolean().optional(),
});

const orderLineInput = z.object({
  menuItemId: z.string().optional(),
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  gst: z.coerce.number().min(0),
  qty: z.coerce.number().min(1),
});

export const orderSchema = z.object({
  tableId: z.string().trim().optional(),
  tableOrNo: z.string().trim().optional().default(""),
  customerName: z.string().trim().optional().default("Walk-in"),
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
  status: z.enum(["Paid", "Pending", "Refunded"]).optional(),
  kitchenStatus: z.enum(["New", "Preparing", "Ready", "Served"]).optional(),
  mode: z.enum(["Cash", "UPI", "Card"]).optional(),
  channelStatus: z.string().trim().optional(),
  deliveryAgentId: z.string().trim().optional(),
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
  number: z.string().trim().min(1, "Table number is required"),
  seats: z.coerce.number().min(1, "Seats must be at least 1"),
  area: z.enum(["Indoor", "Outdoor", "Private"]).default("Indoor"),
});

export const tableUpdateSchema = z.object({
  status: z.enum(["Available", "Occupied", "Reserved", "Billing"]).optional(),
  customerName: z.string().trim().optional(),
  reservedAt: z.string().trim().optional(),
  seats: z.coerce.number().min(1).optional(),
  area: z.enum(["Indoor", "Outdoor", "Private"]).optional(),
});

export const stockEntrySchema = z.object({
  item: z.string().trim().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().min(1, "Unit is required"),
  supplier: z.string().trim().optional().default(""),
  cost: z.coerce.number().min(0).default(0),
});

export const inventoryUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
});

export const accountingActionSchema = z.object({
  action: z.enum(["fileGst", "toggleIntegration", "syncIntegration"]),
  period: z.string().trim().optional(),
  integrationId: z.enum(["tally", "quickbooks", "zoho", "bank"]).optional(),
});

export const subscriptionChangeSchema = z.object({
  plan: z.enum(["Basic", "Standard", "Premium"]),
});

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  category: z.enum(["Raw Materials", "Fuel", "Payroll", "Utilities", "Operations", "Maintenance", "Other"]),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Online", "Bank Transfer"]).default("Cash"),
  hasBill: z.coerce.boolean().default(false),
  billUrl: z.string().trim().optional().default(""),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
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
  name: z.string().trim().min(1, "Name is required"),
  phone: indianMobileSchema,
  email: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
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
  cost: z.coerce.number().min(0, "Cost must be positive"),
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "Dish name is required"),
  category: z.string().trim().min(1, "Category is required"),
  salePrice: z.coerce.number().min(0, "Sale price must be positive"),
  ingredients: z.array(recipeIngredientSchema).min(1, "Add at least one ingredient"),
  menuItemId: z.string().trim().min(1, "Select a menu item for this recipe"),
});

export const recipeUpdateSchema = recipeSchema.partial();

export const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.string().trim().min(1, "Role is required"),
  phone: z.string().trim().optional().default(""),
  shift: z.enum(["Morning", "Evening"]).default("Morning"),
});

export const staffUpdateSchema = z.object({
  action: z.enum(["check-in", "check-out"]).optional(),
  status: z.enum(["Present", "Late", "Absent", "Off Duty"]).optional(),
});

const optionalEmail = z.union([z.string().trim().email("Enter a valid email"), z.literal("")]);

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Restaurant name is required").optional(),
    ownerName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: optionalEmail.optional(),
    gstin: z.string().trim().optional(),
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
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
