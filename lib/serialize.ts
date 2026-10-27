import type { UserDoc } from "@/models/User";
import type { RestaurantDoc } from "@/models/Restaurant";
import { loyaltyConfigOf } from "@/lib/customer-stats";
import { toPlatformPlan } from "@/lib/super-admin";

export function serializeUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    active: (user as { active?: boolean }).active ?? true,
  };
}

export function serializeRestaurant(restaurant: RestaurantDoc) {
  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    businessType: restaurant.businessType,
    city: restaurant.city,
    phone: restaurant.phone,
    gstin: restaurant.gstin,
    plan: toPlatformPlan(restaurant.plan ?? undefined),
    billingCycle: restaurant.billingCycle,
    trialEndsAt: restaurant.trialEndsAt,
    ownerName: restaurant.ownerName,
    email: restaurant.email,
    fssai: restaurant.fssai,
    state: restaurant.state,
    address: restaurant.address,
    logoUrl: restaurant.logoUrl,
    gstEnabled: restaurant.gstEnabled,
    cgst: restaurant.cgst,
    sgst: restaurant.sgst,
    igst: restaurant.igst,
    gstInclusive: restaurant.gstInclusive,
    invoicePrefix: restaurant.invoicePrefix,
    invoiceStartNumber: restaurant.invoiceStartNumber,
    invoiceFooterText: restaurant.invoiceFooterText,
    invoiceTerms: restaurant.invoiceTerms,
    showLogoOnInvoice: restaurant.showLogoOnInvoice,
    digitalSignature: restaurant.digitalSignature,
    loyalty: loyaltyConfigOf(restaurant as { loyalty?: Record<string, number> | null }),
  };
}
