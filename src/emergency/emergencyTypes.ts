/** Emergency type for the in-app chooser and future FCM metadata. */
export type EmergencyType = 'fire' | 'earthquake';

export function parseEmergencyType(data: Record<string, unknown> | null | undefined): EmergencyType | null {
  const raw = data?.emergencyType ?? data?.type ?? data?.emergency;
  const value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return value === 'fire' || value === 'earthquake' ? value : null;
}

/**
 * Prototype safety copy. Campus PFMO / emergency officers must review and approve
 * actual event-specific instructions before use in real emergencies.
 */
export const EMERGENCY_CONTENT = {
  fire: {
    title: 'FIRE EMERGENCY',
    heading: 'EVACUATE SAFELY',
    subtitle: 'Follow the campus fire alarm and emergency personnel.',
    icon: 'fire-alert' as const,
    tint: '#B42318',
    light: '#FFF1EF',
    steps: [
      {
        title: 'ALERT & STAY CALM',
        description: 'Alert people nearby and follow the fire alarm and campus emergency instructions.',
        icon: 'alarm-light-outline' as const,
      },
      {
        title: 'FIND A SAFE EXIT',
        description: 'Leave by a safe exit. Use stairs, never elevators. Avoid smoke-filled routes.',
        icon: 'door-open' as const,
      },
      {
        title: 'STAY OUTSIDE',
        description: 'Move away from the building. Do not return inside until authorities say it is safe.',
        icon: 'exit-run' as const,
      },
    ],
    finalInstruction: 'If your route is unsafe or blocked, do not follow the map through danger. Follow responders and official evacuation signs.',
  },
  earthquake: {
    title: 'EARTHQUAKE EMERGENCY',
    heading: 'DROP • COVER • HOLD ON',
    subtitle: 'Protect yourself during shaking. Do not rush outside.',
    icon: 'home-alert' as const,
    tint: '#AD6800',
    light: '#FFF8EA',
    steps: [
      {
        title: 'DROP, COVER, HOLD',
        description: 'While shaking continues, drop, cover your head and neck, and hold on to shelter.',
        icon: 'shield-alert' as const,
      },
      {
        title: 'WAIT FOR SHAKING TO STOP',
        description: 'Keep away from windows and falling objects. Do not run outside during shaking.',
        icon: 'clock-alert-outline' as const,
      },
      {
        title: 'EXIT WHEN SAFE',
        description: 'After shaking stops, follow campus personnel to a safe exit. Watch for debris and aftershocks.',
        icon: 'exit-run' as const,
      },
    ],
    finalInstruction: 'Follow official campus directions. Avoid damaged areas, and use stairs rather than elevators when safe to evacuate.',
  },
} as const;
