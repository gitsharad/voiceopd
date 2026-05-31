// ai.controller.js
// Mock AI recommendation engine — swap getRecommendations() body for real Claude API later

const MOCK_DB = [
  {
    keys: ['urti', 'upper respiratory', 'common cold', 'cold'],
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
    keys: ['viral fever', 'fever', 'pyrexia'],
    recommendation: {
      medicines: [
        { name: 'Paracetamol', dosage: '650mg', frequency: 'Thrice daily', duration: '5 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Domperidone', dosage: '10mg', frequency: 'Thrice daily', duration: '3 days', instructions: 'Before food', routeOfAdmin: 'oral' },
        { name: 'ORS Sachets', dosage: '1 sachet', frequency: 'Twice daily', duration: '3 days', instructions: 'With water', routeOfAdmin: 'oral' },
      ],
      advice: ['Adequate rest', 'Stay hydrated — minimum 2–3 litres per day', 'Sponge with lukewarm water if fever >102°F', 'Avoid self-medication with antibiotics'],
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
      advice: ['Low-salt diet (<5g/day)', 'Regular brisk walking 30 min/day', 'Avoid smoking and alcohol', 'Monitor BP daily at home', 'Do not stop medication without consulting doctor'],
      clinicalNotes: 'Essential hypertension. Target BP <130/80 mmHg. Lifestyle modification counselled.',
    },
  },
  {
    keys: ['diabetes', 'type 2 diabetes', 't2dm', 'dm2', 'diabetic'],
    recommendation: {
      medicines: [
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Glimepiride', dosage: '1mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Before breakfast', routeOfAdmin: 'oral' },
      ],
      advice: ['Low-glycaemic diet — avoid sugar, white rice, maida', 'Exercise 30 min daily', 'Regular fasting blood glucose monitoring', 'Check HbA1c every 3 months', 'Foot care — daily inspection'],
      clinicalNotes: 'T2DM on oral hypoglycaemics. Target HbA1c <7%. Counsel on diet and foot care.',
    },
  },
  {
    keys: ['gastritis', 'acidity', 'gerd', 'acid reflux', 'stomach pain', 'dyspepsia'],
    recommendation: {
      medicines: [
        { name: 'Pantoprazole', dosage: '40mg', frequency: 'Once daily', duration: '14 days', instructions: 'Before breakfast', routeOfAdmin: 'oral' },
        { name: 'Domperidone', dosage: '10mg', frequency: 'Thrice daily', duration: '7 days', instructions: 'Before food', routeOfAdmin: 'oral' },
        { name: 'Sucralfate Suspension', dosage: '10ml', frequency: 'Twice daily', duration: '7 days', instructions: 'Empty stomach', routeOfAdmin: 'oral' },
      ],
      advice: ['Small frequent meals', 'Avoid spicy and oily food', 'Do not lie down for 2 hours after eating', 'Avoid NSAIDs', 'Elevate head end of bed'],
      clinicalNotes: 'Gastritis / GERD — PPI therapy initiated. UGI endoscopy if no improvement in 4 weeks.',
    },
  },
  {
    keys: ['urinary tract infection', 'uti', 'dysuria', 'burning micturition'],
    recommendation: {
      medicines: [
        { name: 'Nitrofurantoin', dosage: '100mg', frequency: 'Twice daily', duration: '7 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Phenazopyridine', dosage: '200mg', frequency: 'Thrice daily', duration: '2 days', instructions: 'After food', routeOfAdmin: 'oral' },
      ],
      advice: ['Drink 2–3 litres of water daily', 'Void bladder after intercourse', 'Maintain perineal hygiene', 'Complete the full antibiotic course'],
      clinicalNotes: 'UTI — empirical antibiotic therapy. Urine C&S advised. Review in 5 days.',
    },
  },
  {
    keys: ['migraine', 'headache', 'severe headache'],
    recommendation: {
      medicines: [
        { name: 'Sumatriptan', dosage: '50mg', frequency: 'SOS', duration: '3 days', instructions: 'At onset of headache', routeOfAdmin: 'oral' },
        { name: 'Paracetamol', dosage: '1000mg', frequency: 'SOS', duration: '3 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Metoclopramide', dosage: '10mg', frequency: 'SOS', duration: '3 days', instructions: 'With sumatriptan', routeOfAdmin: 'oral' },
      ],
      advice: ['Lie in a quiet, dark room during attack', 'Identify and avoid triggers (stress, certain foods)', 'Regular sleep schedule', 'Avoid skipping meals', 'Headache diary recommended'],
      clinicalNotes: 'Migraine without aura. Acute abortive therapy prescribed. Prophylaxis to be considered if >4 episodes/month.',
    },
  },
  {
    keys: ['asthma', 'wheezing', 'bronchospasm', 'breathlessness', 'shortness of breath'],
    recommendation: {
      medicines: [
        { name: 'Salbutamol Inhaler', dosage: '100mcg', frequency: 'SOS', duration: 'Ongoing', instructions: '2 puffs as needed', routeOfAdmin: 'inhalation' },
        { name: 'Budesonide Inhaler', dosage: '200mcg', frequency: 'Twice daily', duration: 'Ongoing', instructions: '1 puff morning and night', routeOfAdmin: 'inhalation' },
        { name: 'Montelukast', dosage: '10mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'At bedtime', routeOfAdmin: 'oral' },
      ],
      advice: ['Avoid known triggers (dust, smoke, cold air)', 'Carry reliever inhaler at all times', 'Use spacer with inhaler', 'Rinse mouth after inhaled steroid', 'Pursed lip breathing exercise daily'],
      clinicalNotes: 'Bronchial asthma — step-up therapy. Peak flow monitoring advised. Spirometry at next visit.',
    },
  },
  {
    keys: ['skin infection', 'cellulitis', 'impetigo', 'infected wound', 'wound infection'],
    recommendation: {
      medicines: [
        { name: 'Amoxicillin-Clavulanate', dosage: '625mg', frequency: 'Twice daily', duration: '7 days', instructions: 'After food', routeOfAdmin: 'oral' },
        { name: 'Mupirocin Ointment', dosage: '2%', frequency: 'Thrice daily', duration: '7 days', instructions: 'Apply to affected area', routeOfAdmin: 'topical' },
        { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '5 days', instructions: 'At bedtime', routeOfAdmin: 'oral' },
      ],
      advice: ['Keep wound clean and dry', 'Change dressing daily', 'Complete antibiotic course', 'Do not squeeze or pierce lesions', 'Wash hands frequently'],
      clinicalNotes: 'Skin/soft tissue infection. Wound swab C&S if no improvement in 48–72 hours.',
    },
  },
];

function getRecommendations(diagnosis = '', symptoms = '') {
  const text = `${diagnosis} ${symptoms}`.toLowerCase();

  for (const entry of MOCK_DB) {
    if (entry.keys.some(k => text.includes(k))) {
      return entry.recommendation;
    }
  }

  // Generic fallback
  return {
    medicines: [
      { name: 'Paracetamol', dosage: '500mg', frequency: 'Thrice daily', duration: '3 days', instructions: 'After food', routeOfAdmin: 'oral' },
      { name: 'Multivitamin', dosage: '1 tablet', frequency: 'Once daily', duration: '1 month', instructions: 'After breakfast', routeOfAdmin: 'oral' },
    ],
    advice: ['Rest adequately', 'Stay well hydrated', 'Follow up if symptoms worsen'],
    clinicalNotes: '',
  };
}

// @route  POST /api/ai/recommend
exports.recommend = async (req, res, next) => {
  try {
    const { diagnosis, symptoms } = req.body;
    if (!diagnosis && !symptoms) {
      return res.status(400).json({ success: false, message: 'diagnosis or symptoms required' });
    }
    // Simulate slight network delay so the loading state is visible
    await new Promise(r => setTimeout(r, 500));
    const recommendation = getRecommendations(diagnosis, symptoms);
    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
};
