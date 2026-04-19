import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

export const useReducedMotion = () => useFramerReducedMotion() ?? false;
