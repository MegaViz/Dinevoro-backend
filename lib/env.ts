import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envLocal = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}
