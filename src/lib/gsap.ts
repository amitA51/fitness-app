// ============================================================================
// SPARKOS FITNESS - Central GSAP setup
// ----------------------------------------------------------------------------
// Single source of truth for GSAP. Import { gsap } from here (never directly
// from 'gsap') so plugins are registered exactly once and tree-shaking keeps
// the dedicated 'gsap' Vite chunk stable.
//
// IMPORTANT: GSAP does NOT respect prefers-reduced-motion automatically.
// Every GSAP animation MUST guard with useReducedMotion() and snap to its final
// state when reduced. Timing/easing tokens live in motionTokens so components
// that do not use GSAP never evaluate this module just to read scalar values.
// ============================================================================

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';

// Register once at module scope (safe to call repeatedly, but this module is
// imported, so it only runs once).
gsap.registerPlugin(useGSAP, Physics2DPlugin);

/**
 * Keep this registration module GSAP-only. The measured audit found a 72.25 kB
 * GSAP vendor chunk on Dashboard; re-exporting pure tokens/formatters from here
 * let Rollup route Dashboard's shared imports through this side-effectful module.
 * Consumers import motionTokens and formatThousands directly instead.
 */
export { gsap, useGSAP };
