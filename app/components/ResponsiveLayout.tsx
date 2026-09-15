// Reaction Tap is still sourced from the original app/pages implementation, but its
// surrounding layout must come from the active src/app provider tree. This keeps
// the original game UI/flow while preventing duplicate legacy React contexts.
export { ResponsiveLayout } from "../../src/app/components/ResponsiveLayout";
