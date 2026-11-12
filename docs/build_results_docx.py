import csv, sys, os, collections
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

CSV, OUT = sys.argv[1], sys.argv[2]
rows = list(csv.reader(open(CSV, encoding='utf-8')))
H, data = rows[0], rows[1:]
# drop duplicate submissions: keep latest per email
seen, dd = set(), []
for r in reversed(data):
    if r[1] in seen: continue
    seen.add(r[1]); dd.append(r)
data = list(reversed(dd))
N = len(data)

def interp(m):
    return ('Strongly Agree' if m >= 4.21 else 'Agree' if m >= 3.41 else
            'Neutral' if m >= 2.61 else 'Disagree' if m >= 1.81 else 'Strongly Disagree')

def item(c):
    v = [int(r[c][0]) for r in data]
    f = collections.Counter(v)
    wm = round(sum(v) / len(v), 2)
    return dict(text=H[c].split('[', 1)[1].rstrip(']'), f=f, wm=wm)

CATS = {'Functionality': [6, 7, 8, 9], 'Reliability': [10, 11, 12],
        'Usability': [13, 14, 15], 'Effectiveness': [18, 19]}
R = {k: [item(c) for c in cols] for k, cols in CATS.items()}
M = {k: round(sum(i['wm'] for i in v) / len(v), 2) for k, v in R.items()}
ISO = ['Functionality', 'Reliability', 'Usability']
overall = round(sum(M[k] for k in ISO) / 3, 2)
col = collections.Counter(r[3] for r in data)
yr = collections.Counter(r[4] for r in data)
drill = collections.Counter(r[5].replace('–', '-') for r in data)
pct = lambda n: f"{n / N * 100:.2f}%"

doc = Document()
st = doc.styles['Normal']
st.font.name = 'Times New Roman'; st.font.size = Pt(12)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.5
for s in doc.sections:
    s.left_margin = s.right_margin = s.top_margin = s.bottom_margin = Inches(1)

def para(text, indent=True, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    p = doc.add_paragraph()
    p.alignment = align
    if indent: p.paragraph_format.first_line_indent = Inches(0.5)
    r = p.add_run(text); r.bold = bold; r.italic = italic
    return p

def heading(text, center=False):
    p = para(text, indent=False, bold=True,
             align=WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT)
    p.paragraph_format.space_before = Pt(12)

def caption(text):
    p = para(text, indent=False, align=WD_ALIGN_PARAGRAPH.CENTER); p.runs[0].italic = True

def subheading(text):
    p = para(text, indent=False, italic=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    p.paragraph_format.space_before = Pt(6)

def bullet(text):
    p = doc.add_paragraph(style='List Bullet'); p.add_run(text)
    p.paragraph_format.line_spacing = 1.15

def eq(text):
    p = para(text, indent=False, align=WD_ALIGN_PARAGRAPH.CENTER); p.runs[0].italic = True

from docx.oxml import OxmlElement
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT

def _borders(el_pr, tag, spec):
    """spec: {'top': size_eighths_pt or 0, ...}; 0 = no line."""
    b = el_pr.find(qn(tag))
    if b is None:
        b = OxmlElement(tag); el_pr.append(b)
    for side, sz in spec.items():
        e = b.find(qn('w:' + side))
        if e is None:
            e = OxmlElement('w:' + side); b.append(e)
        e.set(qn('w:val'), 'single' if sz else 'nil')
        if sz:
            e.set(qn('w:sz'), str(sz)); e.set(qn('w:space'), '0'); e.set(qn('w:color'), '000000')

def table(header, body, widths=None, left_cols=(1,), rule_before_last=False):
    """Academic three-line table: rule above header, rule under header, rule at bottom.
    No vertical lines and no side borders."""
    t = doc.add_table(rows=1, cols=len(header))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    _borders(t._tbl.tblPr, 'w:tblBorders',
             {'top': 12, 'bottom': 12, 'left': 0, 'right': 0, 'insideH': 0, 'insideV': 0})
    for i, h in enumerate(header):
        c = t.rows[0].cells[i]; c.text = ''
        rr = c.paragraphs[0].add_run(h); rr.bold = True; rr.italic = True
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        _borders(c._tc.get_or_add_tcPr(), 'w:tcBorders', {'bottom': 6})
    for ri, row in enumerate(body):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ''
            cells[i].paragraphs[0].add_run(str(v))
            cells[i].paragraphs[0].alignment = (WD_ALIGN_PARAGRAPH.LEFT if i in left_cols
                                                else WD_ALIGN_PARAGRAPH.CENTER)
            if rule_before_last and ri == len(body) - 1:
                _borders(cells[i]._tc.get_or_add_tcPr(), 'w:tcBorders', {'top': 4})
    for ri, row in enumerate(t.rows):
        trPr = row._tr.get_or_add_trPr()
        trPr.append(OxmlElement('w:cantSplit'))
        if ri == 0: trPr.append(OxmlElement('w:tblHeader'))
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for p in cell.paragraphs:
                p.paragraph_format.line_spacing = 1.0
                p.paragraph_format.space_before = Pt(3); p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.first_line_indent = None
                for r in p.runs: r.font.size = Pt(10)
    if widths:
        t.autofit = False
        for i, gc in enumerate(t._tbl.tblGrid.findall(qn('w:gridCol'))):
            gc.set(qn('w:w'), str(int(widths[i] * 1440)))
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Inches(w)
    return t

def item_table(cat, label):
    body = [[n, i['text'], f"{i['wm']:.2f}", interp(i['wm'])] for n, i in enumerate(R[cat], 1)]
    table(['Item', 'Statement', f'Students Mean\n(n = {N})', 'Descriptive\nEquivalent'], body,
          widths=[0.5, 3.6, 1.1, 1.3], left_cols=(1,))

# ---------------------------------------------------------------- content
heading('Evaluation Instruments and Data Collection Tools')
heading('Student Evaluation Form')
FORM_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'form')
def figure(img, cap, width=3.8):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = None
    r = p.add_run('[Insert screenshot of the evaluation form here]'); r.italic = True
    caption(cap)
figure('form1.png', 'Figure 11. Student Evaluation Form – Data Privacy Consent and Part I: Profile', 4.2)
figure('form2.png', 'Figure 11.1. Student Evaluation Form – Part II: ISO/IEC 25010 Questions', 3.7)
figure('form3.png', 'Figure 11.2. Student Evaluation Form – Part III: Open-Ended and Part IV: Effectiveness', 4.2)
para('Figures 11 to 11.2 present the ISO/IEC 25010-Based System Evaluation Form used to gather student responses '
     'for the third objective of the study. The form was administered online through Google Forms and begins '
     'with a data privacy consent statement, followed by a respondent profile section asking for the college, '
     'year level, and the number of campus evacuation drills the respondent has joined. The rating section '
     'contains ten statements grouped under three ISO/IEC 25010 quality characteristics: four statements on '
     'Functionality, which cover the receipt of the emergency alert, the safety instructions for fire and '
     'earthquake, the clarity of the 2.5D campus map, and the display of a route to the nearest evacuation area; '
     'three statements on Reliability, which cover crash-free operation, consistent delivery of alerts, and the '
     'operation of the map and route under weak or no internet connection; and three statements on Usability, '
     'which cover ease of use for first-time users, the number of taps needed to obtain a route, and the '
     'readability of the text, icons, and colors. The form also contains two statements on the perceived '
     'effectiveness of the system in supporting evacuation and emergency preparedness, and two open-ended '
     'questions asking the respondents about the problems they encountered and the improvements they would '
     'suggest.')
para(f'The student evaluation consisted of {N} UST–Legazpi students who used the functional version of the '
     'TomaSafe mobile application during testing. The responses were collected from November 9 to November 10, '
     '2026. One respondent submitted the form twice; only the latest submission of that respondent was retained, '
     f'resulting in {N} valid responses. All rating statements were evaluated using a five-point Likert scale, '
     'where 5 represented Strongly Agree and 1 represented Strongly Disagree.')
para(f'The responses of the {N} student respondents were consolidated and the numerical ratings for each '
     'item were computed. The weighted mean was used to determine the respondents’ assessment of the '
     'Functionality, Reliability, and Usability of the system, as well as its perceived effectiveness. '
     'The responses to the open-ended questions were reviewed and grouped by theme as supporting '
     'qualitative feedback.')

heading('Data Tallying and Statistical Treatment')
para('The data gathered from the evaluation instrument were tallied and analyzed according to the measures '
     'identified in the objectives of the study. The following statistical procedures were used in analyzing '
     'the collected data.')
heading('ISO/IEC 25010-Based System Evaluation')
para('For the third objective, the student responses were analyzed using the weighted mean. Each response was '
     'assigned a numerical value from 1 to 5 based on the five-point Likert scale. The weighted mean of each '
     'statement was first computed, after which the item means under the same quality characteristic were '
     'averaged to obtain the mean score for each characteristic.')
para('For each statement:', indent=False)
eq('WM = Σ(fx) / N')
para('Where:', indent=False)
for b in ['WM = Weighted Mean', 'f = frequency of responses for each scale value',
          'x = numerical weight of the response', 'N = total number of respondents']:
    bullet(b)
para('For each quality characteristic:', indent=False)
eq('X̄q = ΣWMᵢ / k')
para('Where:', indent=False)
for b in ['X̄q = mean of the quality characteristic', 'WMᵢ = weighted mean of each item under the characteristic',
          'k = number of items under that characteristic']:
    bullet(b)
para('The same procedure was applied to the two statements on perceived effectiveness. The computed means '
     'were interpreted using the scale presented in Table 3.')
table(['Mean Range', 'Descriptive Equivalent'],
      [['4.21 – 5.00', 'Strongly Agree'], ['3.41 – 4.20', 'Agree'], ['2.61 – 3.40', 'Neutral'],
       ['1.81 – 2.60', 'Disagree'], ['1.00 – 1.80', 'Strongly Disagree']], widths=[2, 2.5], left_cols=())
caption('Table 3. Interpretation Scale for the Five-Point Likert Evaluation')

# ---------------------------------------------------------------- results
heading('SUMMARY OF RESULTS', center=True)
heading('ISO/IEC 25010-Based System Evaluation Summary')
subheading('Functionality')
item_table('Functionality', 'Functionality')
caption('Table 4. Functionality Data')
para(f'Functionality Mean: {M["Functionality"]:.2f} – {interp(M["Functionality"])}', indent=False)
F = R['Functionality']
para(f'Table 4 presents the Functionality results of TomaSafe. The students obtained an overall mean of '
     f'{M["Functionality"]:.2f}, interpreted as {interp(M["Functionality"])}, indicating that the system '
     'performs its intended functions. The highest-rated statement was the receipt of the emergency alert '
     f'through SMS or push notification (WM = {F[0]["wm"]:.2f}), followed by the clarity of the 2.5D campus map '
     f'(WM = {F[2]["wm"]:.2f}) and the display of a route to the nearest evacuation area (WM = {F[3]["wm"]:.2f}). '
     'The statement on the app telling the user what to do during a fire or earthquake obtained the lowest '
     f'mean in this category (WM = {F[1]["wm"]:.2f}), although it remained within the Strongly Agree range. '
     'These results relate directly to the first and second objectives, as they show that the respondents '
     'received the disaster notifications, viewed the campus buildings, pathways, and evacuation areas on the '
     '2.5D map, and were shown a route to the nearest evacuation area.')

subheading('Reliability')
item_table('Reliability', 'Reliability')
caption('Table 4.1. Reliability Data')
para(f'Reliability Mean: {M["Reliability"]:.2f} – {interp(M["Reliability"])}', indent=False)
Rl = R['Reliability']
para(f'Table 4.1 presents the Reliability results of TomaSafe. The students obtained an overall mean of '
     f'{M["Reliability"]:.2f}, interpreted as {interp(M["Reliability"])}. The statement that the map and route still '
     f'worked even with weak or no internet obtained the highest mean of all ten ISO statements (WM = {Rl[2]["wm"]:.2f}), '
     'which reflects the design decision to build the campus map and route computation into the application '
     f'so that they run on the phone without an internet connection. Crash-free operation obtained a mean of '
     f'{Rl[0]["wm"]:.2f}, while consistent delivery of alerts obtained {Rl[1]["wm"]:.2f}, the lowest in this category. '
     'The results indicate that the respondents found the system consistent and dependable during use.')

subheading('Usability')
item_table('Usability', 'Usability')
caption('Table 4.2. Usability Data')
para(f'Usability Mean: {M["Usability"]:.2f} – {interp(M["Usability"])}', indent=False)
U = R['Usability']
para(f'Table 4.2 presents the Usability results of TomaSafe. The students obtained an overall mean of '
     f'{M["Usability"]:.2f}, interpreted as {interp(M["Usability"])}, the highest among the three quality '
     f'characteristics. The readability of the text, icons, and colors obtained a mean of {U[2]["wm"]:.2f}, '
     f'obtaining a route in only a few taps obtained {U[1]["wm"]:.2f}, and ease of use even on the first try '
     f'obtained {U[0]["wm"]:.2f}. No respondent gave a rating lower than Agree for any usability statement. The '
     'results indicate that the respondents found the application easy to learn, understand, and operate, '
     'which is important for a tool that must be used quickly under the pressure of an emergency.')

subheading('Summary of the ISO/IEC 25010 Evaluation')
table(['Quality Characteristic', 'Mean', 'Interpretation'],
      [[k, f"{M[k]:.2f}", interp(M[k])] for k in ISO] + [['Overall Mean', f"{overall:.2f}", interp(overall)]],
      widths=[2.6, 1, 1.8], left_cols=(0,), rule_before_last=True)
caption('Table 5. Summary of the ISO/IEC 25010-Based System Evaluation')
para(f'Table 5 summarizes the results of the ISO/IEC 25010-based evaluation. Usability obtained the highest '
     f'mean ({M["Usability"]:.2f}), followed by Reliability ({M["Reliability"]:.2f}) and Functionality '
     f'({M["Functionality"]:.2f}). The overall mean of {overall:.2f}, interpreted as {interp(overall)}, indicates '
     'that the student respondents positively evaluated TomaSafe across all three selected quality '
     'characteristics.')

subheading('Perceived Effectiveness')
item_table('Effectiveness', 'Perceived Effectiveness')
caption('Table 6. Perceived Effectiveness Data')
para(f'Perceived Effectiveness Mean: {M["Effectiveness"]:.2f} – {interp(M["Effectiveness"])}', indent=False)
E = R['Effectiveness']
para(f'Table 6 presents the students’ perception of the effectiveness of TomaSafe. The statement that using '
     f'the app makes the respondent feel more prepared for a fire or earthquake on campus obtained a mean of '
     f'{E[1]["wm"]:.2f}, while the statement that the app would help the respondent evacuate faster during an '
     f'emergency obtained {E[0]["wm"]:.2f}. The overall mean of {M["Effectiveness"]:.2f}, interpreted as '
     f'{interp(M["Effectiveness"])}, indicates that the respondents believe the system supports faster '
     'evacuation and improves their preparedness, which is consistent with the general objective of the study.')

subheading('Qualitative Feedback')
para('The responses to the two open-ended questions were reviewed and grouped by theme. Most respondents '
     'reported no problems and suggested no improvements, answering “none” or “N/A” or leaving the item '
     'blank, while two respondents described the system as easy to use and smooth. The comments that did '
     'identify issues are summarized in Table 7.')
table(['Theme', 'Frequency', 'Sample Response'],
      [['Slight glitches or stutter in the map', '1', '“the map itself is good, just some slight glitches”'],
       ['Faster SMS response time', '2', '“a faster response time would be nicer”'],
       ['Design and user interface', '2', '“Design”; “UI”']], widths=[2.2, 0.9, 3.0], left_cols=(0, 2))
caption('Table 7. Themes from the Open-Ended Responses')
para('Table 7 shows that the suggested improvements were minor and centered on the smoothness of the map, '
     'the delivery time of the SMS alert, and the visual design of the interface. These comments did not '
     'point to failures of the core functions but to areas for refinement, and they are reflected in the '
     'recommendations of the study.')

# ---------------------------------------------------------------- findings
heading('SUMMARY OF FINDINGS', center=True)
para(f'The study developed and evaluated TomaSafe, the UST–Legazpi Smart Campus-Based Emergency Evacuation '
     f'Route Notification System, based on the three specific objectives of the research. The findings were '
     f'derived from the implementation of the system and the responses of {N} student respondents.')
heading('Disaster Notification and Alert Dispatch Feature and 2.5D Campus Map')
para('The system successfully implemented an administrator panel that allows authorized administrators to '
     'log in, manage the recipient list, and send predefined fire or earthquake alerts with a single '
     'confirmation. Each alert is delivered simultaneously as an SMS through the TextBee SMS gateway and as a '
     'push notification through Firebase Cloud Messaging, and the admin panel records the alert history and '
     'the safety status of each responding user. On the user side, the mobile application presents emergency '
     'safety instructions with voice guidance and an interactive 2.5D campus map showing the buildings, '
     'outdoor pathways, nine designated evacuation areas, and the user’s GPS location.')
para(f'In the evaluation, receipt of the emergency alert through SMS or push notification obtained a mean of '
     f'{F[0]["wm"]:.2f}, and the clarity of the 2.5D campus map obtained {F[2]["wm"]:.2f}, both interpreted as '
     'Strongly Agree.')
heading('Evacuation Route Generation Using Dijkstra’s Algorithm')
para('The system applied Dijkstra’s algorithm to a node-based network of the Rawis Campus walkways, '
     'composed of 8,828 points and 60,130 links, to compute the shortest outdoor route from the user’s GPS '
     'location to the nearest of the nine designated evacuation areas. Link weights are adjusted by emergency '
     'type so that areas near building walls are avoided during an earthquake and covered walkways are '
     'avoided during a fire. The route is drawn on the 2.5D map with turn-by-turn voice directions and '
     'computed on the device without an internet connection.')
para(f'The display of a route to the nearest evacuation area obtained a mean of {F[3]["wm"]:.2f}, and the '
     f'operation of the map and route under weak or no internet obtained {Rl[2]["wm"]:.2f}, both interpreted as '
     'Strongly Agree.')
heading('ISO/IEC 25010-Based System Evaluation')
para(f'The developed system received favorable evaluations from the student respondents based on the '
     f'selected ISO/IEC 25010 quality characteristics. Functionality obtained a mean of {M["Functionality"]:.2f}, '
     f'Reliability obtained {M["Reliability"]:.2f}, and Usability obtained {M["Usability"]:.2f}, with an overall mean '
     f'of {overall:.2f}. All computed means were interpreted as Strongly Agree. In addition, the perceived '
     f'effectiveness of the system obtained a mean of {M["Effectiveness"]:.2f}, also interpreted as Strongly Agree.')

# ---------------------------------------------------------------- conclusion
heading('CONCLUSION', center=True)
para('Based on the findings, the first objective of the study was achieved through the development of a '
     'mobile application-based system that manages, processes, and delivers disaster notifications through '
     'SMS and push notifications, integrated with an interactive 2.5D campus map of the buildings, outdoor '
     f'pathways, and designated evacuation areas of the Rawis Campus. The respondents’ ratings of {F[0]["wm"]:.2f} '
     f'for receiving the alert and {F[2]["wm"]:.2f} for the clarity of the campus map indicate that the notification '
     'and map features worked as intended during testing.')
para('The second objective was achieved through the application of Dijkstra’s algorithm to identify the '
     'shortest and safer outdoor evacuation route from the user’s location to the nearest designated '
     'evacuation area, accessible directly through the mobile application. The respondents’ ratings for the '
     f'display of the route ({F[3]["wm"]:.2f}) and for its operation without internet ({Rl[2]["wm"]:.2f}) indicate '
     'that the route generation feature was perceived as working and dependable. However, these results '
     'reflect user perception and should be interpreted within the scope of the conducted testing.')
para('The third objective was achieved through the evaluation of the system using selected ISO/IEC 25010 '
     'software quality characteristics. The student respondents rated Functionality, Reliability, and '
     f'Usability within the Strongly Agree range, with an overall mean of {overall:.2f}. These results indicate '
     'that the developed system was positively evaluated in terms of its intended functions, dependable '
     f'operation, and ease of use within the scope of the conducted evaluation of {N} student respondents.')

# ---------------------------------------------------------------- recommendation
heading('RECOMMENDATION', center=True)
para('Based on the findings, conclusions, and limitations of the study, the researchers recommend further '
     'development and testing of TomaSafe to improve its performance and readiness for campus-wide '
     'implementation.')
recs = [
    ('Broader System Evaluation. ', 'Future evaluations should involve a larger and more diverse group of '
     'respondents, including students from all colleges and the Basic Education department, faculty, staff, '
     'and the PPFMO, to provide stronger evidence of the system’s Functionality, Reliability, and Usability.'),
    ('Use of a Paid SMS Gateway Provider. ', 'The current system sends SMS alerts through TextBee, a '
     'free SMS gateway that relays messages through a single Android phone with prepaid load. Because each '
     'message is sent one at a time from that device, delivery becomes slower as the number of recipients '
     'increases, which is consistent with the respondents’ suggestion for a faster SMS response time. '
     'Future researchers are '
     'advised to use a paid SMS gateway provider, such as Twilio, Semaphore, or a similar commercial service, '
     'which offers higher sending throughput, delivery reports, and more consistent delivery when alerts are '
     'sent to the entire campus population at once.'),
    ('Measurement of Alert Delivery Time. ', 'Future testing should record the time from alert dispatch to '
     'receipt of the SMS and push notification across multiple trials, mobile networks, and recipient counts, '
     'to measure how delivery time changes as the number of recipients grows.'),
    ('Improvement of Map Performance and Interface Design. ', 'The 2.5D campus map should be further optimized '
     'to remove the slight stutter reported by a respondent, especially on lower-end devices, and the '
     'interface design may be refined based on user feedback.'),
    ('Campus-Wide Evacuation Drill Testing. ', 'The system should be tested during an actual campus-wide '
     'evacuation drill with safety officers present, to compare evacuation time and route accuracy with and '
     'without the application.'),
    ('Expansion of Coverage. ', 'Future versions may extend the system to indoor navigation, the Peñaranda '
     'Campus, and other hazards affecting the campus, such as volcanic eruptions and floods.'),
]
for b, t in recs:
    p = para('', indent=False); p.runs[0].text = ''
    p.add_run(b).bold = True; p.add_run(t)

doc.save(OUT)
print('saved', OUT, 'N=', N, M, overall)
