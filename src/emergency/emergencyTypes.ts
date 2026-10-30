/** Emergency type for the in-app chooser and future FCM metadata. */
export type EmergencyType = 'fire' | 'earthquake';

export function parseEmergencyType(data: Record<string, unknown> | null | undefined): EmergencyType | null {
  const raw = data?.emergencyType ?? data?.type ?? data?.emergency;
  const value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return value === 'fire' || value === 'earthquake' ? value : null;
}

/** Animated pictogram shown while a guide step is spoken (see components/ui/GuideVisual). */
export type GuideVisualKind =
  | 'drop' | 'cover' | 'hold' | 'stay'
  | 'walk' | 'stairs' | 'windows' | 'exit-sign' | 'aftershock'
  | 'run-out' | 'smoke-low' | 'nose' | 'belongings' | 'door' | 'outside';

/** One spoken sentence of the guide, with the short caption and animation that match it. */
export type GuideStep = {
  /** Spoken by the voice. */
  say: string;
  /** Large on-screen caption (a few words). */
  caption: string;
  visual: GuideVisualKind;
};

/**
 * One phase of the voice guide. Its steps are spoken in order, each with its own animation; the
 * whole phase plays GUIDE_LOOPS times and then the guide moves on to the next phase by itself.
 */
export type GuidePhase = {
  /** Short label in the progress bar. */
  label: string;
  /** Headline above the caption. */
  title: string;
  steps: GuideStep[];
  /** Small reminder pill under the caption. */
  reminder?: string;
};

/** How many times each phase is played before the guide moves on. */
export const GUIDE_LOOPS = 2;

/** Spoken and shown when the guide reaches the map (outdoor navigation). */
export const MAP_STEP_LABEL = 'GO OUTSIDE';

export const GUIDE_PHASES: Record<EmergencyType, GuidePhase[]> = {
  earthquake: [
    {
      label: 'DURING SHAKING',
      title: 'Drop, cover, hold on',
      steps: [
        { say: 'Earthquake. Drop to your hands and knees.', caption: 'DROP', visual: 'drop' },
        { say: 'Cover your head and neck under a sturdy table.', caption: 'COVER', visual: 'cover' },
        { say: 'Hold on to the table until the shaking stops.', caption: 'HOLD ON', visual: 'hold' },
        { say: 'Do not run outside while it is shaking.', caption: 'Stay put while shaking', visual: 'stay' },
      ],
      reminder: 'Stay away from windows',
    },
    {
      label: 'AFTER SHAKING',
      title: 'Leave the building calmly',
      steps: [
        { say: 'When the shaking stops, leave the building calmly.', caption: 'Walk out calmly', visual: 'walk' },
        { say: 'Use the stairs, never the elevator.', caption: 'Stairs, not elevator', visual: 'stairs' },
        { say: 'Stay away from windows, walls, and glass.', caption: 'Away from glass', visual: 'windows' },
        { say: 'Follow the exit signs and campus staff.', caption: 'Follow exit signs', visual: 'exit-sign' },
        { say: 'Be ready for aftershocks.', caption: 'Expect aftershocks', visual: 'aftershock' },
        { say: 'Once you are outside, tap I am outside now.', caption: "Outside? Tap I'M OUTSIDE", visual: 'outside' },
      ],
    },
  ],
  fire: [
    {
      label: 'GET OUT NOW',
      title: 'Leave the building now',
      steps: [
        { say: 'Fire alarm. Leave the building now.', caption: 'GET OUT NOW', visual: 'run-out' },
        { say: 'Use the stairs, never the elevator.', caption: 'Stairs, not elevator', visual: 'stairs' },
        { say: 'If there is smoke, stay low.', caption: 'Stay low under smoke', visual: 'smoke-low' },
        { say: 'Cover your nose and mouth.', caption: 'Cover nose and mouth', visual: 'nose' },
        { say: 'Do not go back for your belongings.', caption: 'Leave your things', visual: 'belongings' },
        { say: 'Close doors behind you if you can.', caption: 'Close doors behind you', visual: 'door' },
        { say: 'Once you are outside, tap I am outside now.', caption: "Outside? Tap I'M OUTSIDE", visual: 'outside' },
      ],
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
