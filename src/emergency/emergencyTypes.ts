/** Emergency type for the in-app chooser and future FCM metadata. */
export type EmergencyType = 'fire' | 'earthquake';

export function parseEmergencyType(data: Record<string, unknown> | null | undefined): EmergencyType | null {
  const raw = data?.emergencyType ?? data?.type ?? data?.emergency;
  const value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return value === 'fire' || value === 'earthquake' ? value : null;
}

/**
 * One step of the voice guide. The guide shows one phase at a time and the voice repeats only
 * that phase until the user moves on; the last phase ends with "I'm outside now" (navigation).
 */
export type GuidePhase = {
  /** Short label in the progress bar. */
  label: string;
  /** Big headline on screen. */
  title: string;
  icon: string;
  /** Spoken one sentence at a time; the sentence being spoken is highlighted on screen. */
  speech: string[];
  /** Optional short checklist under the headline. */
  checklist?: { icon: string; bold: string; text: string }[];
  /** Small reminder pill under the checklist. */
  reminder?: string;
  /** Label of the button that moves to the next phase (absent on the last phase). */
  next?: string;
  /** Seconds of silence before the voice repeats this phase. */
  repeatAfter: number;
};

/** Spoken and shown when the guide reaches the map (outdoor navigation). */
export const MAP_STEP_LABEL = 'GO OUTSIDE';

export const GUIDE_PHASES: Record<EmergencyType, GuidePhase[]> = {
  earthquake: [
    {
      label: 'DURING SHAKING',
      title: 'Drop, cover,\nhold on',
      icon: 'shield-alert',
      speech: [
        'Earthquake. Drop, cover, and hold on.',
        'Get under a sturdy table.',
        'Cover your head and neck.',
        'Hold on until the shaking stops. Do not run outside.',
      ],
      next: 'The shaking has stopped',
      repeatAfter: 15,
    },
    {
      label: 'AFTER SHAKING',
      title: 'Leave the building calmly',
      icon: 'door-open',
      speech: [
        'The shaking has stopped. Leave the building calmly.',
        'Use the stairs, never the elevator.',
        'Stay away from windows, walls, and glass.',
        'Follow the exit signs and campus staff. Be ready for aftershocks.',
        'When you are outside, tap I am outside now.',
      ],
      checklist: [
        { icon: 'stairs', bold: 'Use the stairs.', text: 'Never the elevator.' },
        { icon: 'window-closed-variant', bold: 'Stay away', text: 'from windows, walls and glass.' },
        { icon: 'account-hard-hat', bold: 'Follow', text: 'exit signs and campus staff.' },
      ],
      reminder: 'Be ready for aftershocks',
      repeatAfter: 20,
    },
  ],
  fire: [
    {
      label: 'GET OUT NOW',
      title: 'Leave the building now',
      icon: 'fire-alert',
      speech: [
        'Fire alarm. Leave the building now.',
        'Use the stairs, never the elevator.',
        'If there is smoke, stay low and cover your nose and mouth.',
        'Do not go back for your belongings.',
        'When you are outside, tap I am outside now.',
      ],
      checklist: [
        { icon: 'stairs', bold: 'Use the stairs.', text: 'Never the elevator.' },
        { icon: 'weather-fog', bold: 'Stay low', text: 'under smoke. Cover your nose and mouth.' },
        { icon: 'bag-personal-off-outline', bold: 'Leave', text: 'your belongings behind.' },
      ],
      reminder: 'Close doors behind you if you can',
      repeatAfter: 15,
    },
  ],
};

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
