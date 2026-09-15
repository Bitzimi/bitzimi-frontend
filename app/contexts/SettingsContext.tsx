// Compatibility bridge: the active application providers live under src/app/contexts.
// Keeping this module re-exported ensures legacy app/ components consume the same
// React context instance as the active src/app provider.
export * from "../../src/app/contexts/SettingsContext";
