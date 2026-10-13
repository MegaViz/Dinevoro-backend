import mongoose, { Schema, type InferSchemaType, models, model } from "mongoose";

const ingredientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: String, required: true, trim: true },
    cost: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const recipeSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", default: null },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    salePrice: { type: Number, required: true, min: 0 },
    ingredients: { type: [ingredientSchema], default: [] },
  },
  { timestamps: true },
);

export type RecipeDoc = InferSchemaType<typeof recipeSchema> & { _id: mongoose.Types.ObjectId };

export default models.Recipe || model("Recipe", recipeSchema);
