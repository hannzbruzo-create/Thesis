# TomaSafe Thesis: System Reference and Revision Handoff

**For:** Bruzo · Estocado · Jaraba
**Updated:** November 11, 2026
**Purpose:** Everything you need to revise the manuscript together so that **everything the paper says matches the system we actually built** (mobile app, server, admin panel), and to finish the Results, Findings, Conclusion and Recommendation part. Start with **Section 3** (what the system really does) and **Section 4** (the list of paper-vs-system mismatches to fix).

---

## 1. Where to edit

- **Main manuscript (Google Doc):** https://docs.google.com/document/d/1hehMxEilzJSCRR8olLzb3CFraK6gvISbipzvlnjCNhE/edit?tab=t.0
- **Where the new section goes:** under **Result and Discussion**, right **after** the "Dijkstra's Algorithm Implementation" paragraph and **before** "References".
- **Draft of the new section:** full text is in [Section 11](#11-full-draft-text) of this file, and as a formatted Word file `Thesis-2/docs/Results-and-Evaluation-Section.docx` (Times New Roman, tables already styled). Copying from the Word file keeps the table formatting; copying from this file is fine for text.

**To avoid overwriting each other:** each person takes the sections in the table below, edits only those in the Google Doc, and uses **Suggesting mode** or comments when changing someone else's part.

| Section | Who | Status |
|---|---|---|
| Introduction chapter: fix Section 4 rows 1–8, 22 | ________ | to do |
| Methodology chapter: fix Section 4 rows 9–16, 21 | ________ | to do |
| Result and Discussion (existing figures): fix Section 4 rows 17–20 | ________ | to do |
| Evaluation Instruments + form screenshots (Figures 11–11.2) | ________ | needs screenshots |
| Data Tallying and Statistical Treatment | ________ | drafted |
| Summary of Results (Tables 4–7) | ________ | drafted |
| Summary of Findings | ________ | drafted |
| Conclusion | ________ | drafted |
| Recommendation | ________ | drafted |
| Fix figure numbering in the earlier Result and Discussion part | ________ | to do |

---

## 2. The project in one page

**Title:** UST–Legazpi Smart Campus Mobile Application for Fire and Earthquake Evacuation Route Notification Using Dijkstra's Algorithm

**System:** TomaSafe (the app's name), Rawis Campus, fire and earthquake only.

**General objective:** design, develop, and evaluate a system that provides disaster notifications and campus-based evacuation guidance.

**Specific objectives:**
1. Develop a mobile application-based system that manages, processes, and delivers disaster notifications and evacuation guidance via **SMS and push notifications**, with an interactive **2.5D campus map** of buildings, outdoor pathways, and designated evacuation areas.
2. Apply a **pathfinding algorithm (Dijkstra's)** that finds the safest and nearest evacuation route, accessible in the mobile app.
3. **Evaluate** the system using **ISO 25010**: Functionality, Reliability, Usability.

**How it works:**

| Part | Folder | Built with | What it does |
|---|---|---|---|
| Mobile app (student side) | `Thesis-2/` | Expo / React Native; 2.5D map drawn with three.js | One-time sign-in, receives push alerts, voice safety instructions, GPS on 2.5D map, offline Dijkstra route to nearest of 9 evacuation areas, "I'm Safe" status |
| Admin panel | `evacuation-admin/` | React + Vite | Admin login, send Fire/Earthquake alert with confirmation, live monitoring counts, alert history and details, recipient management, admin management (superadmin) |
| Server | `server/` | Node.js Express, SQLite, Firebase Cloud Messaging, TextBee | Stores recipients, alerts and status reports; sends push via FCM and SMS via TextBee (a free gateway that sends from one Android phone with prepaid load) |

**Routing facts used in the paper:** campus walkway network of 8,828 points and 60,130 links; Dijkstra with a min-heap; link weights raised near building walls during earthquakes and on covered walkways during fires; works without internet; outdoor only (no indoor navigation).

---

## 3. System reference: what TomaSafe actually does

This section was written from the code itself (mobile app, server, admin panel) on November 11, 2026. **When the paper and this section disagree, the paper is wrong** unless we change the code. Use these facts and terms everywhere in the manuscript.

### 3.1 Overall architecture

```
 Admin (web browser)                         Students' phones (Android app)
 evacuation-admin  ──HTTP + login token──►  server (Node.js/Express on a PC)
                                             │  SQLite database
                                             ├─► Firebase Cloud Messaging ──► push notification
                                             ├─► TextBee API ──► gateway Android phone (prepaid SIM) ──► SMS
                                             └─◄► Cloud Firestore ◄──── app writes sign-in, push token, status
                                                                         (app falls back to the server directly on the same Wi-Fi)
```

- **Three parts:** the mobile app (`Thesis-2`), the admin panel (`evacuation-admin`), and the server (`server`).
- **The server runs on a PC.** Phones on any network (mobile data or campus Wi-Fi) reach it through **Cloud Firestore**: the app writes to Firestore, and the server listens and copies everything into SQLite. If Firestore is unavailable, the app can talk to the server directly, but only on the same local network.
- **Database (SQLite) stores:** admin accounts, recipients, registered devices (push tokens), incidents (alerts), alert history, and device safety statuses. It does **not** store the campus map or routes.
- **The campus map and walkway network are built into the app.** Routing runs on the phone, so the map and route work **without internet**. Internet (or SMS signal) is needed only to receive alerts and to send status reports.

### 3.2 Mobile app (student side)

**Technology:** React Native with Expo (TypeScript), three.js through @react-three/fiber for the 2.5D map, expo-location (GPS), expo-notifications (push), expo-speech (voice), expo-sensors (barometer, accelerometer, compass). Android build, package `com.ustlegazpi.tomasafe`. App name shown to users: **TomaSafe**.

**Sign-in (first open only):** full name, 11-digit mobile number starting with 09, and student ID number. **Only students** can sign in (faculty and campus personnel were removed from the app on November 10, 2026). The sign-in is saved under the phone's Android ID, so reinstalling the app restores it. Signing in registers the phone for push notifications and adds the student as an SMS recipient in the admin panel. There is no password.

**Home screen:** "Select an emergency" with two buttons, **Fire** and **Earthquake**. The user can start the guide manually, or the guide opens automatically when the user taps an alert push notification.

**Voice safety guide (indoors, before navigation).** Each step is spoken aloud with a caption and an animated pictogram. Each phase plays **twice**, then moves on by itself. An "I'm outside now" button skips to the map.

| Emergency | Phase | Spoken steps |
|---|---|---|
| Earthquake | During shaking: "Drop, cover, hold on" | Drop to hands and knees · cover head and neck under a sturdy table · hold on until shaking stops · do not run outside while shaking (reminder: stay away from windows) |
| Earthquake | After shaking: "Leave the building calmly" | Walk out calmly · stairs, never the elevator · away from windows, walls, glass · follow exit signs and campus staff · be ready for aftershocks · once outside, tap I'm outside now |
| Fire | Get out now: "Leave the building now" | Leave the building now · stairs, never the elevator · stay low under smoke · cover nose and mouth · do not go back for belongings · close doors behind you · once outside, tap I'm outside now |

**2.5D campus map:** a **2.5D map, not a 3D map**. It's an angled top-down view of the flat campus layout, with buildings drawn as raised blocks so they are easy to recognize. three.js is only the drawing tool; the map was not designed as a 3D model. Always call it "2.5D campus map" in the paper, never "3D". It shows the Rawis Campus buildings, canopies (covered walkways), roads, walkways, building labels, and the **9 evacuation areas**. Shows the user's GPS position, smoothed with a Kalman filter and aligned to the map.

**The 9 evacuation areas (as named in the app and on the admin dashboard):**
1. Aqui Preschool & Elementary field
2. North lawn (north of St. Pius V Hall)
3. St. Dominic front lawn
4. West open ground (San Lorenzo grounds)
5. Lawn south of St. Pius V Hall
6. Grounds south of St. Thomas Chapel
7. St. Thomas Aquinas quadrangle
8. St. Albert courtyard
9. East lawn beside St. Albert

**Routing (Dijkstra's algorithm):**
- Graph: **8,828 nodes and 60,130 edges** covering roads, covered walkways, and open ground. Outdoor only.
- Dijkstra with a **min-heap priority queue** (O(E log V)). It runs once from the user's position and gets the cost to every node, then picks the evacuation area with the **lowest total cost**. That's the "nearest" area by safety-weighted walking distance, not straight-line distance.
- **Edge weight = length × path-type cost × wall factor.** The costs depend on the emergency:

| | Road | Covered walkway | Open ground | Near building walls (within 5 m) | Enclosed evacuation areas |
|---|---|---|---|---|---|
| Earthquake | 1.0 | 1.3 | 1.6 | up to 2× cost (falling glass/debris) | penalized (less preferred) |
| Fire | 1.0 | 4.0 (smoke collects under roofs) | 1.45 | up to 1.2× | no penalty |

- **Indoor check:** if GPS places the user inside a building, the route is removed and the user is told to go outside first. A **barometer** detects when the phone is on an upper floor; navigation starts only at ground level.
- **While walking:** turn-by-turn **voice directions** (straight, slight left or right, left or right, with metres). The app re-checks every 10 seconds for a better area, re-routes when the user strays, and has a **refresh button** to recalculate. The screen is kept awake during navigation.
- **Arrival:** the app detects entry into an evacuation area automatically (2 GPS fixes over 4 seconds), then asks **"Are you safe?"**. If the user taps "Not now", it asks again after 2 minutes.

**Status reports to the admin:** `navigating` → `arrived` → `safe_confirmed` ("I'm Safe"), with the evacuation area name. Reports are retried every 15 seconds until they go through.

### 3.3 Server (backend)

**Technology:** Node.js with Express, SQLite (better-sqlite3), bcrypt (password hashing), JSON Web Tokens (admin login, valid for 8 hours), firebase-admin (push and Firestore), TextBee API (SMS).

**Sending an alert (`POST /api/emergency`):**
- Only **fire** or **earthquake**. A fire alert **must name the affected building** ("Other" is rejected).
- **Only one active alert at a time.** A duplicate-dispatch guard blocks double clicks and two admins sending the same alert.
- Sends to **all SMS recipients** (each number once) **and** all registered phones (push), at the same time.
- **SMS goes in batches of 10 numbers** to TextBee. The gateway phone then sends the messages one by one.
- **Preview mode:** unless the server is set to `ALERT_MODE=live`, an alert creates an incident for testing monitoring but sends **no** SMS or push.

**Actual alert texts:**

| Channel | Earthquake | Fire |
|---|---|---|
| SMS | "[TomaSafe] EARTHQUAKE at UST-Legazpi Rawis. DROP, COVER, HOLD ON during shaking. When safe, follow campus personnel and use the TomaSafe push alert for instructions and outdoor routing." | "TomaSafe FIRE: {building}. INSIDE? Exit if safe; tap app push for route once outside. ELSEWHERE? No need to evacuate; stay clear unless told." |
| Push title / body | "EARTHQUAKE ALERT" / "DROP, COVER and HOLD ON during shaking. Evacuate when it is safe." | "FIRE ALERT" / "Fire reported at {building}. Follow campus safety instructions." |

Note: the fire SMS tells people **outside the affected building not to evacuate**. The SMS **does not contain a link**; the app opens from the push notification.

**Monitoring:** for the active alert, the server counts users who are navigating, arrived, confirmed safe, and not yet responded. Closing an alert saves the final counts to history.

### 3.4 Admin panel (web)

**Technology:** React with Vite, runs in a browser.

| Page | What it does |
|---|---|
| Login | Username and password. Two roles: **superadmin** and **admin** |
| Dashboard | "Emergency Alerts": Earthquake and Fire buttons. Fire asks for the affected building from a list of 14 campus buildings. A confirmation popup shows the safety instruction, and the alert goes out with "Confirm Alert". While an alert is active: **Evacuation Monitoring**, updated every 5 seconds (confirmed safe / total, not yet confirmed, and a per-person list with name, ID number, status, area, time). "Close alert" is used only when campus staff give the all-clear |
| Recipients ("Recipient Management") | List of everyone who gets SMS: app sign-ins (marked with app registration date) and people the admin adds manually (marked "SMS only"). Add, edit, delete. The admin form still offers types **Student, Faculty, Campus Personnel**, so faculty and personnel can receive **SMS only** |
| Alert History | Every alert with type, sent by, sent and closed times, duration, Confirmed Safe (e.g. 1/2). Details shows each person's status. Delete removes old or test records (not the active alert) |
| Admin Management | Superadmin only: create admins (full name, username, password) and delete them |

**Fire-alert building list:** Fra. Angelico BLDG, St. Thomas Aquinas BLDG, St. Martin BLDG, St. Albert BLDG, St. John Macias BLDG, St. Pius V Hall, San Lorenzo, Sta. Rose de Lima BLDG, St. Thomas Chapel, AQ Dome, St. Dominic BLDG, Daragang Magayon Hall, Aqui Preschool & Elementary, St. Raymond De Penafort Convent.

### 3.5 What the system does NOT do (keep the paper consistent with this)

- No indoor navigation or room-to-exit routes.
- No volcanic eruption, flood, typhoon, or other hazards. Fire and earthquake only.
- No real-time hazard sensing. Routes are based on the emergency type, not on live blocked-path data.
- No crowd or bottleneck detection. The admin sees only counts and statuses.
- No faculty or staff app accounts. They can be SMS-only recipients.
- No Peñaranda Campus.
- No iOS build was tested (Android only).
- No encryption claims beyond hashed admin passwords and login tokens.

---

## 4. Paper vs system: things to fix in the manuscript

Each row is something the current Google Doc says that **does not match** the system. The "Section" column is where it appears.

| # | Section | Paper currently says | What is true | Suggested fix |
|---|---|---|---|---|
| 1 | Statement of the Problem, Q1; Significance; Objectives; Gap; Operational Terms (Emergency Evacuation) | "students, faculty, and staff" use the system | App users are **students only**; faculty and personnel can only be **SMS-only recipients** added by the admin; only students evaluated | Change to "students" (optionally: "faculty and personnel may be added as SMS recipients") |
| 2 | Statement of the Problem (intro) | Mentions **Mayon Volcano alerts** | Scope excludes volcanic eruptions | Remove or move to Scope and Limitation as excluded |
| 3 | Statement of the Problem, Q3 | Evaluated by "improving evacuation response time, reducing confusion" | Objective 3 and the actual evaluation are **ISO 25010 Functionality, Reliability, Usability** (plus perceived effectiveness); no response-time measurement | Reword Q3 to match Objective 3 |
| 4 | Operational Terms (ISO/IEC 25010); Data Sources (Surveys); Spiral Model Phase 3 | "functionality, reliability, and **safety**" | We evaluated **usability**, not safety | Replace "safety" with "usability" |
| 5 | Operational Terms (Campus Map) | "static digital representation" | Interactive **2.5D** campus map (not 3D) with live GPS position | Update definition |
| 6 | Operational Terms (Disaster Notification) | Alerts "displayed in the mobile application" | Alerts arrive as **SMS and push notifications**; the push opens the voice guide | Update definition |
| 7 | Significance (Faculty/Staff, Campus Administration) | Teachers receive SMS to supervise Basic Education minors; system "identifies potential bottlenecks" | No Basic Education users; no bottleneck detection; admin sees status counts | Revised text drafted Nov 11, 2026 (students as app users; faculty/staff as SMS recipients; monitoring instead of bottlenecks); paste it into the Doc |
| 8a | Scope and Limitation (connectivity paragraph) | "The system operates online only ... none of these features are available offline" | The campus map and walkway graph are bundled in the app and routing runs on the phone, so map and route work offline; internet is needed only for push alerts and status reports | Revised text drafted Nov 11, 2026; paste it into the Doc |
| 8 | Scope and Limitation | "text-to-speech (TTS) guidance" | Correct, but also: voice guide indoors **and** turn-by-turn voice directions outdoors | Add the turn-by-turn voice directions |
| 9 | Data Sources (Interviews); Spiral Model Phases 1 and 4 | Feedback from "students, faculty, staff, and administrators through surveys and interviews"; "performance metrics measured during simulated evacuation drills, focusing on response time" | Only the **student Google Form** (N = 26) has data; no drill metrics recorded | Keep only what was actually done; mark the rest as plans or remove |
| 10 | Requirement Analysis | Users "from Basic Education to Tertiary levels, faculty, and staff"; "younger students in Basic Education" | Students only (tertiary respondents: CEAFA, CHS, CASE) | Rewrite user groups |
| 11 | System Architecture | Mobile app receives alert "through a push notification **or the SMS link**" | The SMS has **no link**; the app opens from the push notification (or manually) | Remove "SMS link" |
| 12 | System Architecture | "central server and database" only | Server runs on a PC; phones reach it through **Cloud Firestore** | Add Firestore to the text and to Figure 3 |
| 13 | System Requirement, Table 1 text | SQLite stores "campus layouts, user data, and evacuation routes" | SQLite stores admins, recipients, devices, incidents, alert history, statuses; the **map and walkway graph are inside the app** | Correct the sentence |
| 14 | System Requirement, Table 2 text | "Internet access is crucial for ... **map services**"; app runs on "Android and iOS" | Map and routing work **offline**; internet is needed for push and status reports; only Android was built and tested | Correct both claims |
| 15 | Implementation Plan | Usability testing with **Basic Education** sample; full-scale **campus-wide drill** | Not done; evaluation was 26 tertiary students | Present as future plan or move to Recommendations |
| 16 | Ethical Considerations | Data "encrypted or anonymized"; parental consent for minors | Admin passwords are hashed and logins use tokens; student names and numbers are stored for SMS and monitoring; no minors participated | Rewrite to what is true (consent statement on the form, RA 10173, data used only for alerts) |
| 17 | Result and Discussion, Figure 10 (Emergency Safety Instructions) | Fire steps "Alert and Stay Calm, Find a Safe Exit, Stay Outside"; earthquake steps "Drop Cover Hold, Wait for the Shaking to Stop, Exit When Safe" | The voice guide plays the **phases in Section 3.2** (fire: 7 spoken steps; earthquake: 2 phases), each phase twice | Rewrite to match the voice guide table |
| 18 | Result and Discussion, Figure 5.2 (Fire Alert) and Figure 9.1 (push) | Fire alert directs "all users to proceed to the designated evacuation areas"; fire push says "leave the building calmly and proceed to the designated evacuation area" | Fire SMS: occupants of the affected building exit; **others do not evacuate**. Fire push: "Fire reported at {building}. Follow campus safety instructions." | Quote the real texts from Section 3.3 |
| 19 | Result and Discussion, Figure 10.2 and 10.3 text | Text says "Figure 7.4" and "Figure 7.5"; the algorithm figure is labeled "Figure 7.3" | Numbering mismatch | Renumber consistently |
| 20 | Result and Discussion, Dijkstra | Weights: earthquake near walls, fire covered walkways | Correct; also add **enclosed evacuation areas are less preferred during earthquakes** and the barometer upper-floor check | Add the missing details |
| 21 | Gap To Be Bridged | "real-time evacuation guidance ... varying hazard conditions" | Routes adapt to the **emergency type**, not live hazard data | Soften "varying hazard conditions" |
| 22 | Title (varies across the paper) | "Emergency Evacuation Route Notification Using a Pathfinding Algorithm" / "... Using Dijkstra's Algorithm" / "Fire and Earthquake ..." | One title should be used everywhere | **Final title (agreed):** "UST–Legazpi Smart Campus Mobile Application for Fire and Earthquake Evacuation Route Notification Using Dijkstra's Algorithm". Replace every other version |
| 23 | Background of the Study | Mayon alerts as a disaster the system handles; "operates online"; "pathfinding algorithm" title; faculty and staff as users | Fire and earthquake only; map and routing work offline; Dijkstra; students | Revised text drafted Nov 11, 2026; paste it into the Doc to replace the old Background |

---

## 5. Files and what each one is

| File | Location | What it is |
|---|---|---|
| Evaluation responses (CSV) | `ThesisNew/Smart Campus-Based ... (Students) (Responses) - Form Responses 1.csv` | Raw Google Forms export, 27 rows (contains respondent emails, **do not share outside the group**) |
| Format reference | `ThesisNew/Very-Final-Final.pdf` | Another group's thesis (TrikeUST). Pages 51+ were used **only as the format template** for this chapter |
| Draft section (Word) | `Thesis-2/docs/Results-and-Evaluation-Section.docx` | The formatted draft to paste into the Google Doc |
| Draft generator | `Thesis-2/docs/build_results_docx.py` | Python script that recomputes every number from the CSV and rebuilds the Word file (needs `python-docx`) |
| Evaluation form script | `Thesis-2/evaluation-form/createEvaluationForm.gs` | Apps Script that created the student and PPFMO Google Forms (exact question wording) |
| Code figures | `Thesis-2/docs/code-figures/` | Screenshots of the GPS start, edge weights, Dijkstra, nearest-area, and path reconstruction code |
| System architecture | `Thesis-2/docs/system-architecture.png` | Architecture diagram |

---

## 6. Decisions already made (please don't redo these)

- **N = 26, not 27.** One respondent answered twice; only their latest response is used.
- **Format follows TrikeUST pages 51+:** Evaluation Instruments → Data Tallying and Statistical Treatment → Summary of Results → Summary of Findings → Conclusion → Recommendation. Tables are three-line academic tables (no vertical lines, no outer side borders), captions centered and italic **below** the table, means written as "Functionality Mean: 4.63 – Strongly Agree".
- **Respondent profile table removed** from the results.
- **SMS latency section removed.** Only the student evaluation is reported. The paid-SMS-gateway recommendation stays, supported by the respondents' feedback only.
- **Form screenshots:** we will take real screenshots of the Google Form ourselves (placeholders are in the draft).
- **The map is "2.5D", never "3D".** It's an angled top-down view with raised building blocks, not a 3D design, even though it looks 3D. Use "2.5D campus map" everywhere in the paper.
- **No invented data.** Every number in the draft comes from the CSV.

---

## 7. Results at a glance (N = 26)

| Category | Mean | Interpretation |
|---|---|---|
| Functionality | 4.63 | Strongly Agree |
| Reliability | 4.71 | Strongly Agree |
| Usability | 4.73 | Strongly Agree |
| **Overall ISO 25010** | **4.69** | **Strongly Agree** |
| Perceived Effectiveness (Part IV of form) | 4.79 | Strongly Agree |

- Highest item: "The map and route still worked even with weak or no internet" (4.85).
- Lowest item: "The app told me what to do during a fire or earthquake" (4.54), still Strongly Agree.
- Respondents: CEAFA 16, CHS 9, CASE 1; collected November 9–10, 2026.
- Open-ended themes: slight map stutter/glitches (1), faster SMS response time (2), design/UI (2); everyone else answered none/N/A.

**Likert scale:** 4.21–5.00 Strongly Agree · 3.41–4.20 Agree · 2.61–3.40 Neutral · 1.81–2.60 Disagree · 1.00–1.80 Strongly Disagree.

---

## 8. Things to watch out for

- **Group members among respondents.** Responses came from accounts with the surnames Estocado and Jaraba. A panelist may ask why researchers rated their own system. Decide as a group whether to keep or remove them; if removed, rerun `build_results_docx.py` after deleting those rows from a copy of the CSV and update every number.
- **Objectives 1 and 2 are supported by user ratings, not measured tests.** The conclusion says this. Don't add performance numbers unless we actually have logged data.
- **Only students were evaluated.** The PPFMO form exists in the script but has no responses in our data.

---

## 9. Open to-do list

- [ ] Go through every row of Section 4 and fix the manuscript so it matches the real system (Section 3).
- [ ] Update Figure 3 (System Architecture) to include Cloud Firestore and the TextBee gateway phone.
- [ ] Take screenshots of the Google Form and insert them as Figures 11, 11.1, 11.2 (replace the three "[Insert screenshot...]" lines).
- [ ] Fix figure numbering in the earlier Result and Discussion part: "Figure 10.2" and "Figure 10.3" are described in the text as "Figure 7.4" and "Figure 7.5", and the algorithm figure is labeled "Figure 7.3". Renumber those, then make the new figures follow (currently Figure 11). The new tables start at **Table 3** because the doc already has Tables 1–2.
- [ ] Decide on the group-member responses (Section 8).
- [ ] Check the "Significance of the Study" Twilio note and the paid-gateway recommendation say the same thing.
- [ ] After pasting into Google Docs, check tables: if gray borders reappear, set side and inner borders to 0 pt.
- [ ] Proofread the whole chapter in one voice once everyone is done.

---

## 10. If you need to change numbers

1. Install once: `pip install python-docx`
2. Edit the CSV copy (never the original export).
3. Run from the `Thesis-2/docs` folder:
   `python build_results_docx.py "<path to CSV>" Results-and-Evaluation-Section.docx`
4. The script prints the new means; every table and sentence in the Word file updates automatically.

---

## 11. Full draft text

Below is the complete text of the draft section, including tables, exactly as in the Word file.

#### Evaluation Instruments and Data Collection Tools

#### Student Evaluation Form

[Insert screenshot of the evaluation form here]

*Figure 11. Student Evaluation Form – Data Privacy Consent and Part I: Profile*

[Insert screenshot of the evaluation form here]

*Figure 11.1. Student Evaluation Form – Part II: ISO/IEC 25010 Questions*

[Insert screenshot of the evaluation form here]

*Figure 11.2. Student Evaluation Form – Part III: Open-Ended and Part IV: Effectiveness*

Figures 11 to 11.2 present the ISO/IEC 25010-Based System Evaluation Form used to gather student responses for the third objective of the study. The form was administered online through Google Forms and begins with a data privacy consent statement, followed by a respondent profile section asking for the college, year level, and the number of campus evacuation drills the respondent has joined. The rating section contains ten statements grouped under three ISO/IEC 25010 quality characteristics: four statements on Functionality, which cover the receipt of the emergency alert, the safety instructions for fire and earthquake, the clarity of the 2.5D campus map, and the display of a route to the nearest evacuation area; three statements on Reliability, which cover crash-free operation, consistent delivery of alerts, and the operation of the map and route under weak or no internet connection; and three statements on Usability, which cover ease of use for first-time users, the number of taps needed to obtain a route, and the readability of the text, icons, and colors. The form also contains two statements on the perceived effectiveness of the system in supporting evacuation and emergency preparedness, and two open-ended questions asking the respondents about the problems they encountered and the improvements they would suggest.

The student evaluation consisted of 26 UST–Legazpi students who used the functional version of the TomaSafe mobile application during testing. The responses were collected from November 9 to November 10, 2026. One respondent submitted the form twice; only the latest submission of that respondent was retained, resulting in 26 valid responses. All rating statements were evaluated using a five-point Likert scale, where 5 represented Strongly Agree and 1 represented Strongly Disagree.

The responses of the 26 student respondents were consolidated and the numerical ratings for each item were computed. The weighted mean was used to determine the respondents’ assessment of the Functionality, Reliability, and Usability of the system, as well as its perceived effectiveness. The responses to the open-ended questions were reviewed and grouped by theme as supporting qualitative feedback.

#### Data Tallying and Statistical Treatment

The data gathered from the evaluation instrument were tallied and analyzed according to the measures identified in the objectives of the study. The following statistical procedures were used in analyzing the collected data.

#### ISO/IEC 25010-Based System Evaluation

For the third objective, the student responses were analyzed using the weighted mean. Each response was assigned a numerical value from 1 to 5 based on the five-point Likert scale. The weighted mean of each statement was first computed, after which the item means under the same quality characteristic were averaged to obtain the mean score for each characteristic.

For each statement:

WM = Σ(fx) / N

Where:

- WM = Weighted Mean

- f = frequency of responses for each scale value

- x = numerical weight of the response

- N = total number of respondents

For each quality characteristic:

X̄q = ΣWMᵢ / k

Where:

- X̄q = mean of the quality characteristic

- WMᵢ = weighted mean of each item under the characteristic

- k = number of items under that characteristic

The same procedure was applied to the two statements on perceived effectiveness. The computed means were interpreted using the scale presented in Table 3.

| Mean Range | Descriptive Equivalent |
|---|---|
| 4.21 – 5.00 | Strongly Agree |
| 3.41 – 4.20 | Agree |
| 2.61 – 3.40 | Neutral |
| 1.81 – 2.60 | Disagree |
| 1.00 – 1.80 | Strongly Disagree |

*Table 3. Interpretation Scale for the Five-Point Likert Evaluation*

### SUMMARY OF RESULTS

#### ISO/IEC 25010-Based System Evaluation Summary

##### Functionality

| Item | Statement | Students Mean (n = 26) | Descriptive Equivalent |
|---|---|---|---|
| 1 | I received the emergency alert on my phone (SMS or push notification). | 4.73 | Strongly Agree |
| 2 | The app told me what to do during a fire or earthquake. | 4.54 | Strongly Agree |
| 3 | The 2.5D campus map clearly shows the buildings, pathways and evacuation areas. | 4.65 | Strongly Agree |
| 4 | The app showed me a route to the nearest evacuation area. | 4.62 | Strongly Agree |

*Table 4. Functionality Data*

Functionality Mean: 4.63 – Strongly Agree

Table 4 presents the Functionality results of TomaSafe. The students obtained an overall mean of 4.63, interpreted as Strongly Agree, indicating that the system performs its intended functions. The highest-rated statement was the receipt of the emergency alert through SMS or push notification (WM = 4.73), followed by the clarity of the 2.5D campus map (WM = 4.65) and the display of a route to the nearest evacuation area (WM = 4.62). The statement on the app telling the user what to do during a fire or earthquake obtained the lowest mean in this category (WM = 4.54), although it remained within the Strongly Agree range. These results relate directly to the first and second objectives, as they show that the respondents received the disaster notifications, viewed the campus buildings, pathways, and evacuation areas on the 2.5D map, and were shown a route to the nearest evacuation area.

##### Reliability

| Item | Statement | Students Mean (n = 26) | Descriptive Equivalent |
|---|---|---|---|
| 1 | The app worked without crashing. | 4.69 | Strongly Agree |
| 2 | Alerts arrived every time one was sent. | 4.58 | Strongly Agree |
| 3 | The map and route still worked even with weak or no internet. | 4.85 | Strongly Agree |

*Table 4.1. Reliability Data*

Reliability Mean: 4.71 – Strongly Agree

Table 4.1 presents the Reliability results of TomaSafe. The students obtained an overall mean of 4.71, interpreted as Strongly Agree. The statement that the map and route still worked even with weak or no internet obtained the highest mean of all ten ISO statements (WM = 4.85), which reflects the design decision to build the campus map and route computation into the application so that they run on the phone without an internet connection. Crash-free operation obtained a mean of 4.69, while consistent delivery of alerts obtained 4.58, the lowest in this category. The results indicate that the respondents found the system consistent and dependable during use.

##### Usability

| Item | Statement | Students Mean (n = 26) | Descriptive Equivalent |
|---|---|---|---|
| 1 | The app was easy to understand and use, even the first time. | 4.69 | Strongly Agree |
| 2 | Getting a route took only a few taps. | 4.73 | Strongly Agree |
| 3 | The text, icons and colors were easy to read. | 4.77 | Strongly Agree |

*Table 4.2. Usability Data*

Usability Mean: 4.73 – Strongly Agree

Table 4.2 presents the Usability results of TomaSafe. The students obtained an overall mean of 4.73, interpreted as Strongly Agree, the highest among the three quality characteristics. The readability of the text, icons, and colors obtained a mean of 4.77, obtaining a route in only a few taps obtained 4.73, and ease of use even on the first try obtained 4.69. No respondent gave a rating lower than Agree for any usability statement. The results indicate that the respondents found the application easy to learn, understand, and operate, which is important for a tool that must be used quickly under the pressure of an emergency.

##### Summary of the ISO/IEC 25010 Evaluation

| Quality Characteristic | Mean | Interpretation |
|---|---|---|
| Functionality | 4.63 | Strongly Agree |
| Reliability | 4.71 | Strongly Agree |
| Usability | 4.73 | Strongly Agree |
| Overall Mean | 4.69 | Strongly Agree |

*Table 5. Summary of the ISO/IEC 25010-Based System Evaluation*

Table 5 summarizes the results of the ISO/IEC 25010-based evaluation. Usability obtained the highest mean (4.73), followed by Reliability (4.71) and Functionality (4.63). The overall mean of 4.69, interpreted as Strongly Agree, indicates that the student respondents positively evaluated TomaSafe across all three selected quality characteristics.

##### Perceived Effectiveness

| Item | Statement | Students Mean (n = 26) | Descriptive Equivalent |
|---|---|---|---|
| 1 | The app would help me evacuate faster during an emergency. | 4.77 | Strongly Agree |
| 2 | Using the app makes me feel more prepared for a fire or earthquake on campus. | 4.81 | Strongly Agree |

*Table 6. Perceived Effectiveness Data*

Perceived Effectiveness Mean: 4.79 – Strongly Agree

Table 6 presents the students’ perception of the effectiveness of TomaSafe. The statement that using the app makes the respondent feel more prepared for a fire or earthquake on campus obtained a mean of 4.81, while the statement that the app would help the respondent evacuate faster during an emergency obtained 4.77. The overall mean of 4.79, interpreted as Strongly Agree, indicates that the respondents believe the system supports faster evacuation and improves their preparedness, which is consistent with the general objective of the study.

##### Qualitative Feedback

The responses to the two open-ended questions were reviewed and grouped by theme. Most respondents reported no problems and suggested no improvements, answering “none” or “N/A” or leaving the item blank, while two respondents described the system as easy to use and smooth. The comments that did identify issues are summarized in Table 7.

| Theme | Frequency | Sample Response |
|---|---|---|
| Slight glitches or stutter in the map | 1 | “the map itself is good, just some slight glitches” |
| Faster SMS response time | 2 | “a faster response time would be nicer” |
| Design and user interface | 2 | “Design”; “UI” |

*Table 7. Themes from the Open-Ended Responses*

Table 7 shows that the suggested improvements were minor and centered on the smoothness of the map, the delivery time of the SMS alert, and the visual design of the interface. These comments did not point to failures of the core functions but to areas for refinement, and they are reflected in the recommendations of the study.

### SUMMARY OF FINDINGS

The study developed and evaluated TomaSafe, the UST–Legazpi Smart Campus-Based Emergency Evacuation Route Notification System, based on the three specific objectives of the research. The findings were derived from the implementation of the system and the responses of 26 student respondents.

#### Disaster Notification and Alert Dispatch Feature and 2.5D Campus Map

The system successfully implemented an administrator panel that allows authorized administrators to log in, manage the recipient list, and send predefined fire or earthquake alerts with a single confirmation. Each alert is delivered simultaneously as an SMS through the TextBee SMS gateway and as a push notification through Firebase Cloud Messaging, and the admin panel records the alert history and the safety status of each responding user. On the user side, the mobile application presents emergency safety instructions with voice guidance and an interactive 2.5D campus map showing the buildings, outdoor pathways, nine designated evacuation areas, and the user’s GPS location.

In the evaluation, receipt of the emergency alert through SMS or push notification obtained a mean of 4.73, and the clarity of the 2.5D campus map obtained 4.65, both interpreted as Strongly Agree.

#### Evacuation Route Generation Using Dijkstra’s Algorithm

The system applied Dijkstra’s algorithm to a node-based network of the Rawis Campus walkways, composed of 8,828 points and 60,130 links, to compute the shortest outdoor route from the user’s GPS location to the nearest of the nine designated evacuation areas. Link weights are adjusted by emergency type so that areas near building walls are avoided during an earthquake and covered walkways are avoided during a fire. The route is drawn on the 2.5D map with turn-by-turn voice directions and computed on the device without an internet connection.

The display of a route to the nearest evacuation area obtained a mean of 4.62, and the operation of the map and route under weak or no internet obtained 4.85, both interpreted as Strongly Agree.

#### ISO/IEC 25010-Based System Evaluation

The developed system received favorable evaluations from the student respondents based on the selected ISO/IEC 25010 quality characteristics. Functionality obtained a mean of 4.63, Reliability obtained 4.71, and Usability obtained 4.73, with an overall mean of 4.69. All computed means were interpreted as Strongly Agree. In addition, the perceived effectiveness of the system obtained a mean of 4.79, also interpreted as Strongly Agree.

### CONCLUSION

Based on the findings, the first objective of the study was achieved through the development of a mobile application-based system that manages, processes, and delivers disaster notifications through SMS and push notifications, integrated with an interactive 2.5D campus map of the buildings, outdoor pathways, and designated evacuation areas of the Rawis Campus. The respondents’ ratings of 4.73 for receiving the alert and 4.65 for the clarity of the campus map indicate that the notification and map features worked as intended during testing.

The second objective was achieved through the application of Dijkstra’s algorithm to identify the shortest and safer outdoor evacuation route from the user’s location to the nearest designated evacuation area, accessible directly through the mobile application. The respondents’ ratings for the display of the route (4.62) and for its operation without internet (4.85) indicate that the route generation feature was perceived as working and dependable. However, these results reflect user perception and should be interpreted within the scope of the conducted testing.

The third objective was achieved through the evaluation of the system using selected ISO/IEC 25010 software quality characteristics. The student respondents rated Functionality, Reliability, and Usability within the Strongly Agree range, with an overall mean of 4.69. These results indicate that the developed system was positively evaluated in terms of its intended functions, dependable operation, and ease of use within the scope of the conducted evaluation of 26 student respondents.

### RECOMMENDATION

Based on the findings, conclusions, and limitations of the study, the researchers recommend further development and testing of TomaSafe to improve its performance and readiness for campus-wide implementation.

Broader System Evaluation. Future evaluations should involve a larger and more diverse group of respondents, including students from all colleges and the Basic Education department, faculty, staff, and the PPFMO, to provide stronger evidence of the system’s Functionality, Reliability, and Usability.

Use of a Paid SMS Gateway Provider. The current system sends SMS alerts through TextBee, a free SMS gateway that relays messages through a single Android phone with prepaid load. Because each message is sent one at a time from that device, delivery becomes slower as the number of recipients increases, which is consistent with the respondents’ suggestion for a faster SMS response time. Future researchers are advised to use a paid SMS gateway provider, such as Twilio, Semaphore, or a similar commercial service, which offers higher sending throughput, delivery reports, and more consistent delivery when alerts are sent to the entire campus population at once.

Measurement of Alert Delivery Time. Future testing should record the time from alert dispatch to receipt of the SMS and push notification across multiple trials, mobile networks, and recipient counts, to measure how delivery time changes as the number of recipients grows.

Improvement of Map Performance and Interface Design. The 2.5D campus map should be further optimized to remove the slight stutter reported by a respondent, especially on lower-end devices, and the interface design may be refined based on user feedback.

Campus-Wide Evacuation Drill Testing. The system should be tested during an actual campus-wide evacuation drill with safety officers present, to compare evacuation time and route accuracy with and without the application.

Expansion of Coverage. Future versions may extend the system to indoor navigation, the Peñaranda Campus, and other hazards affecting the campus, such as volcanic eruptions and floods.
