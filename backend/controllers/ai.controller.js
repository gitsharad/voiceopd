const Anthropic = require('@anthropic-ai/sdk');

// ── Claude client (lazy-init so missing key doesn't crash on startup) ──────────
let _client = null;
const getClient = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};

// ── Fallback mock for when API key is not configured ──────────────────────────
const MOCK_DB = [
  {
    keys: ['urti', 'upper respiratory', 'common cold', 'cold', 'cough', 'sore throat'],
    recommendation: {
      medicines: [
        { name: 'Dolo-650 (Paracetamol)', dosage: '650mg', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Allegra (Fexofenadine)', dosage: '120mg', frequency: 'Once daily', duration: '5 days', instructions: 'At bedtime', routeOfAdmin: 'oral' },
        { name: 'Alex Syrup (Ambroxol+Guaifenesin)', dosage: '10ml', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
      ],
      advice: ['Rest for 2–3 days', 'Drink plenty of warm fluids', 'Avoid cold foods and drinks', 'Steam inhalation twice daily'],
      clinicalNotes: 'URTI — symptomatic treatment. Review if fever persists beyond 3 days.',
    },
  },
  {
    keys: ['fever', 'viral fever', 'pyrexia', 'ताप'],
    recommendation: {
      medicines: [
        { name: 'Dolo-650 (Paracetamol)', dosage: '650mg', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Domstal (Domperidone)', dosage: '10mg', frequency: 'Thrice daily', duration: '3 days', instructions: 'Before food', routeOfAdmin: 'oral' },
      ],
      advice: ['Adequate rest', 'Stay hydrated — minimum 2–3 litres per day', 'Sponge with lukewarm water if fever >102°F'],
      clinicalNotes: 'Viral fever — symptomatic management. CBC if fever persists >5 days.',
    },
  },
  {
    keys: ['hypertension', 'high bp', 'high blood pressure', 'htn'],
    recommendation: {
      medicines: [
        { name: 'Amlokind-5 (Amlodipine)', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', routeOfAdmin: 'oral' },
        { name: 'Telmikind-40 (Telmisartan)', dosage: '40mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', routeOfAdmin: 'oral' },
      ],
      advice: ['Low-salt diet (<5g/day)', 'Regular brisk walking 30 min/day', 'Monitor BP daily at home'],
      clinicalNotes: 'Essential hypertension. Target BP <130/80 mmHg.',
    },
  },
  {
    keys: ['diabetes', 'type 2 diabetes', 't2dm', 'diabetic', 'sugar'],
    recommendation: {
      medicines: [
        { name: 'Glycomet-500 (Metformin)', dosage: '500mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Amaryl-1 (Glimepiride)', dosage: '1mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Before breakfast', routeOfAdmin: 'oral' },
      ],
      advice: ['Low-glycaemic diet', 'Exercise 30 min daily', 'Regular blood glucose monitoring'],
      clinicalNotes: 'T2DM on oral hypoglycaemics. Target HbA1c <7%.',
    },
  },
];

function getMockRecommendation(diagnosis = '', symptoms = '') {
  const text = `${diagnosis} ${symptoms}`.toLowerCase();
  for (const entry of MOCK_DB) {
    if (entry.keys.some(k => text.includes(k))) return entry.recommendation;
  }
  return {
    medicines: [
      { name: 'Paracetamol', dosage: '500mg', frequency: 'Thrice daily', duration: '3 days', instructions: 'After food', routeOfAdmin: 'oral' },
    ],
    advice: ['Rest adequately', 'Stay well hydrated', 'Follow up if symptoms worsen'],
    clinicalNotes: '',
  };
}

// ── Real Claude recommendation ────────────────────────────────────────────────
async function getAiRecommendation(diagnosis, symptoms) {
  const prompt = `You are an expert clinical decision support system for an Indian general physician (OPD setting).

Given the following patient presentation, provide a concise prescription recommendation.

Diagnosis: ${diagnosis || 'Not specified'}
Symptoms: ${symptoms || 'Not specified'}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "medicines": [
    {
      "name": "Popular Indian brand name (generic name)",
      "dosage": "e.g. 500mg",
      "frequency": "one of: 1-0-0, 0-1-0, 0-0-1, 1-0-1, 1-1-0, 0-1-1, 1-1-1, Once daily, Twice daily, Thrice daily, SOS",
      "duration": "e.g. 5 days, 1 month, Ongoing",
      "instructions": "e.g. After food, Before food, At bedtime",
      "routeOfAdmin": "one of: oral, topical, injection, inhalation, other"
    }
  ],
  "advice": ["advice line 1", "advice line 2"],
  "clinicalNotes": "Brief clinical note for doctor's record"
}

Rules:
- Provide 1–4 medicines appropriate for Indian OPD practice
- IMPORTANT: Use the popular Indian brand/trade name first, followed by generic name in brackets.
  Examples: "Crocin (Paracetamol)", "Augmentin (Amoxicillin-Clavulanate)", "Pan-D (Pantoprazole+Domperidone)",
  "Combiflam (Ibuprofen+Paracetamol)", "Allegra (Fexofenadine)", "Montair-LC (Montelukast+Levocetirizine)",
  "Azithral (Azithromycin)", "Taxim-O (Cefixime)", "Rantac (Ranitidine)", "Omez (Omeprazole)",
  "Dolo-650 (Paracetamol 650mg)", "Chymoral Forte (Trypsin-Chymotrypsin)", "Benadryl (Diphenhydramine syrup)"
- For syrups/suspensions: mention "syrup" or "suspension" in the name e.g. "Alex Syrup", "Benadryl Syrup"
- For injections: mention commonly available Indian injectable brands
- Keep advice practical and patient-friendly (2–4 lines)
- Clinical notes should be brief (1–2 sentences)
- Do not include any text outside the JSON object`;

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

// @route  POST /api/ai/recommend
exports.recommend = async (req, res, next) => {
  try {
    const { diagnosis, symptoms } = req.body;
    if (!diagnosis && !symptoms) {
      return res.status(400).json({ success: false, message: 'diagnosis or symptoms required' });
    }

    let recommendation;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        recommendation = await getAiRecommendation(diagnosis || '', symptoms || '');
      } catch (aiErr) {
        console.error('Claude API error, falling back to mock:', aiErr.message);
        recommendation = getMockRecommendation(diagnosis, symptoms);
      }
    } else {
      // No API key configured — use mock
      await new Promise(r => setTimeout(r, 400));
      recommendation = getMockRecommendation(diagnosis, symptoms);
    }

    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
};

// ── Built-in Marathi advice dictionary ────────────────────────────────────────
// Keys are lowercase patterns; value is Marathi translation.
// Uses keyword matching so slight wording differences still match.
const ADVICE_PATTERNS = [
  { keys: ['drink plenty of water', 'plenty of water'],       mr: 'भरपूर पाणी प्या' },
  { keys: ['2-3 litres', '2–3 litres', 'litres of water'],    mr: 'दररोज २-३ लिटर पाणी प्या' },
  { keys: ['stay hydrated', 'well hydrated'],                 mr: 'शरीरात पाण्याचे प्रमाण राखा' },
  { keys: ['warm fluids', 'warm water'],                      mr: 'भरपूर कोमट पाणी व द्रवपदार्थ घ्या' },
  { keys: ['rest adequately', 'adequate rest'],               mr: 'पुरेशी विश्रांती घ्या' },
  { keys: ['rest for 2', 'rest for 3', 'rest for 5'],         mr: 'काही दिवस विश्रांती घ्या' },
  { keys: ['low-salt diet', 'low salt'],                      mr: 'कमी मीठाचा आहार घ्या' },
  { keys: ['low-glycaemic', 'low glycaemic', 'avoid sugar'],  mr: 'कमी साखरेचा आहार घ्या' },
  { keys: ['small frequent meals'],                           mr: 'थोडे-थोडे व वारंवार जेवण घ्या' },
  { keys: ['avoid spicy', 'oily food'],                       mr: 'तिखट व तेलकट खाणे टाळा' },
  { keys: ['avoid cold food', 'cold drinks'],                 mr: 'थंड खाणे-पिणे टाळा' },
  { keys: ['brisk walking', 'walking 30'],                    mr: 'दररोज ३० मिनिटे वेगाने चाला' },
  { keys: ['exercise 30', 'exercise daily'],                  mr: 'दररोज ३० मिनिटे व्यायाम करा' },
  { keys: ['antibiotic course', 'complete the full'],         mr: 'संपूर्ण अँटिबायोटिक कोर्स पूर्ण करा' },
  { keys: ['do not stop medication', 'stop medication'],      mr: 'डॉक्टरांच्या सल्ल्याशिवाय औषध बंद करू नका' },
  { keys: ['take medicines as prescribed', 'as prescribed'],  mr: 'सांगितल्याप्रमाणे औषधे घ्या' },
  { keys: ['follow up if symptoms', 'symptoms worsen'],       mr: 'तक्रार वाढल्यास पुन्हा या' },
  { keys: ['fever persists', 'review if fever'],              mr: 'ताप ३ दिवसांपेक्षा जास्त राहिल्यास पुन्हा या' },
  { keys: ['steam inhalation'],                               mr: 'दिवसातून दोनदा वाफ घ्या' },
  { keys: ['avoid smoking', 'smoking and alcohol'],           mr: 'धूम्रपान व मद्यपान टाळा' },
  { keys: ['monitor bp', 'check bp', 'blood pressure'],       mr: 'घरी रोज रक्तदाब तपासा' },
  { keys: ['blood glucose', 'fasting glucose'],               mr: 'नियमितपणे उपाशी रक्त साखर तपासा' },
  { keys: ['foot care', 'foot inspection'],                   mr: 'रोज पायांची तपासणी करा' },
  { keys: ['quiet', 'dark room', 'migraine'],                 mr: 'शांत व अंधाऱ्या खोलीत विश्रांती घ्या' },
  { keys: ['identify', 'avoid triggers'],                     mr: 'त्रास वाढवणाऱ्या गोष्टी टाळा' },
  { keys: ['regular sleep', 'sleep schedule'],                mr: 'नियमित झोपेची वेळ पाळा' },
  { keys: ['avoid skipping meals', 'skip meals'],             mr: 'जेवण वगळू नका' },
  { keys: ['wound clean', 'keep wound'],                      mr: 'जखम स्वच्छ व कोरडी ठेवा' },
  { keys: ['change dressing'],                                mr: 'रोज ड्रेसिंग बदला' },
  { keys: ['wash hands', 'hand hygiene'],                     mr: 'वारंवार हात धुवा' },
  { keys: ['void bladder', 'after intercourse'],              mr: 'संभोगानंतर लघवी करा' },
  { keys: ['rinse mouth', 'after inhaler'],                   mr: 'इनहेलर वापरल्यानंतर तोंड धुवा' },
  { keys: ['carry inhaler', 'reliever inhaler'],              mr: 'श्वासाची औषधी नेहमी सोबत ठेवा' },
  { keys: ['pursed lip', 'breathing exercise'],               mr: 'श्वासाचे व्यायाम रोज करा' },
  { keys: ['hba1c', 'check hba1c'],                           mr: 'दर ३ महिन्यांनी HbA1c तपासा' },
  { keys: ['do not squeeze', 'pierce lesion'],                mr: 'फोड किंवा पुरळ दाबू नका' },
];

function dictTranslate(line) {
  const key = line.toLowerCase().replace(/[–—]/g, '-').trim();
  for (const { keys, mr } of ADVICE_PATTERNS) {
    if (keys.some(k => key.includes(k))) return mr;
  }
  return '';  // Return empty string (not original) so *ngIf hides it
}

// @route  POST /api/ai/translate-advice
exports.translateAdvice = async (req, res, next) => {
  try {
    const { advices } = req.body;
    if (!Array.isArray(advices) || advices.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Try Claude first if API key is set
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `Translate each medical advice line below from English to Marathi (Devanagari script). Keep it clear and patient-friendly for an Indian OPD setting.

Return ONLY a valid JSON array of strings — same count as input, same order. No markdown, no explanation outside the JSON.

${advices.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;

        const message = await getClient().messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });

        const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
        const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const translations = JSON.parse(cleaned);

        if (Array.isArray(translations) && translations.length === advices.length) {
          return res.json({ success: true, data: translations });
        }
      } catch (err) {
        console.error('Claude translate error, using dict fallback:', err.message);
      }
    }

    // Dictionary fallback — returns '' for unrecognised lines (frontend hides those)
    const translations = advices.map(a => dictTranslate(a));
    res.json({ success: true, data: translations });
  } catch (err) {
    next(err);
  }
};
