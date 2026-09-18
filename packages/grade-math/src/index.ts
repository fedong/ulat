/**
 * @ulat/grade-math — the shared grade engine.
 *
 * Both clients (web and mobile) import from here so instructors, students
 * and guardians always see identical numbers. Ships as plain TypeScript
 * source; each app's bundler compiles it.
 */
export * from "./types";
export * from "./grading";
export * from "./presets";
export * from "./seed";
