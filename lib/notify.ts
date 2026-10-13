import Notification from "@/models/Notification";

interface NotifyInput {
  restaurantId: string;
  title: string;
  message: string;
  category: "Payments" | "Customers" | "Inventory" | "System";
  severity?: "warning" | "info" | "success";
}

export async function notify({ restaurantId, title, message, category, severity = "info" }: NotifyInput) {
  try {
    await Notification.create({ restaurant: restaurantId, title, message, category, severity });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
