import chalk from "chalk";

export default {
  Iris: (...args: unknown[]) => {
    console.log(
      `\x1b[37m[\x1b[34mIris\x1b[0m\x1b[37m]`,
      ...args.map((arg) =>
        typeof arg === "string" ? chalk.gray(arg) : chalk.gray(JSON.stringify(arg)),
      ),
    );
  },
  
  debug(...messages: string[]) {
    console.log(`\x1b[37m[\x1b[36mDEBUG\x1b[0m\x1b[37m]`, ...messages);
  },

  info: (...args: unknown[]) => {
    console.log(
      `\x1b[37m[\x1b[32mINFO\x1b[0m\x1b[37m]`,
      ...args.map((arg) =>
        typeof arg === "string" ? chalk.gray(arg) : chalk.gray(JSON.stringify(arg)),
      ),
    );
  },

  startup: (...args: unknown[]) => {
    console.log(
      ...args.map((arg) =>
        typeof arg === "string" ? chalk.gray(arg) : chalk.gray(JSON.stringify(arg)),
      ),
    );
  },

  warn: (...args: unknown[]) => {
    console.log(
      `\x1b[37m[\x1b[33mWARN\x1b[0m\x1b[37m]`,
      ...args.map((arg) =>
        typeof arg === "string" ? chalk.gray(arg) : chalk.gray(JSON.stringify(arg)),
      ),
    );
  },

  error: (...args: unknown[]) => {
    console.log(
      chalk.bgRed(" ERROR "),
      ...args.map((arg) =>
        typeof arg === "string" ? chalk.gray(arg) : chalk.gray(JSON.stringify(arg)),
      ),
    );
  },
};