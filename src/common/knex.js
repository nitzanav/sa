import knex from "knex";
import config from "./config.js";

process.env.DATABASE_URL ??= config.DATABASE_URL;

const db = knex({ client: "pg", connection: process.env.DATABASE_URL });

export default db;
