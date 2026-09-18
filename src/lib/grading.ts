/**
 * The grade engine is shared with the mobile app as @ulat/grade-math so
 * both clients show identical numbers. This module re-exports it under the
 * web app's historical import path.
 */
export * from "../../packages/grade-math/src/grading";
