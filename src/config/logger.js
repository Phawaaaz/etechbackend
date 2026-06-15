import winston from "winston";
import { config } from "./env.js";

const transports =
  config.nodeEnv === "production"
    ? [new winston.transports.File({ filename: "logs/app.log", level: "info" }),
       new winston.transports.File({ filename: "logs/error.log", level: "error" })]
    : [new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) })];

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
});
