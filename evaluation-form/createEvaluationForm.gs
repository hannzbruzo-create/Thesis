/**
 * Builds the system evaluation Google Forms, each with its own link and its own responses:
 *
 *   Form A - Students (CEAFA, CHS, CASE)
 *            Part I   Profile
 *            Part II  ISO 25010 Questions: A. Functionality, B. Reliability, C. Usability
 *            Part III Open-Ended
 *            Part IV  Effectiveness (answers Problem 3)
 *
 *   Form B - PPFMO (admin panel users)
 *            Part I   Profile
 *            Part II  ISO 25010 Questions: A. Functionality, B. Reliability, C. Usability
 *            Part III Open-Ended
 *
 * The statements follow the study's objectives:
 *   Objective 1 - SMS and push notifications, evacuation guidance, the 2.5D campus map
 *   Objective 2 - pathfinding to the nearest and safest evacuation area
 *   Objective 3 - evaluated by ISO 25010 Functionality, Reliability and Usability (the A/B/C grids)
 *
 * HOW TO USE
 *  1. Sign in to your UST-L Google account and open https://script.google.com
 *  2. Open your project, select all the old code, and paste this whole file over it. Save (Ctrl+S).
 *  3. Edit the PLACEHOLDERS block below (or leave them and edit inside Google Forms later).
 *  4. Select "createEvaluationForms" and click Run.
 *     (To rebuild only one form, run "createStudentForm" or "createPpfmoForm" instead.)
 *  5. Open Execution log: it prints the edit link and the link to send for each form.
 *     Both forms are also saved in your Google Drive.
 *
 * Each run creates NEW forms (it never changes existing ones), so delete old copies from Drive.
 */

// ---------------------------------------------------------------- PLACEHOLDERS (edit these)
var SYSTEM_TITLE = '[SYSTEM TITLE]';
var MEMBERS = '[Member Name 1] | [Member Name 2] | [Member Name 3]';
var PROGRAM = '[Program, e.g. Bachelor of Science in Computer Science]';
var YEAR_LEVEL = '[4th Year] [Program] Students';
// ------------------------------------------------------------------------------------------

/** Colleges in the student sample. */
var COLLEGES = ['CEAFA', 'CHS', 'CASE'];

/** 5-point Likert scale used by every rating grid. */
var SCALE = [
  '5 - Strongly Agree',
  '4 - Agree',
  '3 - Neutral',
  '2 - Disagree',
  '1 - Strongly Disagree',
];

var SCALE_LEGEND =
  'Choose the answer that best matches your experience:\n' +
  '5 - Strongly Agree | 4 - Agree | 3 - Neutral | 2 - Disagree | 1 - Strongly Disagree';

// ================================================================= entry points

function createEvaluationForms() {
  createStudentForm();
  createPpfmoForm();
}

/** Form A: students of CEAFA, CHS and CASE. Parts I-IV. */
function createStudentForm() {
  var form = newForm(
    SYSTEM_TITLE + ': System Evaluation (Students)',
    'This form is for students of CEAFA, CHS, and CASE who tested the mobile app. '
  );
  addConsent(form);

  // Part I - Profile
  form.addPageBreakItem().setTitle('Part I – Profile');
  form.addMultipleChoiceItem()
    .setTitle('College')
    .setChoiceValues(COLLEGES)
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('Year Level')
    .setChoiceValues(['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('How many times have you joined a campus evacuation drill?')
    .setChoiceValues(['Never', 'Once', '2–3 times', '4 or more times'])
    .setRequired(true);

  // Part II - ISO 25010
  addIsoPage(form, 'Rate the mobile app based on your experience during the test or drill.', {
    functionality: [
      'I received the emergency alert on my phone (SMS or push notification).',            // Obj 1
      'The app told me what to do during a fire or earthquake.',                            // Obj 1
      'The 2.5D campus map clearly shows the buildings, pathways and evacuation areas.',    // Obj 1
      'The app showed me a route to the nearest evacuation area.',                          // Obj 2
    ],
    reliability: [
      'The app worked without crashing.',
      'Alerts arrived every time one was sent.',
      'The map and route still worked even with weak or no internet.',
    ],
    usability: [
      'The app was easy to understand and use, even the first time.',
      'Getting a route took only a few taps.',
      'The text, icons and colors were easy to read.',
    ],
  });

  addOpenEnded(form);

  // Part IV - Effectiveness (Problem 3)
  form.addPageBreakItem()
    .setTitle('Part IV – Effectiveness')
    .setHelpText(SCALE_LEGEND);
  addGrid(form, 'Effectiveness', [
    'The app would help me evacuate faster during an emergency.',
    'Using the app makes me feel more prepared for a fire or earthquake on campus.',
  ]);

  logLinks('Form A (Students)', form);
}

/** Form B: PPFMO personnel who use the admin panel. Parts I-III. */
function createPpfmoForm() {
  var form = newForm(
    SYSTEM_TITLE + ': System Evaluation (PPFMO)',
    'This form is for the PPFMO personnel who use the system\'s admin panel to send alerts and ' +
    'monitor evacuees. '
  );
  addConsent(form);

  // Part I - Profile
  form.addPageBreakItem().setTitle('Part I – Profile');
  form.addTextItem()
    .setTitle('Position / Designation')
    .setRequired(true);

  // Part II - ISO 25010
  addIsoPage(form, 'Rate the system (admin panel and mobile app) based on your experience during the test or drill.', {
    functionality: [
      'The system sends fire and earthquake alerts to students through SMS and push notifications.',  // Obj 1
      'The dashboard correctly shows who is navigating, who has arrived and who is safe.',            // Obj 1
      'The app guides students to the nearest and safest evacuation area.',                          // Obj 2
    ],
    reliability: [
      'Alerts were sent without errors or delays.',
      'The system kept working during the test or drill.',
    ],
    usability: [
      'Sending a fire or earthquake alert is simple and clear.',
      'Managing recipients and admin accounts is easy.',
    ],
  });

  addOpenEnded(form);

  logLinks('Form B (PPFMO)', form);
}

// ================================================================= shared sections

/** Creates the form with the shared settings and intro text. */
function newForm(title, audience) {
  var form = FormApp.create(title);

  form.setDescription(
    'Thank you for taking the time to test ' + SYSTEM_TITLE + ', a Smart Campus-Based Emergency ' +
    'Evacuation Route Notification System developed for the University of Santo Tomas–Legazpi.\n\n' +
    'As part of our undergraduate thesis for the ' + PROGRAM + ' program, this study aims to improve ' +
    'emergency preparedness on campus by sending disaster alerts (fire and earthquake) through SMS and ' +
    'push notifications, and by guiding users to the nearest and safest evacuation area using an ' +
    'interactive 2.5D campus map.\n\n' +
    audience + 'Your honest answers will help us evaluate the system\'s Functionality, Reliability, ' +
    'and Usability based on the ISO/IEC 25010 software quality standard. All responses will be kept ' +
    'strictly confidential and used only for this research, in accordance with the Data Privacy Act ' +
    'of 2012 (RA 10173).\n\n' +
    'Thank you for your support!\n\n' +
    'Best,\n\n' +
    MEMBERS + '\n' +
    YEAR_LEVEL
  );

  // Collect verified emails like the sample form (falls back to the older setting if needed).
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } catch (e) {
    form.setCollectEmail(true);
  }
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage(
    'Thank you for evaluating ' + SYSTEM_TITLE + '! Your response has been recorded.'
  );
  return form;
}

function addConsent(form) {
  form.addCheckboxItem()
    .setTitle('Data Privacy Consent')
    .setHelpText(
      'My participation is voluntary, and my answers will be kept confidential and used only for this ' +
      'research (Data Privacy Act of 2012, RA 10173).'
    )
    .setChoiceValues(['I agree to participate in this evaluation.'])
    .setRequired(true);
}

/** Part II - ISO 25010: one page with the A, B and C grids. */
function addIsoPage(form, intro, items) {
  form.addPageBreakItem()
    .setTitle('Part II – ISO 25010 Questions')
    .setHelpText(intro + '\n\n' + SCALE_LEGEND);

  addGrid(form, 'A. Functionality', items.functionality);
  addGrid(form, 'B. Reliability', items.reliability);
  addGrid(form, 'C. Usability', items.usability);
}

/** Part III - Open-Ended (optional, so respondents with nothing to report can skip). */
function addOpenEnded(form) {
  form.addPageBreakItem().setTitle('Part III – Open-Ended');
  form.addParagraphTextItem().setTitle('What problems did you encounter while using the system?');
  form.addParagraphTextItem().setTitle('What would you improve?');
}

// ================================================================= helpers

/** Adds one required Likert grid (every row must be answered). */
function addGrid(form, title, rows) {
  form.addGridItem()
    .setTitle(title)
    .setRows(rows)
    .setColumns(SCALE)
    .setRequired(true);
}

function logLinks(label, form) {
  Logger.log(label);
  Logger.log('  Edit the form here:  ' + form.getEditUrl());
  Logger.log('  Send this link:      ' + form.getPublishedUrl());
}
