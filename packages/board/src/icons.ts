import type { Role } from '@ligungi/engine';

/**
 * Illustrated piece set: one icon per role, drawn for ligungi (no artwork from the series). Inner SVG markup in a
 * 100-unit disc centered on 0, kept inside radius 22 so the movement indicators (from radius 25) never overlap it.
 * One visual language: solid silhouettes, line parts at least 3.6 units thick, details in a `gg-cut` group (drawn in
 * the disc's color by the stylesheet, so they show on both sides).
 */
export const PIECE_ICONS: Readonly<Record<Role, string>> = {
  // crown
  marshal: `<polygon points="-17,7 -17,-10 -8.5,-1.5 0,-15 8.5,-1.5 17,-10 17,7"/><rect x="-17" y="9" width="34" height="6" rx="1.5"/><g class="gg-cut"><circle cx="0" cy="3" r="2.4"/></g>`,
  // three rank stars
  general: `<polygon points="0.0,-17.5 2.5,-11.5 9.0,-10.9 4.1,-6.7 5.6,-0.3 0.0,-3.7 -5.6,-0.3 -4.1,-6.7 -9.0,-10.9 -2.5,-11.5"/><polygon points="-10.0,-2.0 -7.5,4.0 -1.0,4.6 -5.9,8.8 -4.4,15.2 -10.0,11.8 -15.6,15.2 -14.1,8.8 -19.0,4.6 -12.5,4.0"/><polygon points="10.0,-2.0 12.5,4.0 19.0,4.6 14.1,8.8 15.6,15.2 10.0,11.8 4.4,15.2 5.9,8.8 1.0,4.6 7.5,4.0"/>`,
  // two rank stars
  lieutenant: `<polygon points="-9.0,-10.5 -6.2,-3.8 1.0,-3.2 -4.5,1.5 -2.8,8.5 -9.0,4.7 -15.2,8.5 -13.5,1.5 -19.0,-3.2 -11.8,-3.8"/><polygon points="9.0,-10.5 11.8,-3.8 19.0,-3.2 13.5,1.5 15.2,8.5 9.0,4.7 2.8,8.5 4.5,1.5 -1.0,-3.2 6.2,-3.8"/>`,
  // one rank star
  major: `<polygon points="0.0,-15.0 4.2,-4.8 15.2,-3.9 6.8,3.2 9.4,13.9 0.0,8.2 -9.4,13.9 -6.8,3.2 -15.2,-3.9 -4.2,-4.8"/>`,
  // katana: near-straight blade with an angled kissaki, tsuba, wrapped grip
  samurai: `<g transform="rotate(-45) scale(0.95) translate(-10.5 0)"> <path d="M1 -2.8 C13 -3.1 24 -3.9 36.5 -5.8 Q33.5 -1.6 30.5 -1.1 C21 0.4 11 2 1 2.8 Z"/> <rect x="-2.6" y="-6.8" width="3.4" height="13.6" rx="1.5"/> <rect x="-15" y="-3" width="12.6" height="6" rx="1.5"/> <g class="gg-cut"><path d="M-13.4 0 L-11.8 -1.8 L-10.2 0 L-11.8 1.8 Z"/><path d="M-9 0 L-7.4 -1.8 L-5.8 0 L-7.4 1.8 Z"/></g> <rect x="-16.6" y="-3.3" width="2.2" height="6.6" rx="0.9"/></g>`,
  // spear
  lancer: `<rect x="-2" y="-6" width="4" height="24" rx="2"/><path d="M0 -19 L7 -6 L0 -3 L-7 -6 Z"/><rect x="-6.5" y="-3" width="13" height="3.6" rx="1.8"/>`,
  // chess-knight horse head
  rider: `<path d="M12 18 C15.5 7 14.5 -5 8.5 -11.5 L7 -18.5 L2.5 -13 C-3.5 -12.5 -9.5 -8.5 -14 -1.5 L-16.5 4 Q-17 8.5 -12.5 8.5 L-9.5 6.5 L-6.5 8.5 C-3.5 8.5 -0.5 6.5 2 7 C-0.5 10.5 -3 14 -3.5 18 Z"/> <g class="gg-cut"><ellipse cx="-3" cy="-5.5" rx="2.2" ry="1.6"/><path d="M12.5 -6 L9 -4 M14 -1 L10 1 M14.5 4 L10.5 5.5 M14 9 L10.5 10" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/></g>`,
  // shuriken
  spy: `<path fill-rule="evenodd" d="M0 -18 L5 -5 L18 0 L5 5 L0 18 L-5 5 L-18 0 L-5 -5 Z M0 -3.4 A3.4 3.4 0 1 0 0.01 -3.4 Z"/>`,
  // castle tower
  fortress: `<path fill-rule="evenodd" d="M-14 17 V-6 H-9 V-13 H-3.6 V-6 H3.6 V-13 H9 V-6 H14 V17 Z M-5 17 V8.5 A5 5 0 0 1 5 8.5 V17 Z"/>`,
  // jingasa, the conical hat of the ashigaru foot soldiers
  soldier: `<path d="M-19 5 L0 -12 L19 5 Q0 9.5 -19 5 Z"/><circle cx="0" cy="-12" r="2.6"/><path d="M-10 7.5 Q0 18 10 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
  // cannon on a carriage with a spoked wheel
  cannon: `<g transform="rotate(-24)"><polygon points="-13,-6 11,-4 11,4 -13,6"/><rect x="10" y="-5.6" width="5.5" height="11.2" rx="1.4"/><circle cx="-14.5" cy="0" r="3.8"/></g> <path fill-rule="evenodd" d="M-4 4 A7.5 7.5 0 1 0 -3.99 4 Z M-4 7.6 A3.9 3.9 0 1 1 -4.01 7.6 Z"/><polygon points="-14,15 8,15 1,9 -9,9"/><circle cx="-4" cy="11.5" r="2.2"/>`,
  // bow and arrow
  archer: `<path d="M-6 -18 Q18 0 -6 18 L-6 14 Q10 0 -6 -14 Z"/><rect x="-7.6" y="-15" width="2.6" height="30" rx="1.3"/><rect x="-16" y="-1.8" width="27" height="3.6" rx="1.8"/><polygon points="19,0 10,-6 10,6"/>`,
  // musket
  musketeer: `<g transform="rotate(-28)"><rect x="-5" y="-2.4" width="25" height="4.2" rx="1.2"/><path d="M-4 -3.2 L-12.5 -3.2 Q-17.5 -3.2 -20.5 2 L-20.5 8.5 L-13.5 7.5 Q-9 2.8 -4 2.8 Z"/><rect x="-8.5" y="-5.6" width="5.5" height="3.4" rx="1"/><path d="M-8.4 2.6 Q-7.4 7.8 -3.4 6.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></g>`,
  // compass
  tactician: `<path fill-rule="evenodd" d="M0 -17 A17 17 0 1 0 0.01 -17 Z M0 -13 A13 13 0 1 1 -0.01 -13 Z"/><polygon points="0,-11.5 5,0 0,3 -5,0"/><polygon points="0,11.5 5,0 0,-3 -5,0" opacity="0.4"/><circle cx="0" cy="0" r="2"/>`,
};
