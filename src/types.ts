import type { Client } from "openapi-fetch";
import type { paths } from "./generated/asana";

export interface AppBindings extends Cloudflare.Env {
  asana: Client<paths>;
}

export interface HonoEnv {
  Bindings: AppBindings;
}
