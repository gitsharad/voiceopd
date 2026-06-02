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
        { name: 'Paracetamol', dosage: '500mg', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '5 days', instructions: 'At bedtime', routeOfAdmin: 'oral' },
        { name: 'Ambroxol + Guaifenesin Syrup', dosage: '10ml', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
      ],
      advice: ['Rest for 2–3 days', 'Drink plenty of warm fluids', 'Avoid cold foods and drinks', 'Steam inhalation twice daily'],
      clinicalNotes: 'URTI — symptomatic treatment. Review if fever persists beyond 3 days.',
    },
  },
  {
    keys: ['fever', 'viral fever', 'pyrexia', 'ताप'],
    recommendation: {
      medicines: [
        { name: 'Paracetamol', dosage: '650mg', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Domperidone', dosage: '10mg', frequency: 'Thrice daily', duration: '3 days', instructions: 'Before food', routeOfAdmin: 'oral' },
      ],
      advice: ['Adequate rest', 'Stay hydrated — minimum 2–3 litres per day', 'Sponge with lukewarm water if fever >102°F'],
      clinicalNotes: 'Viral fever — symptomatic management. CBC if fever persists >5 days.',
    },
  },
  {
    keys: ['hypertension', 'high bp', 'high blood pressure', 'htn'],
    recommendation: {
      medicines: [
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', routeOfAdmin: 'oral' },
        { name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', routeOfAdmin: 'oral' },
      ],
      advice: ['Low-salt diet (<5g/day)', 'Regular brisk walking 30 min/day', 'Monitor BP daily at home'],
      clinicalNotes: 'Essential hypertension. Target BP <130/80 mmHg.',
    },
  },
  {
    keys: ['diabetes', 'type 2 diabetes', 't2dm', 'diabetic', 'sugar'],
    recommendation: {
      medicines: [
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Glimepiride', dosage: '1mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Before breakfast', routeOfAdmin: 'oral' },
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
      "name": "Drug name (brand or generic)",
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
- Use generic names with common Indian brand context where helpful
- Keep advice practical and patient-friendly
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

// ── Built-in Marathi advice dictionary (fallback) ─────────────────────────────
const ADVICE_DICT = {
  // Hydration
  'drink plenty of water':             'भरपूर पाणी प्या',
  'drink 2-3 litres of water daily':   'दररोज २-३ लिटर पाणी प्या',
  'stay hydrated':                     'शरीरात पाण्याचे प्रमाण राखा',
  'stay well hydrated':                'शरीरात पाण्याचे प्रमाण राखा',
  'drink plenty of warm fluids':       'भरपूर कोमट पाणी व द्रवपदार्थ घ्या',
  // Rest
  'rest adequately':                   'पुरेशी विश्रांती घ्या',
  'rest for 2-3 days':                 '२-३ दिवस विश्रांती घ्या',
  'rest for 3 days':                   '३ दिवस विश्रांती घ्या',
  'adequate rest':                     'पुरेशी विश्रांती घ्या',
  // Diet
  'low-salt diet (<5g/day)':           'कमी मीठाचा आहार घ्या (दररोज ५ ग्रॅमपेक्षा कमी)',
  'low-glycaemic diet':                'कमी साखरेचा आहार घ्या',
  'small frequent meals':              'थोडे-थोडे व वारंवार जेवण घ्या',
  'avoid spicy and oily food':         'तिखट व तेलकट खाणे टाळा',
  'avoid cold foods and drinks':       'थंड खाणे-पिणे टाळा',
  // Exercise
  'regular brisk walking 30 min/day': 'दररोज ३० मिनिटे वेगाने चाला',
  'exercise 30 min daily':            'दररोज ३० मिनिटे व्यायाम करा',
  // Medicine compliance
  'complete the full antibiotic course':    'संपूर्ण अँटिबायोटिक कोर्स पूर्ण करा',
  'do not stop medication without consulting doctor': 'डॉक्टरांच्या सल्ल्याशिवाय औषध बंद करू नका',
  'take medicines as prescribed':       'सांगितल्याप्रमाणे औषधे घ्या',
  // Follow-up
  'follow up if symptoms worsen':       'तक्रार वाढल्यास पुन्हा येा',
  'review if fever persists beyond 3 days': 'ताप ३ दिवसांपेक्षा जास्त राहिल्यास पुन्हा या',
  // Steam
  'steam inhalation twice daily':       'दिवसातून दोनदा वाफ घ्या',
  // Smoking / alcohol
  'avoid smoking and alcohol':          'धूम्रपान व मद्यपान टाळा',
  // Blood pressure monitoring
  'monitor bp daily at home':           'घरी रोज रक्तदाब तपासा',
  // Blood sugar
  'regular fasting blood glucose monitoring': 'नियमितपणे उपाशी रक्त साखर तपासा',
  // Foot care
  'foot care — daily inspection':       'रोज पायांची तपासणी करा',
};

function dictTranslate(line) {
  const key = line.toLowerCase().trim();
  // Exact match
  if (ADVICE_DICT[key]) return ADVICE_DICT[key];
  // Partial match
  for (const [k, v] of Object.entries(ADVICE_DICT)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
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
        const prompt = `Translate each of the following medical advice lines from English to Marathi (Devanagari script). Keep the translation clear and patient-friendly.

Return ONLY a JSON array of strings — one Marathi translation per line, in the same order. No explanation, no markdown.

Advice lines:
${advices.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;

        const message = await getClient().messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        });

        const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
        const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const translations = JSON.parse(cleaned);

        return res.json({ success: true, data: translations });
      } catch (err) {
        console.error('Claude translate error, using dict fallback:', err.message);
      }
    }

    // Dictionary fallback
    const translations = advices.map(a => dictTranslate(a) || a);
    res.json({ success: true, data: translations });
  } catch (err) {
    next(err);
  }
};
