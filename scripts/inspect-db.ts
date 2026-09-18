import { createAdminClient } from "../lib/supabase/admin";
import * as dotenv from "dotenv";
import * as fs from "fs";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

async function checkMaterials() {
  const supabase = createAdminClient();
  const { data: materials } = await supabase.from("materials").select("id, file_name, user_id, project_id, status");
  console.log("Materials:", materials);
}

checkMaterials().catch(console.error);
