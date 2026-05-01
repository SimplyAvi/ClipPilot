import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

require("isomorphic-fetch");
require("./index");
