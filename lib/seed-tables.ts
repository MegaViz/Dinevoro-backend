import Table from "@/models/Table";

const DEFAULT_TABLES = [
  { number: "T-01", seats: 2, area: "Indoor" as const },
  { number: "T-02", seats: 4, area: "Indoor" as const },
  { number: "T-03", seats: 4, area: "Indoor" as const },
  { number: "T-04", seats: 6, area: "Private" as const },
  { number: "T-05", seats: 4, area: "Indoor" as const },
  { number: "T-06", seats: 2, area: "Outdoor" as const },
  { number: "T-07", seats: 4, area: "Outdoor" as const },
  { number: "T-08", seats: 6, area: "Private" as const },
  { number: "T-09", seats: 4, area: "Indoor" as const },
  { number: "T-10", seats: 2, area: "Outdoor" as const },
  { number: "T-11", seats: 8, area: "Private" as const },
  { number: "T-12", seats: 4, area: "Indoor" as const },
];

export async function seedDefaultTables(restaurantId: string) {
  const existing = await Table.countDocuments({ restaurant: restaurantId });
  if (existing > 0) return;

  await Table.insertMany(
    DEFAULT_TABLES.map((t) => ({
      ...t,
      restaurant: restaurantId,
      status: "Available",
    })),
  );
}
